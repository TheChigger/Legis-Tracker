#!/usr/bin/env python3
"""
Texas Capitol Legislative Intelligence - Automated AI Bill Enrichment Pipeline
Evaluates newly filed and pending bills using local Ollama (model: llama3.1)
against the 7-domain legislative policy framework.
Runs automatically via cron at minute :30 of every hour.
"""

import os
import json
import re
import sys
import time
import urllib.request
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import db_store
from hydrate_real_full_texts import ensure_bill_full_text

PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
TEXT_CACHE_DIR = os.path.join(PROJECT_ROOT, "data", "bill_texts")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")
RUBRIC_VERSION = 2

POLITICAL_PRIORITIES_RUBRIC = """
# ROLE & OBJECTIVE
You are a Legislative Policy Analyst evaluating Texas state legislation (House and Senate bills, joint resolutions, and amendments) on behalf of a specific user. Read the bill caption, summary, and full text excerpt carefully to determine whether the user would SUPPORT, OPPOSE, or flag for NEEDS REVIEW.

# CORE POLITICAL IDENTITY & DEFAULT HEURISTIC
- Baseline Alignment: Texas Liberal Democrat.
- Default Heuristic: On standard partisan issues not detailed below (voting access, labor rights, environmental protection, reproductive freedom, consumer protection), support progressive/Democratic positions (SUPPORT) and oppose conservative restrictions or deregulation (OPPOSE).
- Critical Override: Do NOT blindly apply party-line assumptions to 2nd Amendment/Firearms or Taxation/Surplus Spending. Follow the nuanced rules below.
- Direction Check: Always check whether a bill ENACTS/EXPANDS a policy versus REPEALS/RESTRICTS it!
  * Repealing school vouchers / ESAs (e.g., "repeal of the education savings account program") -> SUPPORT.
  * Repealing mandatory Ten Commandments classroom displays -> SUPPORT.
  * Repealing immunization mandates -> OPPOSE.

# DOMAIN-SPECIFIC DECISION MATRIX
1. Separation of Church and State (STRICT PRIORITY):
   - OPPOSE: School vouchers/ESAs allowing public funds to private/religious schools; mandatory religious texts, Ten Commandments displays, prayer, or chaplains in public schools/buildings; religious exemptions allowing discrimination.
   - SUPPORT: Reinforcing secular public institutions and repealing state-sponsored religious mandates.

2. Public Education & School Funding:
   - SUPPORT: Basic Allotment increases, enrollment-based funding, teacher/staff pay raises, TRS COLAs, special education, free school meals, classroom supply accounts, and repealing vouchers/ESAs.
   - OPPOSE: Diverting public funds to private entities lacking public accountability, unfunded ISD mandates, library censorship, curriculum gag orders, or partisan ISD takeovers.

3. Civil Rights & LGBTQ+ / Transgender Policy:
   - OPPOSE: Bans/restrictions on gender-affirming care, trans sports/bathroom/drag bans, ID gender-marker restrictions, "Don't Say Gay/Trans" gags, forced outing.
   - SUPPORT: Non-discrimination protections covering sexual orientation and gender identity.

4. Healthcare, Medicare & Medicaid:
   - SUPPORT: ACA Medicaid expansion, public options, free clinics, postpartum Medicaid extension, CHIP expansion, rural hospitals, mental health, immunization awareness, and reproductive healthcare access.
   - OPPOSE: Medicaid work requirements, cuts, barriers to care, or repealing public health/immunization standards.

5. Transportation, Transit & Urban Infrastructure:
   - SUPPORT: Public transit, bus/light/commuter/intercity rail, protected bike lanes, Vision Zero pedestrian safety, sidewalks, trails, and multimodal TxDOT funding.
   - OPPOSE: Municipal preemption blocking cities from building bike lanes, lane reductions, or transit projects.

6. Taxation, Fiscal Policy & Budget Surplus (NUANCED RULE):
   - SUPPORT: Raising revenue IF funding tangible public goods (transit, healthcare, parks, schools, infrastructure); OR cutting taxes using the budget surplus IF providing genuine relief to working/middle-class Texans AND NOT starving schools/services.
   - OPPOSE: Tax cuts primarily for wealthy corporations, regressive sales tax swaps, abolishing local ad valorem school taxes outright, or state caps crippling local voter-approved service funding.
   - NEEDS REVIEW: Ambiguous tax-cut or surplus spending bills where fiscal trade-offs are unclear.

7. Second Amendment & Firearms (NUANCED RULE):
   - Respect lawful firearm ownership; do NOT auto-oppose every gun bill.
   - SUPPORT: Removing punitive fees on lawful owners; incentivizing safe storage (tax-free gun safes, voluntary training); keeping guns out of domestic abusers' hands; improving NICS reporting.
   - OPPOSE: Sweeping gun bans/confiscation OR reckless deregulation (guns in polling places, repealing child safe-storage penalties).
   - NEEDS REVIEW: Firearm bills mixing gun-rights protections with safety trade-offs.
"""


