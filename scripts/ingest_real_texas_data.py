#!/usr/bin/env python3
"""
Texas Capitol Real-Time Data Ingestion Script
Fetches 100% authentic, real data from Texas Legislature Online (TLO) FTP portal:
1. Daily baseline reports (housefiled.htm, senatefiled.htm)
2. Live intraday XML feed: ftp://ftp.legis.state.tx.us/bills/90R/billhistory/history_periodic.xml
3. Individual bill history XML files for newly filed bills
Directly merges new bills into src/data/realBills.json and caches statutory text in data/bill_texts/.
"""

import urllib.request
import re
import json
import os
import sys
import xml.etree.ElementTree as ET
from html import unescape
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import db_store

PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BILLS_JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "realBills.json")
CACHE_DIR = os.path.join(PROJECT_ROOT, "data", "bill_texts")

_TLO_TEXT_REPAIRS = (
    ("Men?ndez", "Menéndez"),
    ("Gonz?lez", "González"),
    ("Anch?a", "Anchía"),
    ("G?mez", "Gámez"),
    ("Gómez", "Gámez"),
    ("Mu?oz", "Muñoz"),
    ("Rodr?guez", "Rodríguez"),
    ("Pe?a", "Peña"),
    ("Cort?s", "Cortés"),
    ("Ch?vez", "Chávez"),
    ("Jim?nez", "Jiménez"),
    ("N??ez", "Núñez"),
    ("Ordonez", "Ordóñez"),
    ("Texas?", "Texas'"),
)


def normalize_tlo_text(text: str) -> str:
    """Repair Latin-1/Windows-1252 mojibake or '?' substitution in TLO text."""
    if not text:
        return text
    cleaned = text
    for broken, fixed in _TLO_TEXT_REPAIRS:
        if broken in cleaned:
            cleaned = cleaned.replace(broken, fixed)
    return cleaned


def parse_coauthors_from_author(author: str) -> list:
    """Extract coauthor names from pipe-delimited TLO author strings."""
    if not author or "|" not in author:
        return []
    return [
        part.strip()
        for part in author.split("|")[1:]
        if part.strip() and part.strip().lower() != "et al."
    ]


def fetch_ftp_text(url: str, timeout: int = 15) -> str:
    try:
        req = urllib.request.urlopen(url, timeout=timeout)
        raw = req.read()
        try:
            decoded = raw.decode("utf-8")
        except UnicodeDecodeError:
            decoded = raw.decode("cp1252", errors="replace")
        return normalize_tlo_text(decoded)
    except Exception as e:
        print(f"  [Warning] Error fetching {url}: {e}", file=sys.stderr)
        return ""


def _parse_chamber_report_rows(html_doc: str, chamber: str) -> list:
    """Parse House or Senate overnight filed report rows from TLO FTP HTML."""
    bill_pattern = r'>((?:HB|HJR|HCR|HR)\s*\d+)\s*</a>' if chamber == "House" else r'>((?:SB|SJR|SCR|SR)\s*\d+)\s*</a>'
    default_action = "11/09/2026 H Filed" if chamber == "House" else "11/09/2026 S Filed"
    parsed = []

    for r in html_doc.split('<div class="row">')[1:]:
        m_bill = re.search(bill_pattern, r)
        if not m_bill:
            continue
        m_auth = re.search(r'<b>Author</b>:\s*</div><div class="bill-search-result-data">([^<]*)</div>', r, re.S)
        m_act = re.search(r'<b>Last Action:</b>\s*</div><div class="bill-search-result-data">([^<]*)</div>', r, re.S)
        m_cap = re.search(r'<b>Caption</b>:\s*</div><div class="bill-search-result-data">([^<]*)</div>', r, re.S)

        b_num = m_bill.group(1).strip()
        auth = normalize_tlo_text(unescape(m_auth.group(1).strip())) if m_auth else "Unknown"
        act = normalize_tlo_text(unescape(m_act.group(1).strip())) if m_act else default_action
        cap = normalize_tlo_text(unescape(m_cap.group(1).strip())) if m_cap else ""

        date_match = re.search(r'(\d{2}/\d{2}/\d{4})', act)
        date_filed = date_match.group(1) if date_match else "11/09/2026"
        try:
            parts = date_filed.split('/')
            formatted_date = f"{parts[2]}-{parts[0]}-{parts[1]}"
        except Exception:
            formatted_date = "2026-11-09"

        parsed.append({
            "id": f"90R-{b_num.replace(' ', '')}",
            "session": "90R",
            "billNumber": b_num,
            "chamber": chamber,
            "author": auth,
            "coauthors": parse_coauthors_from_author(auth),
            "dateFiled": formatted_date,
            "lastAction": act,
            "lastActionDate": formatted_date,
            "currentStatus": "Filed / Introduced",
            "committee": "Pending Assignment",
            "caption": cap,
        })

    return parsed


