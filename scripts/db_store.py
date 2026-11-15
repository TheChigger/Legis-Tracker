#!/usr/bin/env python3
"""
Texas Capitol Legislative Intelligence - SQLite WAL Storage Layer
Provides concurrent-safe storage in data/texas_legis.db (WAL mode) and
atomic exports to data/runtime_bills.json so runtime ingestion and Ollama
enrichment never conflict with Git-tracked src/data/realBills.json.
"""

import json
import os
import sqlite3
import sys
import time
from typing import Optional

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
SEED_JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "realBills.json")
PRE_UPDATE_JSON_PATH = os.path.join(DATA_DIR, "pre_update_realBills.json")
DB_PATH = os.path.join(DATA_DIR, "texas_legis.db")
RUNTIME_JSON_PATH = os.path.join(DATA_DIR, "runtime_bills.json")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    session TEXT NOT NULL,
    bill_number TEXT NOT NULL,
    chamber TEXT NOT NULL,
    author TEXT NOT NULL,
    date_filed TEXT NOT NULL,
    filed_timestamp INTEGER NOT NULL,
    stance TEXT NOT NULL,
    recommended_stance TEXT,
    priority_score INTEGER NOT NULL,
    primary_category TEXT NOT NULL,
    ai_enriched INTEGER DEFAULT 0,
    ai_rubric_version INTEGER DEFAULT 0,
    ai_enriched_at TEXT,
    bill_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bills_session ON bills(session);
CREATE INDEX IF NOT EXISTS idx_bills_enrichment ON bills(session, ai_enriched, ai_rubric_version);
"""


def get_connection() -> sqlite3.Connection:
    """Open a WAL-mode SQLite connection and ensure schema & indexes exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=10000;")
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    return conn


def _bill_to_row(bill: dict) -> tuple:
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    ai_enriched = 1 if bill.get("aiEnriched") else 0
    ai_rubric_version = int(bill.get("aiRubricVersion") or (1 if ai_enriched else 0))
    filed_ts = int(bill.get("filedDateTimestamp") or int(time.time()))
    prio = int(bill.get("priorityScore") or 2)
    return (
        bill["id"],
        bill.get("session", "90R"),
        bill.get("billNumber", ""),
        bill.get("chamber", "House"),
        bill.get("author", "Unknown"),
        bill.get("dateFiled", ""),
        filed_ts,
        bill.get("stance", "NEUTRAL"),
        bill.get("recommendedStance"),
        prio,
        bill.get("primaryCategory", "General State Affairs"),
        ai_enriched,
        ai_rubric_version,
        bill.get("aiEnrichedAt"),
        json.dumps(bill, ensure_ascii=False),
        now_iso,
    )


def _best_full_text_len(bill: dict) -> int:
    versions = bill.get("versions") or []
    if not versions or not isinstance(versions, list):
        return 0
    return max((len(v.get("fullText") or "") for v in versions), default=0)


def _insert_or_replace_bill(conn: sqlite3.Connection, bill: dict) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO bills (
            id, session, bill_number, chamber, author, date_filed, filed_timestamp,
            stance, recommended_stance, priority_score, primary_category,
            ai_enriched, ai_rubric_version, ai_enriched_at, bill_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        _bill_to_row(bill),
    )