def load_bill_text_excerpt(bill: dict, max_chars: int = 4000) -> str:
    """Ensure full statutory text is cached from TLO HTTP/FTP and return an excerpt for Ollama."""
    full_text = ensure_bill_full_text(bill)
    if full_text and len(full_text.strip()) > 0:
        return full_text.strip()[:max_chars]
    return bill.get("caption", "")


def call_local_ollama(prompt: str, model: str = OLLAMA_MODEL) -> dict | None:
    """Send inference request to local Ollama daemon via native HTTP."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.1,
            "num_predict": 650
        }
    }

    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=data_bytes,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            raw_text = res_json.get("response", "").strip()
            clean_text = re.sub(r"^```json\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
            match = re.search(r"\{.*\}", clean_text, re.DOTALL)
            if match:
                clean_text = match.group(0)
            return json.loads(clean_text)
    except urllib.error.URLError as e:
        print(f"  [Ollama Connection Error] {e}. Is Ollama running on {OLLAMA_URL}?", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [Parse Error] {e}", file=sys.stderr)
        return None


def enrich_bill(bill: dict) -> dict:
    """Evaluate a single bill with llama3.1 using the 7-domain legislative rubric."""
    bill_number = bill.get("billNumber", "Unknown")
    caption = bill.get("caption", "")
    author = bill.get("author", "Unknown")
    text_excerpt = load_bill_text_excerpt(bill)

    prompt = f"""{POLITICAL_PRIORITIES_RUBRIC}

Evaluate this Texas bill and output STRICT valid JSON matching this schema:
{{
  "recommended_stance": "SUPPORT" or "OPPOSE" or "NEEDS REVIEW",
  "confidence": "High" or "Medium" or "Low",
  "priority_score": 1 to 5 (5 = landmark/immediate priority, 1 = routine administrative),
  "primary_category": "Short domain name (e.g. Church & State, Public Education, LGBTQ+ Rights, Healthcare & Medicaid, Transit & Infrastructure, Taxation & Fiscal Policy, Second Amendment, Voting & Labor)",
  "policy_triggers": ["1 to 3 specific policy principles triggered"],
  "what_it_does": ["2 to 3 concise plain-English bullet strings describing concrete legal/fiscal changes"],
  "reasoning": "Clear 2-3 sentence explanation of alignment, conflict, or nuanced trade-offs."
}}

