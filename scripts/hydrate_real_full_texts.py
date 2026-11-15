#!/usr/bin/env python3
"""
Texas Capitol Document & Full Text Hydrator
Fetches authentic, un-truncated statutory text directly from Texas Legislature Online (TLO),
extracts amended Texas Codes/Statutes with direct links to statutes.capitol.texas.gov,
and updates realBills.json and local text cache in data/bill_texts/.
"""

import os
import json
import re
import sys
import urllib.request
from html import unescape
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import db_store

PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BILLS_JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "realBills.json")
CACHE_DIR = os.path.join(PROJECT_ROOT, "data", "bill_texts")

CHAMBER_FTP_FOLDERS = {
    "HB": "house_bills",
    "SB": "senate_bills",
    "HJR": "house_joint_resolutions",
    "SJR": "senate_joint_resolutions",
    "HCR": "house_concurrent_resolutions",
    "SCR": "senate_concurrent_resolutions",
    "HR": "house_resolutions",
    "SR": "senate_resolutions",
}

# Texas Statute Code Mappings
TEXAS_CODES = {
    "Human Resources Code": "HR",
    "Education Code": "ED",
    "Tax Code": "TX",
    "Health and Safety Code": "HS",
    "Penal Code": "PE",
    "Government Code": "GV",
    "Election Code": "EL",
    "Utilities Code": "UT",
    "Insurance Code": "IN",
    "Family Code": "FA",
    "Occupations Code": "OC",
    "Transportation Code": "TN",
    "Water Code": "WA",
    "Labor Code": "LA",
    "Finance Code": "FI",
    "Local Government Code": "LG",
    "Parks and Wildlife Code": "PW",
    "Civil Practice and Remedies Code": "CP",
    "Code of Criminal Procedure": "CR",
    "Property Code": "PR",
    "Agriculture Code": "AG",
    "Alcoholic Beverage Code": "AB",
    "Business and Commerce Code": "BC",
    "Business Organizations Code": "BO",
    "Estates Code": "ES",
    "Natural Resources Code": "NR",
    "Special District Local Laws Code": "SD"
}

def extract_statutes_from_text(text: str) -> list:
    """Identify every Texas Code, Chapter, and Section referenced or amended in the bill."""
    results = []
    seen = set()
    
    for code_name, code_abbr in TEXAS_CODES.items():
        pattern = re.compile(rf'({re.escape(code_name)})', re.IGNORECASE)
        if pattern.search(text):
            # Extract chapters and sections near this code mention
            chaps = re.findall(rf'Chapter\s+(\d+)[,\s]+(?:of\s+the\s+)?{re.escape(code_name)}', text, re.IGNORECASE)
            secs = re.findall(rf'(?:Section|Sec\.)\s+([\d\.]+)[,\s]+(?:of\s+the\s+)?{re.escape(code_name)}', text, re.IGNORECASE)
            
            # Fallback general chapter extraction if localized regex missed it
            if not chaps:
                general_chaps = re.findall(r'Chapter\s+(\d+)', text, re.IGNORECASE)
                if general_chaps:
                    chaps = [general_chaps[0]]

            # Fallback general section extraction
            if not secs:
                general_secs = re.findall(r'(?:Section|Sec\.)\s+([\d\.]+)', text, re.IGNORECASE)
                if general_secs:
                    secs = general_secs[:4]

            chap_num = chaps[0] if chaps else "1"
            key = f"{code_abbr}-{chap_num}"
            if key not in seen:
                seen.add(key)
                results.append({
                    "codeName": code_name,
                    "codeAbbr": code_abbr,
                    "chapters": sorted(list(set(chaps))),
                    "sections": sorted(list(set([s.rstrip('.') for s in secs]))),
                    "statuteUrl": f"https://statutes.capitol.texas.gov/Docs/{code_abbr}/htm/{code_abbr}.{chap_num}.htm"
                })
                
    return results