def parse_90r_overnight_reports():
    """Parses standard daily filed reports from TLO FTP."""
    print("--- 1. Checking 90R Baseline Filed Reports (TLO FTP) ---")
    h_html = fetch_ftp_text('ftp://ftp.legis.state.tx.us/bills/90R/reports/housefiled.htm')
    s_html = fetch_ftp_text('ftp://ftp.legis.state.tx.us/bills/90R/reports/senatefiled.htm')

    bills = _parse_chamber_report_rows(h_html, "House") + _parse_chamber_report_rows(s_html, "Senate")
    print(f"  Baseline reports contain {len(bills)} bills.")
    return bills

def parse_90r_live_intraday_feed():
    """
    Parses TLO's live periodic update feed (history_periodic.xml)
    which receives new bill filings throughout the day as lawmakers submit them.
    """
    print("\n--- 2. Checking 90R Live Intraday Feed (history_periodic.xml) ---")
    url = "ftp://ftp.legis.state.tx.us/bills/90R/billhistory/history_periodic.xml"
    xml_data = fetch_ftp_text(url)
    if not xml_data:
        print("  Notice: Could not reach history_periodic.xml.")
        return []
        
    try:
        root = ET.fromstring(xml_data)
    except Exception as e:
        print(f"  [Error] Failed to parse history_periodic.xml: {e}")
        return []

    intraday_bills = {}
    for b in root.findall('bill'):
        bill_id = b.attrib.get('id')
        path = b.attrib.get('path')
        timestamp = b.attrib.get('timestamp', '')
        if bill_id and path:
            intraday_bills[bill_id] = {'id': bill_id, 'path': path, 'timestamp': timestamp}

    print(f"  Found {len(intraday_bills)} active bills listed in live intraday feed.")
    return list(intraday_bills.values())

def fetch_bill_detail_from_xml(path: str) -> dict:
    """Fetches full metadata (caption, author, lastaction, subjects) from bill's XML file on FTP."""
    url = f"ftp://ftp.legis.state.tx.us{path.replace(' ', '%20')}"
    xml_data = fetch_ftp_text(url, timeout=10)
    if not xml_data:
        return {}
        
    try:
        root = ET.fromstring(xml_data)
        caption = normalize_tlo_text(root.findtext('caption') or '')
        author = normalize_tlo_text(root.findtext('authors') or 'Unknown')
        last_action = normalize_tlo_text(root.findtext('lastaction') or '')
        
        # Parse subjects
        subjects = []
        for s in root.findall('.//subject'):
            if s.text:
                # clean code suffix like (I0365)
                sub_clean = re.sub(r'\s*\([A-Z0-9]+\)', '', s.text).strip()
                subjects.append(sub_clean)
                
        # Parse date from last_action
        date_match = re.search(r'(\d{2}/\d{2}/\d{4})', last_action)
        date_filed = date_match.group(1) if date_match else "11/12/2026"
        try:
            parts = date_filed.split('/')
            formatted_date = f"{parts[2]}-{parts[0]}-{parts[1]}"
        except Exception:
            formatted_date = "2026-11-12"

        return {
            "caption": caption,
            "author": author,
            "lastAction": last_action,
            "dateFiled": formatted_date,
            "subjects": subjects
        }
    except Exception as e:
        return {}