def init_and_sync_seed(conn: Optional[sqlite3.Connection] = None) -> int:
    """
    Seed data/texas_legis.db from src/data/realBills.json (read-only) and
    merge any pre-update backup (data/pre_update_realBills.json), then export
    data/runtime_bills.json if needed. Never modifies src/data/realBills.json.
    """
    own_conn = conn is None
    if conn is None:
        conn = get_connection()

    changed = False
    try:
        existing_rows = {
            row["id"]: (row["ai_enriched"], row["bill_json"])
            for row in conn.execute("SELECT id, ai_enriched, bill_json FROM bills").fetchall()
        }

        if os.path.exists(SEED_JSON_PATH):
            with open(SEED_JSON_PATH, "r", encoding="utf-8") as f:
                seed_bills = json.load(f)

            for seed_bill in seed_bills:
                bid = seed_bill.get("id")
                if not bid:
                    continue

                if bid not in existing_rows:
                    _insert_or_replace_bill(conn, seed_bill)
                    existing_rows[bid] = (1 if seed_bill.get("aiEnriched") else 0, json.dumps(seed_bill))
                    changed = True
                else:
                    ai_flag, existing_json_str = existing_rows[bid]
                    if not ai_flag:
                        existing = json.loads(existing_json_str)
                        baseline_diff = (
                            existing.get("stance") != seed_bill.get("stance")
                            or existing.get("recommendedStance") != seed_bill.get("recommendedStance")
                            or existing.get("priorityScore") != seed_bill.get("priorityScore")
                            or existing.get("primaryCategory") != seed_bill.get("primaryCategory")
                            or existing.get("comportConflict") != seed_bill.get("comportConflict")
                        )
                        seed_has_better_text = _best_full_text_len(seed_bill) > _best_full_text_len(existing)

                        if baseline_diff or seed_has_better_text:
                            merged = dict(existing)
                            for key in (
                                "stance",
                                "recommendedStance",
                                "priorityScore",
                                "primaryCategory",
                                "comportConflict",
                                "urgencyLevel",
                            ):
                                if key in seed_bill:
                                    merged[key] = seed_bill[key]
                                elif key in merged and key == "recommendedStance":
                                    merged.pop("recommendedStance", None)

                            if seed_has_better_text:
                                merged["versions"] = seed_bill["versions"]
                                if seed_bill.get("amendedStatutes"):
                                    merged["amendedStatutes"] = seed_bill["amendedStatutes"]
                                if seed_bill.get("officialTloUrl"):
                                    merged["officialTloUrl"] = seed_bill["officialTloUrl"]
                                if seed_bill.get("officialPdfUrl"):
                                    merged["officialPdfUrl"] = seed_bill["officialPdfUrl"]

                            _insert_or_replace_bill(conn, merged)
                            existing_rows[bid] = (0, json.dumps(merged))
                            changed = True

        # Merge pre-update homelab snapshot if present (preserves local Ollama enrichments across git migration)
        if os.path.exists(PRE_UPDATE_JSON_PATH):
            try:
                with open(PRE_UPDATE_JSON_PATH, "r", encoding="utf-8") as f:
                    pre_bills = json.load(f)

                for pre_bill in pre_bills:
                    bid = pre_bill.get("id")
                    if not bid:
                        continue
                    if bid not in existing_rows:
                        _insert_or_replace_bill(conn, pre_bill)
                        changed = True
                    elif pre_bill.get("aiEnriched"):
                        _, curr_json_str = existing_rows[bid]
                        curr = json.loads(curr_json_str)
                        if not curr.get("aiEnriched") or int(pre_bill.get("aiRubricVersion") or 1) >= int(curr.get("aiRubricVersion") or 0):
                            merged = dict(curr)
                            merged.update(pre_bill)
                            # Keep longer hydrated text if current SQLite row already had it
                            if _best_full_text_len(curr) > _best_full_text_len(pre_bill):
                                merged["versions"] = curr["versions"]
                                if curr.get("amendedStatutes"):
                                    merged["amendedStatutes"] = curr["amendedStatutes"]
                            _insert_or_replace_bill(conn, merged)
                            changed = True
                conn.commit()
                os.remove(PRE_UPDATE_JSON_PATH)
            except Exception as e:
                print(f"[db_store Warning] Could not merge pre-update backup cleanly: {e}", file=sys.stderr)

        conn.commit()

        if changed or not os.path.exists(RUNTIME_JSON_PATH):
            export_runtime_snapshot(conn)

        count = conn.execute("SELECT COUNT(*) FROM bills").fetchone()[0]
        return count
    finally:
        if own_conn:
            conn.close()


