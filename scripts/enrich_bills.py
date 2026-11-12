#!/usr/bin/env python3
"""
Texas Capitol Legislative Intelligence - Automated AI Bill Enrichment Pipeline
Evaluates newly filed and pending bills using local Ollama (model: llama3.1)
against user policy priorities (Church/State, Public Education, Healthcare, Grid).
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
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BILLS_JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "realBills.json")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")

POLITICAL_PRIORITIES_RUBRIC = """
You are a senior legislative analyst evaluating Texas Legislature legislation against specific policy goals:

1. CHURCH / STATE SEPARATION & RELIGIOUS NEUTRALITY:
   - SUPPORT: Bills preserving secular public governance, religious freedom, preventing state-mandated creeds.
   - OPPOSE: Bills mandating Ten Commandments, religious chaplains replacing certified counselors, bible reading mandates in public schools.

2. PUBLIC EDUCATION & ANTI-VOUCHER INTEGRITY:
   - SUPPORT: Increases to the basic student allotment, teacher retention pay, public school funding.
   - OPPOSE: Education Savings Accounts (ESAs), vouchers diverting public tax dollars to private or religious academies.

3. HEALTHCARE ACCESS & MATERNAL HEALTH:
   - SUPPORT: 12-month postpartum Medicaid expansion, rural hospital funding, healthcare affordability.
   - OPPOSE: Restrictions on patient care, reductions in Medicaid, repeals of public health standards.

4. ELECTRIC GRID WEATHERIZATION & RATEPAYER PROTECTION:
   - SUPPORT: Mandatory winterization of gas lines and power plants, consumer rate protection, independent oversight.
   - OPPOSE: Regressive consumer surcharges, rolling back weatherization mandates.

5. VOTING RIGHTS & CIVIC ACCESS:
   - SUPPORT: Expanding early voting windows, online voter registration, protecting ballot access.
   - OPPOSE: Stricter mail-in ballot rejections, cutting polling locations, voter suppression.
"""

def call_local_ollama(prompt: str, model: str = OLLAMA_MODEL) -> dict | None:
    """Send inference request to local Ollama daemon via native HTTP."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.1,
            "num_predict": 512
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
            
            # Clean markdown codeblocks if Ollama includes them
            clean_text = re.sub(r"^```json\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
            return json.loads(clean_text)
    except urllib.error.URLError as e:
        print(f"  [Ollama Connection Error] {e}. Is Ollama running on {OLLAMA_URL}?", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [Parse Error] {e}", file=sys.stderr)
        return None

def enrich_bill(bill: dict) -> dict:
    """Evaluate a single bill with llama3.1."""
    bill_number = bill.get("billNumber", "Unknown")
    caption = bill.get("caption", "")
    author = bill.get("author", "Unknown")
    
    prompt = f"""{POLITICAL_PRIORITIES_RUBRIC}

Analyze this Texas bill and output STRICT valid JSON matching this schema:
{{
  "summary": "2-3 sentence executive policy summary of what the statutory change does.",
  "stance": "SUPPORT" or "OPPOSE" or "NEUTRAL",
  "priority_score": 1 to 5 (5 being landmark priority, 1 being routine administrative),
  "primary_category": "Short topic category (e.g. Public Education, Church/State, Healthcare, Grid, Tax)",
  "comport_conflict_reason": "One clear sentence explaining why this bill comports or conflicts with the user's goals."
}}

Bill Number: {bill_number}
Author: {author}
Caption: {caption}
"""

    print(f"[{time.strftime('%X')}] Requesting Ollama ({OLLAMA_MODEL}) analysis for {bill_number}...")
    ai_result = call_local_ollama(prompt)
    
    if not ai_result:
        print(f"  -> Skipping {bill_number} due to inference failure.")
        return bill
        
    # Update bill fields
    stance = ai_result.get("stance", "NEUTRAL").upper()
    if stance not in ["SUPPORT", "OPPOSE", "NEUTRAL"]:
        stance = "NEUTRAL"
        
    priority_score = ai_result.get("priority_score", 2)
    try:
        priority_score = max(1, min(5, int(priority_score)))
    except (ValueError, TypeError):
        priority_score = 2
        
    summary = ai_result.get("summary", bill.get("summary", caption))
    category = ai_result.get("primary_category", bill.get("primaryCategory", "State Affairs"))
    reason = ai_result.get("comport_conflict_reason", "")
    
    bill["stance"] = stance
    bill["priorityScore"] = priority_score
    bill["summary"] = summary
    bill["primaryCategory"] = category
    bill["aiEnriched"] = True
    bill["aiEnrichedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
    
    if reason:
        alignment_type = "COMPORTS" if stance == "SUPPORT" else ("CONFLICTS" if stance == "OPPOSE" else "NEUTRAL")
        bill["comportConflict"] = [{
            "priorityId": "ai-eval",
            "priorityName": category,
            "alignment": alignment_type,
            "impactExplanation": reason
        }]
        
    print(f"  ✔ {bill_number}: {stance} (Score: {priority_score}/5) - {category}")
    return bill

def run_enrichment_batch(max_bills: int = 15):
    """Process a batch of un-enriched bills (default 15 per hourly run)."""
    if not os.path.exists(BILLS_JSON_PATH):
        print(f"[Error] Database not found at {BILLS_JSON_PATH}", file=sys.stderr)
        return

    print(f"=== Texas Capitol AI Bill Enrichment Started at {time.strftime('%Y-%m-%d %H:%M:%S')} ===")
    print(f"Target Database: {BILLS_JSON_PATH}")
    print(f"Ollama Endpoint: {OLLAMA_URL} (Model: {OLLAMA_MODEL})")
    
    with open(BILLS_JSON_PATH, "r", encoding="utf-8") as f:
        bills = json.load(f)
        
    # Find bills in current 90R prefiling or un-enriched bills
    unenriched_90r = [b for b in bills if b.get("session") == "90R" and not b.get("aiEnriched", False)]
    print(f"Found {len(unenriched_90r)} unenriched 90R bills pending analysis.")
    
    if not unenriched_90r:
        print("All active 90R bills have already been enriched! Checking other sessions...")
        unenriched_90r = [b for b in bills if not b.get("aiEnriched", False)]
        
    batch = unenriched_90r[:max_bills]
    if not batch:
        print("No pending bills to enrich.")
        return

    enriched_count = 0
    for bill in batch:
        enrich_bill(bill)
        enriched_count += 1
        time.sleep(0.5) # Gentle pacing
        
    # Atomic save to realBills.json
    tmp_path = BILLS_JSON_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(bills, f, indent=2)
    os.replace(tmp_path, BILLS_JSON_PATH)
    
    print(f"=== Completed AI Enrichment of {enriched_count} bills at {time.strftime('%X')} ===")

if __name__ == "__main__":
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 15
    run_enrichment_batch(batch_size)
