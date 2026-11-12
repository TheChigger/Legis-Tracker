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
import urllib.request
from html import unescape
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BILLS_JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "realBills.json")
CACHE_DIR = os.path.join(PROJECT_ROOT, "data", "bill_texts")

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

def fetch_clean_bill_text(session: str, bill_number: str, version_code: str = "I") -> tuple:
    """Fetch official statutory text from TLO and clean HTML tags into pristine text."""
    m = re.search(r'([A-Za-z]+)\s*(\d+)', bill_number)
    if not m:
        return "", ""
        
    prefix, num = m.groups()
    bill_code = f"{prefix.upper()}{int(num):05d}{version_code}"
    url = f"https://capitol.texas.gov/tlodocs/{session}/billtext/html/{bill_code}.htm"
    pdf_url = f"https://capitol.texas.gov/tlodocs/{session}/billtext/pdf/{bill_code}.pdf"
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            
        # Clean HTML into structured legal text
        text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', '\n', text)
        text = unescape(text)
        
        lines = []
        for line in text.splitlines():
            l = re.sub(r'[ \t]+', ' ', line).strip()
            if l and not l.startswith('td {') and not l.startswith('table {'):
                lines.append(l)
                
        clean_text = "\n".join(lines)
        return clean_text, url, pdf_url
    except Exception as e:
        print(f"  [Notice] Could not fetch {bill_code}: {e}")
        return "", url, pdf_url

def hydrate_bills():
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    with open(BILLS_JSON_PATH, "r", encoding="utf-8") as f:
        bills = json.load(f)
        
    print(f"Loaded {len(bills)} bills from database.")
    
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
            full_text, tlo_url, pdf_url = fetch_clean_bill_text(sess, num, "I")
            
            if full_text and len(full_text) > 300:
                char_count = len(full_text)
                snippet = full_text[:300] + "..."
                statutes = extract_statutes_from_text(full_text)
                
                # Update versions
                bill["versions"] = [{
                    "versionCode": "I",
                    "versionName": "Introduced",
                    "dateFiled": bill.get("dateFiled", "2026-11-09"),
                    "charCount": char_count,
                    "snippet": snippet,
                    "fullText": full_text
                }]
                
                bill["amendedStatutes"] = statutes
                bill["officialTloUrl"] = tlo_url
                bill["officialPdfUrl"] = pdf_url
                
                # Save to disk cache in data/bill_texts/
                sess_cache_dir = os.path.join(CACHE_DIR, sess)
                os.makedirs(sess_cache_dir, exist_ok=True)
                clean_num_str = num.replace(" ", "")
                with open(os.path.join(sess_cache_dir, f"{clean_num_str}.txt"), "w", encoding="utf-8") as tf:
                    tf.write(full_text)
                    
                hydrated_count += 1
                print(f"  ✔ {num}: {char_count:,} chars, {len(statutes)} amended statutes.")
                time.sleep(0.1) # Respectful delay
                
    # Atomic save to realBills.json
    tmp_path = BILLS_JSON_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(bills, f, indent=2)
    os.replace(tmp_path, BILLS_JSON_PATH)
    
    print(f"\n[Complete] Successfully hydrated {hydrated_count} bills with full authentic texts and statute mappings!")

if __name__ == "__main__":
    hydrate_bills()