Bill Number: {bill_number}
Author: {author}
Caption: {caption}
Statutory Text Excerpt:
{text_excerpt}
"""

    print(f"[{time.strftime('%X')}] Requesting Ollama ({OLLAMA_MODEL}) analysis for {bill_number}...")
    ai_result = call_local_ollama(prompt)

    if not ai_result:
        print(f"  -> Skipping {bill_number} due to inference failure.")
        return bill

    raw_rec = str(ai_result.get("recommended_stance", ai_result.get("stance", "NEEDS REVIEW"))).upper().strip()
    if raw_rec not in ("SUPPORT", "OPPOSE", "NEEDS REVIEW"):
        raw_rec = "NEEDS REVIEW" if "REVIEW" in raw_rec or "NEUTRAL" in raw_rec else "NEEDS REVIEW"

    # Map NEEDS REVIEW -> NEUTRAL in database stance field while preserving recommendedStance
    db_stance = raw_rec if raw_rec in ("SUPPORT", "OPPOSE") else "NEUTRAL"

    confidence = str(ai_result.get("confidence", "Medium")).capitalize()
    if confidence not in ("High", "Medium", "Low"):
        confidence = "Medium"

    try:
        priority_score = max(1, min(5, int(ai_result.get("priority_score", 2))))
    except (ValueError, TypeError):
        priority_score = 2

    what_it_does = ai_result.get("what_it_does") or []
    if isinstance(what_it_does, str):
        what_it_does = [what_it_does]
    summary = " ".join(str(x).strip() for x in what_it_does if x) or ai_result.get("summary") or caption

    category = ai_result.get("primary_category", bill.get("primaryCategory", "State Affairs"))
    triggers = ai_result.get("policy_triggers") or []
    if isinstance(triggers, str):
        triggers = [triggers]
    reason = ai_result.get("reasoning", ai_result.get("comport_conflict_reason", ""))

    bill["stance"] = db_stance
    bill["recommendedStance"] = raw_rec
    bill["confidence"] = confidence
    bill["priorityScore"] = priority_score
    bill["summary"] = summary
    bill["whatItDoes"] = [str(x).strip() for x in what_it_does if x]
    bill["policyTriggers"] = [str(x).strip() for x in triggers if x]
    bill["primaryCategory"] = category
    bill["aiEnriched"] = True
    bill["aiRubricVersion"] = RUBRIC_VERSION
    bill["aiEnrichedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
    bill["urgencyLevel"] = "Immediate Attention" if priority_score == 5 else ("High Watch" if priority_score == 4 else ("Moderate" if priority_score == 3 else "Routine"))

    if reason:
        alignment_type = "COMPORTS" if db_stance == "SUPPORT" else ("CONFLICTS" if db_stance == "OPPOSE" else "NEUTRAL")
        bill["comportConflict"] = [{
            "priorityId": "ai-eval",
            "priorityName": ", ".join(bill["policyTriggers"]) if bill["policyTriggers"] else category,
            "alignment": alignment_type,
            "impactExplanation": reason
        }]

    print(f"  ✔ {bill_number}: {raw_rec} ({confidence}, Score: {priority_score}/5) - {category}")
    return bill


def run_enrichment_batch(max_bills: int = 15, force_re_enrich: bool = False):
    """Process a batch of un-enriched or outdated-rubric bills with row-by-row SQLite commits."""
    print(f"=== Texas Capitol AI Bill Enrichment (Rubric v{RUBRIC_VERSION}) Started at {time.strftime('%Y-%m-%d %H:%M:%S')} ===")
    print(f"Target Database: {db_store.DB_PATH} (WAL Mode)")
    print(f"Ollama Endpoint: {OLLAMA_URL} (Model: {OLLAMA_MODEL})")

    conn = db_store.get_connection()
    try:
        db_store.init_and_sync_seed(conn)
        bills = db_store.load_all_bills(conn)

        def needs_eval(b: dict) -> bool:
            if force_re_enrich:
                return True
            return not b.get("aiEnriched", False) or b.get("aiRubricVersion", 1) < RUBRIC_VERSION

        pending_90r = [b for b in bills if b.get("session") == "90R" and needs_eval(b)]
        print(f"Found {len(pending_90r)} 90R bills pending Rubric v{RUBRIC_VERSION} analysis.")

        if not pending_90r:
            pending_90r = [b for b in bills if needs_eval(b)]

        batch = pending_90r[:max_bills]
        if not batch:
            print("All bills are already enriched under the active rubric.")
            return

        enriched_count = 0
        for bill in batch:
            enrich_bill(bill)
            db_store.upsert_enriched_bill(conn, bill)
            enriched_count += 1
            if enriched_count % 5 == 0:
                db_store.export_runtime_snapshot(conn)
            time.sleep(0.3)

        db_store.export_runtime_snapshot(conn)
        print(f"=== Completed AI Enrichment of {enriched_count} bills at {time.strftime('%X')} ===")
    finally:
        conn.close()


if __name__ == "__main__":
    force_flag = "--re-enrich" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    batch_size = int(args[0]) if args else 15
    run_enrichment_batch(batch_size, force_re_enrich=force_flag)