def load_all_bills(conn: Optional[sqlite3.Connection] = None, session: Optional[str] = None) -> list[dict]:
    """Load bills from SQLite, seeding from src/data/realBills.json if empty."""
    own_conn = conn is None
    if conn is None:
        conn = get_connection()

    try:
        total = conn.execute("SELECT COUNT(*) FROM bills").fetchone()[0]
        if total == 0:
            init_and_sync_seed(conn)

        if session:
            rows = conn.execute(
                "SELECT bill_json FROM bills WHERE session = ? ORDER BY priority_score DESC, filed_timestamp DESC",
                (session,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT bill_json FROM bills ORDER BY priority_score DESC, filed_timestamp DESC"
            ).fetchall()
        return [json.loads(r["bill_json"]) for r in rows]
    finally:
        if own_conn:
            conn.close()


def upsert_ingested_bill(conn: sqlite3.Connection, bill: dict) -> str:
    """
    Insert a newly discovered bill or update TLO metadata (lastAction, status,
    caption, committee) on an existing bill while preserving AI evaluations
    and hydrated full text.
    """
    bid = bill["id"]
    row = conn.execute(
        "SELECT bill_json, ai_enriched, ai_rubric_version FROM bills WHERE id = ?",
        (bid,),
    ).fetchone()

    if row is None:
        _insert_or_replace_bill(conn, bill)
        conn.commit()
        return "inserted"

    existing = json.loads(row["bill_json"])
    merged = dict(existing)

    # Refresh TLO metadata fields
    for meta_key in (
        "lastAction",
        "lastActionDate",
        "currentStatus",
        "committee",
        "caption",
        "author",
        "coauthors",
    ):
        val = bill.get(meta_key)
        if val not in (None, "", []):
            merged[meta_key] = val

    # Update categories only when not already enriched and incoming provides real subjects
    if not existing.get("aiEnriched") and bill.get("categories"):
        merged["categories"] = bill["categories"]

    # Only overwrite versions if incoming has fuller statutory text than existing
    if _best_full_text_len(bill) > _best_full_text_len(existing):
        merged["versions"] = bill["versions"]
        if bill.get("amendedStatutes"):
            merged["amendedStatutes"] = bill["amendedStatutes"]

    _insert_or_replace_bill(conn, merged)
    conn.commit()
    return "updated"


def upsert_enriched_bill(conn: sqlite3.Connection, bill: dict) -> None:
    """Persist an AI-evaluated or text-hydrated bill immediately and commit."""
    _insert_or_replace_bill(conn, bill)
    conn.commit()


def export_runtime_snapshot(conn: Optional[sqlite3.Connection] = None) -> int:
    """Atomically write all bills from SQLite to data/runtime_bills.json."""
    own_conn = conn is None
    if conn is None:
        conn = get_connection()

    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        rows = conn.execute(
            "SELECT bill_json FROM bills ORDER BY priority_score DESC, filed_timestamp DESC"
        ).fetchall()
        bills = [json.loads(r["bill_json"]) for r in rows]

        tmp_path = RUNTIME_JSON_PATH + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(bills, f, indent=2)
        os.replace(tmp_path, RUNTIME_JSON_PATH)
        return len(bills)
    finally:
        if own_conn:
            conn.close()


if __name__ == "__main__":
    args = set(sys.argv[1:])
    with get_connection() as connection:
        if "--init" in args or "--sync-seed" in args or not args:
            total_count = init_and_sync_seed(connection)
            exported_count = export_runtime_snapshot(connection)
            count_90r = connection.execute("SELECT COUNT(*) FROM bills WHERE session = '90R'").fetchone()[0]
            print(
                f"✔ SQLite WAL store ready at {DB_PATH} "
                f"({total_count} total bills, {count_90r} in 90R; snapshot exported: {exported_count})"
            )