def clean_legislative_html(html: str) -> str:
    """Convert official TLO HTML into clean, readable statutory plain text."""
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html, flags=re.DOTALL | re.IGNORECASE)
    text = body_match.group(1) if body_match else html

    text = re.sub(r'<head[^>]*>.*?</head>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    text = re.sub(r'<meta[^>]*>', '', text, flags=re.IGNORECASE)

    # Collapse HTML source pretty-printing whitespace so inline <u>/<s> tags do not split lines
    text = re.sub(r'[\r\n\t]+', ' ', text)

    # Drop left margin page-line-number cells
    text = re.sub(r'<td[^>]*\bwidth=["\']?65["\']?[^>]*>.*?</td>', '', text, flags=re.DOTALL | re.IGNORECASE)

    # Separate adjacent columns cleanly
    text = re.sub(r'</td>\s*<td[^>]*>', '   ', text, flags=re.IGNORECASE)

    # Convert block boundaries into newlines
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<hr[^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</(?:tr|p|div|center|h[1-6]|li|blockquote|pre|section|article)>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<(?:tr|p|div|center|h[1-6]|li)\b[^>]*>', '\n', text, flags=re.IGNORECASE)

    # Strip remaining inline tags without breaking lines
    text = re.sub(r'<[^>]+>', '', text)
    text = unescape(text).replace('\u00a0', ' ')

    lines = []
    prev_blank = True
    for raw_line in text.splitlines():
        trimmed_right = raw_line.rstrip(' \t')
        stripped = trimmed_right.strip()
        if not stripped:
            if not prev_blank:
                lines.append('')
                prev_blank = True
            continue
        if stripped.startswith('td {') or stripped.startswith('table {'):
            continue
        leading_len = len(trimmed_right) - len(trimmed_right.lstrip(' \t'))
        indent = '    ' if leading_len >= 10 else ('  ' if leading_len >= 4 else '')
        body = re.sub(r' {3,}', '   ', stripped)
        lines.append(indent + body)
        prev_blank = False

    while lines and lines[-1] == '':
        lines.pop()

    return "\n".join(lines)


def fetch_clean_bill_text(session: str, bill_number: str, version_code: str = "I") -> tuple:
    """Fetch official statutory text from TLO HTTPS with FTP fallback and clean HTML into plain text."""
    m = re.search(r'([A-Za-z]+)\s*(\d+)', bill_number)
    if not m:
        return "", "", ""

    prefix, num = m.groups()
    prefix_upper = prefix.upper()
    bill_code = f"{prefix_upper}{int(num):05d}{version_code}"
    url = f"https://capitol.texas.gov/tlodocs/{session}/billtext/html/{bill_code}.htm"
    pdf_url = f"https://capitol.texas.gov/tlodocs/{session}/billtext/pdf/{bill_code}.pdf"

    chamber_folder = CHAMBER_FTP_FOLDERS.get(
        prefix_upper,
        "senate_bills" if prefix_upper.startswith("S") else "house_bills",
    )
    ftp_url = f"ftp://ftp.legis.state.tx.us/bills/{session}/billtext/html/{chamber_folder}/{bill_code}.htm"

    clean_text = ""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        clean_text = clean_legislative_html(html)
    except Exception as e:
        print(f"  [Notice] HTTPS fetch unavailable for {bill_code}, trying FTP: {e}")

    if len(clean_text) < 200:
        try:
            with urllib.request.urlopen(ftp_url, timeout=10) as resp:
                ftp_html = resp.read().decode("utf-8", errors="ignore")
            ftp_clean = clean_legislative_html(ftp_html)
            if len(ftp_clean) >= 200:
                clean_text = ftp_clean
        except Exception as e:
            print(f"  [Notice] FTP fallback unavailable for {bill_code}: {e}")

    return clean_text, url, pdf_url


def _has_raw_html_or_entities(text: str) -> bool:
    if not text:
        return False
    return bool(re.search(r"<(?:td|tr|table|html|head|p|div|span)\b|&#x[0-9a-f]+;|&#\d+;", text, re.IGNORECASE))


def ensure_bill_full_text(bill: dict) -> str:
    """
    Ensure full statutory text for the Introduced ('I') version is cached cleanly in
    data/bill_texts/{session}/{clean_num}.txt and attached to the bill dict (versions +
    amendedStatutes). Returns the full text or falls back to bill caption.
    """
    session = (bill.get("session") or "90R").upper()
    bill_number = str(bill.get("billNumber") or "")
    clean_num = re.sub(r"\s+", "", bill_number).upper()
    if not clean_num:
        return bill.get("caption", "")

    sess_cache_dir = os.path.join(CACHE_DIR, session)
    cache_path = os.path.join(sess_cache_dir, f"{clean_num}.txt")

    m = re.search(r"([A-Za-z]+)\s*(\d+)", bill_number)
    default_tlo_url = bill.get("officialTloUrl", "")
    default_pdf_url = bill.get("officialPdfUrl", "")
    if m and (not default_tlo_url or not default_pdf_url):
        prefix, num = m.groups()
        bill_code = f"{prefix.upper()}{int(num):05d}I"
        default_tlo_url = default_tlo_url or f"https://capitol.texas.gov/tlodocs/{session}/billtext/html/{bill_code}.htm"
        default_pdf_url = default_pdf_url or f"https://capitol.texas.gov/tlodocs/{session}/billtext/pdf/{bill_code}.pdf"

    full_text = ""
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8", errors="ignore") as f:
                cached = f.read().strip()
            if len(cached) > 200 and not _has_raw_html_or_entities(cached):
                full_text = cached
        except Exception:
            pass

    if not full_text:
        fetched_text, tlo_url, pdf_url = fetch_clean_bill_text(session, bill_number, "I")
        if tlo_url:
            default_tlo_url = tlo_url
        if pdf_url:
            default_pdf_url = pdf_url
        if fetched_text and len(fetched_text) > 200:
            full_text = fetched_text
            os.makedirs(sess_cache_dir, exist_ok=True)
            with open(cache_path, "w", encoding="utf-8") as tf:
                tf.write(full_text)

    if full_text and len(full_text) > 200:
        char_count = len(full_text)
        snippet = full_text[:300] + ("..." if char_count > 300 else "")
        versions = bill.get("versions") or []
        if not versions or len(versions[0].get("fullText") or "") < char_count or _has_raw_html_or_entities(versions[0].get("fullText") or ""):
            bill["versions"] = [{
                "versionCode": "I",
                "versionName": "Introduced",
                "dateFiled": bill.get("dateFiled", "2026-11-09"),
                "charCount": char_count,
                "snippet": snippet,
                "fullText": full_text,
            }]
        if not bill.get("amendedStatutes"):
            bill["amendedStatutes"] = extract_statutes_from_text(full_text)
        if default_tlo_url:
            bill["officialTloUrl"] = default_tlo_url
        if default_pdf_url:
            bill["officialPdfUrl"] = default_pdf_url
        return full_text

    # Fall back to embedded version text or caption
    versions = bill.get("versions") or []
    if versions and isinstance(versions, list):
        embedded = (versions[0].get("fullText") or "").strip()
        if embedded and not _has_raw_html_or_entities(embedded):
            return embedded
    return bill.get("caption", "")


def hydrate_bills():
    os.makedirs(CACHE_DIR, exist_ok=True)

    conn = db_store.get_connection()
    try:
        db_store.init_and_sync_seed(conn)
        bills = db_store.load_all_bills(conn)

        print(f"Loaded {len(bills)} bills from SQLite store ({db_store.DB_PATH}).")

        # Priority list of high-interest bills to hydrate immediately with full authentic text
        priority_bill_numbers = [
            "HB 101", "HB 126", "HB 687", "HB 705", "HB 708", "HB 789", "HB 20",
            "SB 31", "SB 84", "SB 12", "HB 900", "SB 1515", "SB 17", "SB 1",
            "HB 1927", "HB 3", "SB 2", "SB 4", "SB 6", "HB 2", "HB 12", "HB 100"
        ]

        # Also include the first 40 prefiled 90R bills
        prefiled_90r = [b["billNumber"] for b in bills if b.get("session") == "90R"][:40]
        target_bill_numbers = set(priority_bill_numbers + prefiled_90r)

        print(f"Hydrating full authentic statutory texts for {len(target_bill_numbers)} featured bills...")

        hydrated_count = 0
        for bill in bills:
            num = bill.get("billNumber")
            sess = bill.get("session", "90R")

            # Check if bill is in target list or has a short stub
            versions = bill.get("versions", [])
            has_short_text = not versions or len(versions[0].get("fullText", "")) < 800

            if num in target_bill_numbers or (sess == "90R" and has_short_text and hydrated_count < 60):
                print(f"Fetching full text for {sess} {num}...")
                full_text = ensure_bill_full_text(bill)

                if full_text and len(full_text) > 300:
                    db_store.upsert_enriched_bill(conn, bill)
                    hydrated_count += 1
                    print(f"  ✔ {num}: {len(full_text):,} chars, {len(bill.get('amendedStatutes') or [])} amended statutes.")
                    time.sleep(0.1)  # Respectful delay

        total_exported = db_store.export_runtime_snapshot(conn)
        print(f"\n[Complete] Successfully hydrated {hydrated_count} bills into SQLite and exported {total_exported} bills to runtime snapshot!")
    finally:
        conn.close()


if __name__ == "__main__":
    hydrate_bills()