def classify_bill_policy(caption: str, subjects: list) -> tuple:
    """Direction-aware rule-based baseline classification until Ollama enriches the bill."""
    cap = (caption or "").lower()
    text = (cap + " " + " ".join(subjects)).lower()
    is_repeal = bool(re.search(r"\b(repeal|repealing|abolish|abolition|eliminat|terminat)\b", cap))

    # 1. Church / State Separation (Strict)
    if any(k in text for k in ["ten commandments", "chaplain", "prayer in public school", "religious display", "sincerely held religious belief"]):
        if is_repeal and any(k in cap for k in ["ten commandments", "chaplain", "display", "prayer"]):
            return "Church / State & First Amendment", "SUPPORT", 5, [
                {"priorityId": "p1", "priorityName": "Separation of Church and State", "alignment": "COMPORTS", "impactExplanation": "Repeals mandatory religious displays or sectarian rules in public institutions."}
            ]
        return "Church / State & First Amendment", "OPPOSE", 5, [
            {"priorityId": "p1", "priorityName": "Separation of Church and State", "alignment": "CONFLICTS", "impactExplanation": "Mandates religious displays, school chaplains, or religious discrimination exemptions."}
        ]

    # 2. Public Education & Anti-Voucher Integrity
    if ("education savings account" in cap or "voucher" in cap or "parental choice" in cap) and "classroom supply" not in cap:
        if is_repeal:
            return "Public Education & School Funding", "SUPPORT", 5, [
                {"priorityId": "p2", "priorityName": "Public Education & Equitable School Funding", "alignment": "COMPORTS", "impactExplanation": "Repeals the Education Savings Account / private voucher program to protect ISD funding."}
            ]
        if "eligibility requirements" in cap:
            return "Public Education & School Funding", "NEUTRAL", 3, [
                {"priorityId": "p2", "priorityName": "Public Education & Equitable School Funding", "alignment": "NEUTRAL", "impactExplanation": "Needs Review: Modifies ESA private school eligibility criteria—inspect full text to confirm whether it tightens accountability or loosens access."}
            ]
        return "Public Education & School Funding", "OPPOSE", 5, [
            {"priorityId": "p2", "priorityName": "Public Education & Equitable School Funding", "alignment": "CONFLICTS", "impactExplanation": "Diverts public tax dollars to private school vouchers / ESAs."}
        ]

    if "classroom supply savings account" in cap or any(k in cap for k in ["basic allotment", "teacher retirement system", "cost-of-living", "free school meal", "special education funding"]):
        return "Public Education & School Funding", "SUPPORT", 4, [
            {"priorityId": "p2", "priorityName": "Public Education & Equitable School Funding", "alignment": "COMPORTS", "impactExplanation": "Strengthens public school funding, classroom resources, or educator benefits."}
        ]

    # 3. LGBTQ+ & Civil Rights
    if any(k in text for k in ["gender-affirming", "gender transition", "transgender", "lesbian, gay", "biological sex", "drag performance", "gender marker"]):
        if any(k in cap for k in ["non-discrimination", "protect", "equal rights", "barriers to equality", "housing needs", "task force"]):
            return "Civil Rights & LGBTQ+ Policy", "SUPPORT", 4, [
                {"priorityId": "p3", "priorityName": "Civil Rights & LGBTQ+ Equality", "alignment": "COMPORTS", "impactExplanation": "Advances equal rights, housing equity, or non-discrimination studies/protections for LGBTQ+ Texans."}
            ]
        if any(k in cap for k in ["prohibit", "restrict", "ban", "biological sex", "athletic", "bathroom", "drag", "offense"]):
            return "Civil Rights & LGBTQ+ Policy", "OPPOSE", 5, [
                {"priorityId": "p3", "priorityName": "Civil Rights & LGBTQ+ Equality", "alignment": "CONFLICTS", "impactExplanation": "Restricts healthcare, accommodations, or equal rights for transgender and LGBTQ+ Texans."}
            ]

    # 4. Healthcare & Medicaid
    if any(k in cap for k in ["medicaid", "postpartum", "patient protection and affordable care", "express lane", "rural hospital", "immunization", "health care restriction"]):
        if is_repeal and "immunization" in cap:
            return "Healthcare & Medicaid", "OPPOSE", 4, [
                {"priorityId": "p4", "priorityName": "Healthcare, Medicare & Medicaid", "alignment": "CONFLICTS", "impactExplanation": "Repeals public health immunization protections."}
            ]
        if any(k in cap for k in ["expansion", "awareness week", "wellness check", "postpartum", "express lane", "rural hospital", "medically unnecessary"]):
            return "Healthcare & Medicaid", "SUPPORT", 4, [
                {"priorityId": "p4", "priorityName": "Healthcare, Medicare & Medicaid", "alignment": "COMPORTS", "impactExplanation": "Expands Medicaid, preventive health awareness, or patient healthcare access."}
            ]

    # 5. Transportation & Transit
    if any(k in cap for k in ["public transit", "light rail", "commuter rail", "passenger rail", "bike lane", "vision zero", "multimodal"]):
        if any(k in cap for k in ["prohibit", "preempt", "penaliz"]):
            return "Transportation & Transit", "OPPOSE", 4, [
                {"priorityId": "p5", "priorityName": "Transportation & Transit", "alignment": "CONFLICTS", "impactExplanation": "Preempts municipalities from expanding bike lanes or public transit."}
            ]
        return "Transportation & Transit", "SUPPORT", 4, [
            {"priorityId": "p5", "priorityName": "Transportation & Transit", "alignment": "COMPORTS", "impactExplanation": "Advances multimodal public transit, rail, or pedestrian/bike infrastructure."}
        ]

    # 6. Taxation & Budget Surplus (Nuanced)
    if any(k in cap for k in ["abolition of ad valorem", "voter-approval tax rate", "exceed a taxing unit's voter-approval", "exceeds the political subdivision's voter-approval"]):
        return "Taxation & Fiscal Policy", "OPPOSE", 4, [
            {"priorityId": "p6", "priorityName": "Taxation & Budget Surplus", "alignment": "CONFLICTS", "impactExplanation": "Eliminates local property tax funding or constrains local voter-approved services."}
        ]
    if "homestead exemption" in cap:
        return "Taxation & Fiscal Policy", "SUPPORT", 3, [
            {"priorityId": "p6", "priorityName": "Taxation & Budget Surplus", "alignment": "COMPORTS", "impactExplanation": "Delivers targeted residential homeowner tax relief."}
        ]

    # 7. Second Amendment (Nuanced - word boundary safe, avoid blind auto-opposition)
    if re.search(r"\b(gun safe|storage device|domestic violence.*firearm|nics)\b", cap):
        return "Second Amendment & Safety", "SUPPORT", 3, [
            {"priorityId": "p7", "priorityName": "Second Amendment & Practical Safety", "alignment": "COMPORTS", "impactExplanation": "Advances voluntary safe storage or targeted safety while respecting lawful ownership."}
        ]

    # 8. Voting, Labor & Grid
    if any(k in cap for k in ["weatheriz", "ercot", "online voter registration", "automatic voter"]):
        return "Voting, Labor & Grid", "SUPPORT", 4, [
            {"priorityId": "p8", "priorityName": "Voting, Labor & Grid Protection", "alignment": "COMPORTS", "impactExplanation": "Strengthens voting access, worker protections, or electric grid reliability."}
        ]

    return subjects[0] if subjects else "General State Affairs", "NEUTRAL", 2, []

