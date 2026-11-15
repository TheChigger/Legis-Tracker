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
RUNTIME_RSS_PATH = os.path.join(DATA_DIR, "runtime_rss.json")
RUNTIME_MEETINGS_PATH = os.path.join(DATA_DIR, "runtime_meetings.json")

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

CREATE TABLE IF NOT EXISTS rss_items (
    id TEXT PRIMARY KEY,
    feed_type TEXT NOT NULL,
    feed_label TEXT NOT NULL,
    session TEXT NOT NULL,
    chamber TEXT NOT NULL,
    bill_number TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    link TEXT NOT NULL,
    pub_date TEXT NOT NULL,
    pub_timestamp INTEGER NOT NULL,
    item_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rss_pub_ts ON rss_items(pub_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rss_feed_type ON rss_items(feed_type);

CREATE TABLE IF NOT EXISTS committee_meetings (
    id TEXT PRIMARY KEY,
    session TEXT NOT NULL,
    event_type TEXT NOT NULL,
    committee_name TEXT NOT NULL,
    chamber TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    meeting_time TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL,
    meeting_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meetings_session_date ON committee_meetings(session, meeting_date);
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
                    existing = json.loads(existing_json_str)
                    needs_metadata_repair = (
                        "?" in (existing.get("author") or "")
                        or "?" in (existing.get("caption") or "")
                        or ("|" in (existing.get("author") or "") and not existing.get("coauthors"))
                    )
                    baseline_diff = not ai_flag and (
                        existing.get("stance") != seed_bill.get("stance")
                        or existing.get("recommendedStance") != seed_bill.get("recommendedStance")
                        or existing.get("priorityScore") != seed_bill.get("priorityScore")
                        or existing.get("primaryCategory") != seed_bill.get("primaryCategory")
                        or existing.get("comportConflict") != seed_bill.get("comportConflict")
                    )
                    seed_has_better_text = _best_full_text_len(seed_bill) > _best_full_text_len(existing)

                    if needs_metadata_repair or baseline_diff or seed_has_better_text:
                        merged = dict(existing)
                        if needs_metadata_repair:
                            for meta_key in ("author", "coauthors", "caption"):
                                if seed_bill.get(meta_key) not in (None, ""):
                                    merged[meta_key] = seed_bill[meta_key]
                            if "?" in (merged.get("summary") or "") and seed_bill.get("caption"):
                                merged["summary"] = seed_bill["caption"]

                        if baseline_diff:
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
                        existing_rows[bid] = (ai_flag, json.dumps(merged))
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

        seed_default_meetings_and_rss(conn)

        if changed or not os.path.exists(RUNTIME_JSON_PATH):
            export_runtime_snapshot(conn)
        if not os.path.exists(RUNTIME_RSS_PATH):
            export_runtime_rss(conn)
        if not os.path.exists(RUNTIME_MEETINGS_PATH):
            export_runtime_meetings(conn)

        count = conn.execute("SELECT COUNT(*) FROM bills").fetchone()[0]
        return count
    finally:
        if own_conn:
            conn.close()


DEFAULT_89R_MEETINGS = [
    {
        "id": "cm-89r-1",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "House Public Education",
        "chamber": "House",
        "meetingDate": "2025-03-11",
        "meetingTime": "8:00 AM",
        "location": "Room E2.036, Capitol Extension",
        "status": "Adjourned",
        "agendaBills": ["HB 2", "HB 100", "HB 120"],
        "witnessRegistrationOpen": False,
        "witnessCount": 148,
        "minutesSummary": "89th Legislature Reference Hearing: Committee heard invited and public testimony on public school finance allotments (HB 2), instructional materials oversight (HB 100), and career/military readiness metrics (HB 120).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://house.texas.gov/video-audio/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingshouse",
        "userNotes": "Baseline 89R reference hearing loaded while 90R committee schedules await January 2027 convening.",
        "notesUpdatedAt": "2025-03-11T18:30:00Z",
    },
    {
        "id": "cm-89r-2",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "House State Affairs",
        "chamber": "House",
        "meetingDate": "2025-03-19",
        "meetingTime": "10:30 AM",
        "location": "Room JHR 140, John H. Reagan Bldg",
        "status": "Adjourned",
        "agendaBills": ["HB 12", "HB 14", "HB 149", "HB 150"],
        "witnessRegistrationOpen": False,
        "witnessCount": 76,
        "minutesSummary": "89th Legislature Reference Hearing: Reviewed state agency operational audits (HB 12), nuclear energy development (HB 14), artificial intelligence governance (HB 149), and Texas Cyber Command creation (HB 150).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://house.texas.gov/video-audio/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingshouse",
        "userNotes": "",
    },
    {
        "id": "cm-89r-3",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "Senate Education K-16",
        "chamber": "Senate",
        "meetingDate": "2025-03-25",
        "meetingTime": "9:00 AM",
        "location": "Senate Chamber / E1.028",
        "status": "Adjourned",
        "agendaBills": ["HB 2", "HB 6", "HB 121"],
        "witnessRegistrationOpen": False,
        "witnessCount": 112,
        "minutesSummary": "89th Legislature Reference Hearing: Senate consideration of House public school finance (HB 2), student discipline & telehealth mental health services (HB 6), and school safety peace officers (HB 121).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://senate.texas.gov/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingssenate",
        "userNotes": "",
    },
    {
        "id": "cm-89r-4",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "House Ways & Means",
        "chamber": "House",
        "meetingDate": "2025-04-02",
        "meetingTime": "9:00 AM",
        "location": "Room E2.014, Capitol Extension",
        "status": "Adjourned",
        "agendaBills": ["HB 9", "HB 217"],
        "witnessRegistrationOpen": False,
        "witnessCount": 64,
        "minutesSummary": "89th Legislature Reference Hearing: Testimony on business personal property ad valorem exemptions (HB 9) and supermajority voter-approval tax rate thresholds (HB 217).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://house.texas.gov/video-audio/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingshouse",
        "userNotes": "Watch local school/municipal revenue preemption impacts during 90R Ways & Means equivalents.",
        "notesUpdatedAt": "2025-04-02T16:15:00Z",
    },
    {
        "id": "cm-89r-5",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "House Public Health",
        "chamber": "House",
        "meetingDate": "2025-04-08",
        "meetingTime": "8:30 AM",
        "location": "Room E2.012, Capitol Extension",
        "status": "Adjourned",
        "agendaBills": ["HB 26", "HB 37", "HB 46", "HB 198"],
        "witnessRegistrationOpen": False,
        "witnessCount": 91,
        "minutesSummary": "89th Legislature Reference Hearing: Testimony covering Medicaid nutrition supports (HB 26), perinatal bereavement hospital care (HB 37), compassionate low-THC cannabis administration (HB 46), and firefighter health screenings (HB 198).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://house.texas.gov/video-audio/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingshouse",
        "userNotes": "",
    },
    {
        "id": "cm-89r-6",
        "session": "89R",
        "eventType": "Floor Calendar",
        "committeeName": "House Daily Floor Calendar",
        "chamber": "House",
        "meetingDate": "2025-04-15",
        "meetingTime": "10:00 AM",
        "location": "House Chamber, Texas Capitol",
        "status": "Adjourned",
        "agendaBills": ["HB 2", "HB 6", "HB 9", "HB 12", "HB 14"],
        "witnessRegistrationOpen": False,
        "witnessCount": 0,
        "minutesSummary": "89th Legislature Floor Calendar: House floor debate and recorded second/third reading votes on major education finance, discipline, tax exemption, and energy infrastructure measures.",
        "noticeUrl": "https://capitol.texas.gov/Calendars/",
        "recordingUrl": "https://house.texas.gov/video-audio/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingcalendarshouse",
        "userNotes": "",
    },
    {
        "id": "cm-89r-7",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "House Judiciary & Civil Jurisprudence",
        "chamber": "House",
        "meetingDate": "2025-04-22",
        "meetingTime": "10:00 AM",
        "location": "Room E2.026, Capitol Extension",
        "status": "Adjourned",
        "agendaBills": ["HB 40", "HB 47"],
        "witnessRegistrationOpen": False,
        "witnessCount": 43,
        "minutesSummary": "89th Legislature Reference Hearing: Considered Texas Business Court jurisdiction (HB 40) and sexual assault statutory protections (HB 47).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://house.texas.gov/video-audio/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingshouse",
        "userNotes": "",
    },
    {
        "id": "cm-89r-8",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "Senate Health & Human Services",
        "chamber": "Senate",
        "meetingDate": "2025-04-29",
        "meetingTime": "8:30 AM",
        "location": "Senate Chamber / E1.016",
        "status": "Adjourned",
        "agendaBills": ["HB 26", "HB 37", "HB 46"],
        "witnessRegistrationOpen": False,
        "witnessCount": 68,
        "minutesSummary": "89th Legislature Reference Hearing: Senate committee review of House-passed Medicaid managed care nutrition support (HB 26), maternal bereavement care (HB 37), and low-THC program updates (HB 46).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://senate.texas.gov/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingssenate",
        "userNotes": "",
    },
    {
        "id": "cm-89r-9",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "Senate State Affairs",
        "chamber": "Senate",
        "meetingDate": "2025-05-06",
        "meetingTime": "9:00 AM",
        "location": "Senate Chamber / E1.036",
        "status": "Adjourned",
        "agendaBills": ["HB 12", "HB 33", "HB 149", "HB 150"],
        "witnessRegistrationOpen": False,
        "witnessCount": 54,
        "minutesSummary": "89th Legislature Reference Hearing: Senate consideration of agency sunset/audit bills (HB 12), active shooter response protocols (HB 33), AI regulation (HB 149), and Texas Cyber Command (HB 150).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://senate.texas.gov/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingssenate",
        "userNotes": "",
    },
    {
        "id": "cm-89r-10",
        "session": "89R",
        "eventType": "Floor Calendar",
        "committeeName": "Senate Intent Calendar",
        "chamber": "Senate",
        "meetingDate": "2025-05-14",
        "meetingTime": "11:00 AM",
        "location": "Senate Chamber, Texas Capitol",
        "status": "Adjourned",
        "agendaBills": ["HB 2", "HB 9", "HB 14", "HB 40"],
        "witnessRegistrationOpen": False,
        "witnessCount": 0,
        "minutesSummary": "89th Legislature Floor Calendar: Senate floor intent notice for House bills reported favorably out of Senate committees ahead of May statutory deadlines.",
        "noticeUrl": "https://capitol.texas.gov/Calendars/",
        "recordingUrl": "https://senate.texas.gov/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingcalendarssenate",
        "userNotes": "",
    },
    {
        "id": "cm-89r-11",
        "session": "89R",
        "eventType": "Committee Hearing",
        "committeeName": "Senate Finance",
        "chamber": "Senate",
        "meetingDate": "2025-05-19",
        "meetingTime": "9:00 AM",
        "location": "Room E1.036, Capitol Extension",
        "status": "Adjourned",
        "agendaBills": ["HB 9", "HB 198", "HB 217"],
        "witnessRegistrationOpen": False,
        "witnessCount": 49,
        "minutesSummary": "89th Legislature Reference Hearing: Fiscal impact and local tax exemption hearings on HB 9, firefighter screening mandates (HB 198), and local tax-rate elections (HB 217).",
        "noticeUrl": "https://capitol.texas.gov/Committees/",
        "recordingUrl": "https://senate.texas.gov/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingssenate",
        "userNotes": "",
    },
    {
        "id": "cm-89r-12",
        "session": "89R",
        "eventType": "Floor Calendar",
        "committeeName": "House Supplemental Local & Consent / Final Calendar",
        "chamber": "House",
        "meetingDate": "2025-05-24",
        "meetingTime": "9:00 AM",
        "location": "House Chamber, Texas Capitol",
        "status": "Adjourned",
        "agendaBills": ["HB 26", "HB 37", "HB 46", "HB 47", "HB 198"],
        "witnessRegistrationOpen": False,
        "witnessCount": 0,
        "minutesSummary": "89th Legislature Sine Die Push: Final House calendar concurrence and conference committee adoption window before adjournment.",
        "noticeUrl": "https://capitol.texas.gov/Calendars/",
        "recordingUrl": "https://house.texas.gov/video-audio/",
        "rssFeedUrl": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingcalendarshouse",
        "userNotes": "",
    },
]


def _rss_item_to_row(item: dict) -> tuple:
    return (
        item["id"],
        item["feedType"],
        item["feedLabel"],
        item.get("session", "90R"),
        item.get("chamber", "House"),
        item.get("billNumber"),
        item.get("title", ""),
        item.get("description", ""),
        item.get("link", ""),
        item.get("pubDate", ""),
        int(item.get("pubTimestamp") or 0),
        json.dumps(item, ensure_ascii=False),
    )


def upsert_rss_item(conn: sqlite3.Connection, item: dict) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO rss_items (
            id, feed_type, feed_label, session, chamber, bill_number,
            title, description, link, pub_date, pub_timestamp, item_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        _rss_item_to_row(item),
    )


def _meeting_to_row(meeting: dict) -> tuple:
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return (
        meeting["id"],
        meeting.get("session", "90R"),
        meeting.get("eventType", "Committee Hearing"),
        meeting.get("committeeName", ""),
        meeting.get("chamber", "House"),
        meeting.get("meetingDate", ""),
        meeting.get("meetingTime", ""),
        meeting.get("location", ""),
        meeting.get("status", "Scheduled"),
        json.dumps(meeting, ensure_ascii=False),
        now_iso,
    )


def upsert_committee_meeting(conn: sqlite3.Connection, meeting: dict) -> None:
    mid = meeting["id"]
    existing_row = conn.execute(
        "SELECT meeting_json FROM committee_meetings WHERE id = ?",
        (mid,),
    ).fetchone()
    merged = dict(meeting)
    if existing_row is not None:
        existing = json.loads(existing_row["meeting_json"])
        # Preserve operator notes and minutes if already saved
        if existing.get("userNotes") and not merged.get("userNotes"):
            merged["userNotes"] = existing["userNotes"]
        if existing.get("notesUpdatedAt") and not merged.get("notesUpdatedAt"):
            merged["notesUpdatedAt"] = existing["notesUpdatedAt"]
        if existing.get("minutesSummary") and not merged.get("minutesSummary"):
            merged["minutesSummary"] = existing["minutesSummary"]
        if existing.get("witnessCount") and not merged.get("witnessCount"):
            merged["witnessCount"] = existing["witnessCount"]

    conn.execute(
        """
        INSERT OR REPLACE INTO committee_meetings (
            id, session, event_type, committee_name, chamber, meeting_date,
            meeting_time, location, status, meeting_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        _meeting_to_row(merged),
    )


def update_meeting_notes(conn: sqlite3.Connection, meeting_id: str, user_notes: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT meeting_json FROM committee_meetings WHERE id = ?",
        (meeting_id,),
    ).fetchone()
    if row is None:
        return None
    meeting = json.loads(row["meeting_json"])
    meeting["userNotes"] = user_notes
    meeting["notesUpdatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conn.execute(
        """
        INSERT OR REPLACE INTO committee_meetings (
            id, session, event_type, committee_name, chamber, meeting_date,
            meeting_time, location, status, meeting_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        _meeting_to_row(meeting),
    )
    conn.commit()
    export_runtime_meetings(conn)
    return meeting


def export_runtime_rss(conn: Optional[sqlite3.Connection] = None) -> int:
    own_conn = conn is None
    if conn is None:
        conn = get_connection()
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        rows = conn.execute(
            "SELECT item_json FROM rss_items ORDER BY pub_timestamp DESC LIMIT 500"
        ).fetchall()
        items = [json.loads(r["item_json"]) for r in rows]
        tmp_path = RUNTIME_RSS_PATH + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, RUNTIME_RSS_PATH)
        return len(items)
    finally:
        if own_conn:
            conn.close()


def export_runtime_meetings(conn: Optional[sqlite3.Connection] = None) -> int:
    own_conn = conn is None
    if conn is None:
        conn = get_connection()
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        rows = conn.execute(
            "SELECT meeting_json FROM committee_meetings ORDER BY meeting_date DESC, id ASC"
        ).fetchall()
        meetings = [json.loads(r["meeting_json"]) for r in rows]
        tmp_path = RUNTIME_MEETINGS_PATH + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(meetings, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, RUNTIME_MEETINGS_PATH)
        return len(meetings)
    finally:
        if own_conn:
            conn.close()


def seed_default_meetings_and_rss(conn: sqlite3.Connection) -> None:
    """Populate initial 89R meetings/calendars and baseline RSS entries when empty."""
    meetings_count = conn.execute("SELECT COUNT(*) FROM committee_meetings").fetchone()[0]
    if meetings_count == 0:
        for m in DEFAULT_89R_MEETINGS:
            upsert_committee_meeting(conn, m)
        conn.commit()

    rss_count = conn.execute("SELECT COUNT(*) FROM rss_items").fetchone()[0]
    if rss_count == 0:
        r90_house = conn.execute(
            "SELECT bill_json FROM bills WHERE session = '90R' AND chamber = 'House' ORDER BY filed_timestamp DESC, bill_number ASC LIMIT 5"
        ).fetchall()
        r90_senate = conn.execute(
            "SELECT bill_json FROM bills WHERE session = '90R' AND chamber = 'Senate' ORDER BY filed_timestamp DESC, bill_number ASC LIMIT 5"
        ).fetchall()
        seed_items = []
        base_ts = int(time.time()) - 3600

        for idx, row in enumerate(r90_house):
            b = json.loads(row["bill_json"])
            seed_items.append({
                "id": f"seed-todaysfiledhouse-{b['id']}",
                "feedType": "todaysfiledhouse",
                "feedLabel": "House Filed",
                "session": "90R",
                "chamber": "House",
                "billNumber": b["billNumber"],
                "title": f"{b['billNumber']} by {b['author']} — Filed in House",
                "description": b.get("caption", ""),
                "link": b.get("officialTloUrl") or f"https://capitol.texas.gov/BillLookup/History.aspx?LegSess=90R&Bill={b['billNumber'].replace(' ', '')}",
                "pubDate": b.get("dateFiled", "2026-11-09"),
                "pubTimestamp": int(b.get("filedDateTimestamp") or base_ts) - idx * 60,
            })

        for idx, row in enumerate(r90_senate):
            b = json.loads(row["bill_json"])
            seed_items.append({
                "id": f"seed-todaysfiledsenate-{b['id']}",
                "feedType": "todaysfiledsenate",
                "feedLabel": "Senate Filed",
                "session": "90R",
                "chamber": "Senate",
                "billNumber": b["billNumber"],
                "title": f"{b['billNumber']} by {b['author']} — Filed in Senate",
                "description": b.get("caption", ""),
                "link": b.get("officialTloUrl") or f"https://capitol.texas.gov/BillLookup/History.aspx?LegSess=90R&Bill={b['billNumber'].replace(' ', '')}",
                "pubDate": b.get("dateFiled", "2026-11-09"),
                "pubTimestamp": int(b.get("filedDateTimestamp") or base_ts) - idx * 60,
            })

        for idx, row in enumerate((r90_house[:2] + r90_senate[:2])):
            b = json.loads(row["bill_json"])
            seed_items.append({
                "id": f"seed-todaysbilltext-{b['id']}",
                "feedType": "todaysbilltext",
                "feedLabel": "Bill Text",
                "session": "90R",
                "chamber": b.get("chamber", "House"),
                "billNumber": b["billNumber"],
                "title": f"{b['billNumber']} — Introduced Bill Text Available",
                "description": b.get("caption", ""),
                "link": b.get("officialTloUrl") or f"https://capitol.texas.gov/BillLookup/Text.aspx?LegSess=90R&Bill={b['billNumber'].replace(' ', '')}",
                "pubDate": b.get("dateFiled", "2026-11-09"),
                "pubTimestamp": int(b.get("filedDateTimestamp") or base_ts) - 300 - idx * 60,
            })

        # Reference entries for schedule/action RSS feeds awaiting 90R session start
        supplemental = [
            ("seed-upcomingmeetingshouse-1", "upcomingmeetingshouse", "House Meetings", "89R", "House", "HB 2",
             "House Public Education Hearing Notice (89R Reference)",
             "Official House committee hearing schedule feed. Monitoring https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingshouse for 90R notices.",
             "https://capitol.texas.gov/Committees/", "2025-03-11", base_ts - 900),
            ("seed-upcomingmeetingssenate-1", "upcomingmeetingssenate", "Senate Meetings", "89R", "Senate", "HB 12",
             "Senate State Affairs Hearing Notice (89R Reference)",
             "Official Senate committee hearing schedule feed. Monitoring https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingssenate for 90R notices.",
             "https://capitol.texas.gov/Committees/", "2025-05-06", base_ts - 960),
            ("seed-upcomingcalendarshouse-1", "upcomingcalendarshouse", "House Calendars", "89R", "House", "HB 2",
             "House Daily Floor Calendar (89R Reference)",
             "Official House floor calendar RSS monitor (upcomingcalendarshouse). Ready for 90R daily calendars.",
             "https://capitol.texas.gov/Calendars/", "2025-04-15", base_ts - 1020),
            ("seed-upcomingcalendarssenate-1", "upcomingcalendarssenate", "Senate Calendars", "89R", "Senate", "HB 9",
             "Senate Intent Calendar (89R Reference)",
             "Official Senate floor intent calendar RSS monitor (upcomingcalendarssenate). Ready for 90R intent calendars.",
             "https://capitol.texas.gov/Calendars/", "2025-05-14", base_ts - 1080),
            ("seed-todaysfiscalnotes-1", "todaysfiscalnotes", "Fiscal Notes", "89R", "House", "HB 2",
             "LBB Fiscal Note Reference — HB 2 (Public School Finance)",
             "Monitoring todaysfiscalnotes RSS feed for Legislative Budget Board five-year fiscal impact notes as committees consider 90R bills.",
             "https://capitol.texas.gov/BillLookup/FiscalNotes.aspx?LegSess=89R&Bill=HB2", "2025-05-20", base_ts - 1140),
            ("seed-todaysbillanalyses-1", "todaysbillanalyses", "Bill Analyses", "89R", "House", "HB 149",
             "House Research / Committee Bill Analysis — HB 149",
             "Monitoring todaysbillanalyses RSS feed for official committee and House Research Organization bill analyses.",
             "https://capitol.texas.gov/BillLookup/BillAnalyses.aspx?LegSess=89R&Bill=HB149", "2025-05-22", base_ts - 1200),
            ("seed-todaysbillspassed-1", "todaysbillspassed", "Passed Bills", "89R", "House", "HB 12",
             "Passed Chamber / Enrolled Reference — HB 12",
             "Monitoring todaysbillspassed RSS feed for bills passing the House or Senate chamber in the 90th Legislature.",
             "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=HB12", "2025-06-20", base_ts - 1260),
        ]
        for sid, ftype, flabel, sess, ch, bnum, title, desc, link, pdate, pts in supplemental:
            seed_items.append({
                "id": sid,
                "feedType": ftype,
                "feedLabel": flabel,
                "session": sess,
                "chamber": ch,
                "billNumber": bnum,
                "title": title,
                "description": desc,
                "link": link,
                "pubDate": pdate,
                "pubTimestamp": pts,
            })

        for item in seed_items:
            upsert_rss_item(conn, item)
        conn.commit()


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
        "officialTloUrl",
        "officialPdfUrl",
    ):
        val = bill.get(meta_key)
        if val not in (None, "", []):
            merged[meta_key] = val

    if bill.get("fiscalNote") and not existing.get("fiscalNote"):
        merged["fiscalNote"] = bill["fiscalNote"]
    if bill.get("billAnalysis") and not existing.get("billAnalysis"):
        merged["billAnalysis"] = bill["billAnalysis"]

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
    argv = sys.argv[1:]
    with get_connection() as connection:
        if len(argv) >= 2 and argv[0] == "--save-meeting-note":
            target_id = argv[1]
            note_text = argv[2] if len(argv) >= 3 else ""
            updated_meeting = update_meeting_notes(connection, target_id, note_text)
            if updated_meeting is None:
                # If meeting wasn't seeded yet, seed defaults and retry once
                seed_default_meetings_and_rss(connection)
                updated_meeting = update_meeting_notes(connection, target_id, note_text)
            if updated_meeting is None:
                print(json.dumps({"error": f"Meeting not found: {target_id}"}), file=sys.stderr)
                sys.exit(1)
            print(json.dumps(updated_meeting, ensure_ascii=False))
        else:
            args = set(argv)
            if "--init" in args or "--sync-seed" in args or not args:
                total_count = init_and_sync_seed(connection)
                exported_count = export_runtime_snapshot(connection)
                rss_count = export_runtime_rss(connection)
                meetings_count = export_runtime_meetings(connection)
                count_90r = connection.execute("SELECT COUNT(*) FROM bills WHERE session = '90R'").fetchone()[0]
                print(
                    f"✔ SQLite WAL store ready at {DB_PATH} "
                    f"({total_count} total bills, {count_90r} in 90R; "
                    f"snapshots: bills={exported_count}, rss={rss_count}, meetings={meetings_count})"
                )