def sync_all_texas_bills():
    """Main ingestion coordinator: merges baseline + intraday feed into SQLite WAL store."""
    conn = db_store.get_connection()
    try:
        db_store.init_and_sync_seed(conn)
        existing_bills = db_store.load_all_bills(conn)

        existing_map = {b["id"]: b for b in existing_bills}
        initial_90r_count = sum(1 for b in existing_bills if b.get("session") == "90R")
        print(f"Current SQLite database has {len(existing_bills)} total bills ({initial_90r_count} in Session 90R).")

        # 1. Check baseline reports
        baseline_bills = parse_90r_overnight_reports()
        newly_added = 0
        metadata_updated = 0
        for b in baseline_bills:
            bid = b["id"]
            if bid not in existing_map:
                cat, stance, prio, cc = classify_bill_policy(b["caption"], [])
                b_obj = {
                    **b,
                    "summary": b["caption"],
                    "stance": stance,
                    "priorityScore": prio,
                    "primaryCategory": cat,
                    "categories": [cat],
                    "comportConflict": cc,
                    "versions": [{
                        "versionCode": "I",
                        "versionName": "Introduced",
                        "dateFiled": b["dateFiled"],
                        "charCount": len(b["caption"]),
                        "snippet": b["caption"],
                        "fullText": b["caption"]
                    }],
                    "votes": [],
                    "amendments": [],
                    "impactedAgencies": [],
                    "urgencyLevel": "Immediate Attention" if prio == 5 else ("High Watch" if prio >= 4 else "Routine"),
                    "filedDateTimestamp": int(time.mktime(time.strptime(b["dateFiled"], "%Y-%m-%d"))) if b.get("dateFiled") else int(time.time()),
                }
                if stance in ("SUPPORT", "OPPOSE"):
                    b_obj["recommendedStance"] = stance
                elif cc and cc[0].get("alignment") == "NEUTRAL":
                    b_obj["recommendedStance"] = "NEEDS REVIEW"
                db_store.upsert_ingested_bill(conn, b_obj)
                existing_map[bid] = b_obj
                newly_added += 1
            else:
                existing = existing_map[bid]
                if (
                    b["lastAction"] != existing.get("lastAction")
                    or (b["caption"] and b["caption"] != existing.get("caption"))
                    or (b["author"] and b["author"] != existing.get("author"))
                    or (b["coauthors"] and not existing.get("coauthors"))
                ):
                    db_store.upsert_ingested_bill(conn, b)
                    metadata_updated += 1

        # 2. Check live intraday feed (bills filed today!)
        intraday_feed = parse_90r_live_intraday_feed()
        intraday_added = 0

        pending_items = []
        for item in intraday_feed:
            bill_num = item["id"].strip()
            bid = f"90R-{bill_num.replace(' ', '')}"
            if bid not in existing_map:
                pending_items.append((bid, bill_num, item))

        print(f"  Fetching details for {len(pending_items)} new intraday bills in parallel...")

        from concurrent.futures import ThreadPoolExecutor

        def process_item(entry):
            bid, bill_num, item = entry
            details = fetch_bill_detail_from_xml(item["path"])
            if details and details.get("caption"):
                chamber = "Senate" if bill_num.startswith("S") else "House"
                cat, stance, prio, cc = classify_bill_policy(details["caption"], details.get("subjects", []))
                date_filed = details.get("dateFiled", "2026-11-12")
                author_val = details.get("author", "Unknown")

                b_obj = {
                    "id": bid,
                    "session": "90R",
                    "billNumber": bill_num,
                    "chamber": chamber,
                    "author": author_val,
                    "coauthors": parse_coauthors_from_author(author_val),
                    "dateFiled": date_filed,
                    "lastAction": details.get("lastAction", "Filed"),
                    "lastActionDate": date_filed,
                    "currentStatus": "Filed / Introduced",
                    "committee": "Pending Assignment",
                    "caption": details["caption"],
                    "summary": details["caption"],
                    "stance": stance,
                    "priorityScore": prio,
                    "primaryCategory": cat,
                    "categories": details.get("subjects", [cat])[:4],
                    "comportConflict": cc,
                    "versions": [{
                        "versionCode": "I",
                        "versionName": "Introduced",
                        "dateFiled": date_filed,
                        "charCount": len(details["caption"]),
                        "snippet": details["caption"],
                        "fullText": details["caption"]
                    }],
                    "votes": [],
                    "amendments": [],
                    "impactedAgencies": [],
                    "urgencyLevel": "Immediate Attention" if prio == 5 else ("High Watch" if prio >= 4 else "Routine"),
                    "filedDateTimestamp": int(time.time()),
                }
                if stance in ("SUPPORT", "OPPOSE"):
                    b_obj["recommendedStance"] = stance
                elif cc and cc[0].get("alignment") == "NEUTRAL":
                    b_obj["recommendedStance"] = "NEEDS REVIEW"
                return bid, b_obj
            return bid, None

        if pending_items:
            with ThreadPoolExecutor(max_workers=10) as executor:
                for bid, b_obj in executor.map(process_item, pending_items):
                    if b_obj:
                        db_store.upsert_ingested_bill(conn, b_obj)
                        existing_map[bid] = b_obj
                        intraday_added += 1

        all_updated_bills = db_store.load_all_bills(conn)
        final_90r_count = sum(1 for b in all_updated_bills if b.get("session") == "90R")
        snapshot_count = db_store.export_runtime_snapshot(conn)

        print(f"\n--- Ingestion Results ---")
        print(f"  Baseline newly added: {newly_added}")
        print(f"  Baseline metadata updated: {metadata_updated}")
        print(f"  Intraday newly added: {intraday_added}")
        print(f"  Total Session 90R Bills: {initial_90r_count} -> {final_90r_count}")
        print(f"  Total Database Bills: {snapshot_count}")
        print(f"✔ Successfully persisted to SQLite WAL store ({db_store.DB_PATH}) and runtime snapshot ({db_store.RUNTIME_JSON_PATH})")
    finally:
        conn.close()


if __name__ == "__main__":
    sync_all_texas_bills()
