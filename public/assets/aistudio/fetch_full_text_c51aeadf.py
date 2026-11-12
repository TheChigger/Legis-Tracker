#!/usr/bin/env python3
"""
Texas Capitol Document Hydrator
Downloads raw statutory text and official TLO staff bill analyses into SQLite
to prepare rich context for local Llama 3.1 policy enrichment.
"""
import sqlite3
import re
import urllib.request
from bs4 import BeautifulSoup
import time

def fetch_tlo_doc(session, bill_id, doc_type="billtext", version_code="I"):
    """
    Fetches TLO document text over HTTPS.
    doc_type options: 'billtext', 'analysis', 'fiscalnotes'
    """
    match = re.search(r'([A-Z]+)\s*(\d+)', bill_id, re.IGNORECASE)
    if not match:
        return None
    prefix, num = match.groups()
    padded_num = f"{int(num):05d}"
    
    url = f"https://capitol.texas.gov/tlodocs/{session.upper()}/{doc_type}/html/{prefix.upper()}{padded_num}{version_code}.htm"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            html = response.read().decode('utf-8', errors='ignore')
            soup = BeautifulSoup(html, 'html.parser')
            for el in soup(["script", "style"]):
                el.extract()
            text = soup.get_text(separator=' ').strip()
            clean_text = re.sub(r'\s+', ' ', text)
            return clean_text if len(clean_text) > 80 else None
    except Exception:
        return None

def hydrate_session_documents(session="90R"):
    db_name = "texas_capitol_structured.db"
    
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        
        # Ensure documents table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bill_documents (
                doc_id TEXT PRIMARY KEY,
                session_bill_id TEXT,
                doc_type TEXT,
                full_content TEXT,
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

        cursor.execute("SELECT session_bill_id, bill_id FROM bill_versions WHERE session = ?", (session,))
        bills = cursor.fetchall()
        print(f"Hydrating document store for {len(bills)} bills in Session {session}...")

        updated_text = 0
        updated_analysis = 0

        for idx, (session_bill_id, bill_id) in enumerate(bills, 1):
            # 1. Fetch Statutory Text
            stat_text = fetch_tlo_doc(session, bill_id, doc_type="billtext")
            if stat_text:
                cursor.execute("""
                    INSERT OR REPLACE INTO bill_documents (doc_id, session_bill_id, doc_type, full_content)
                    VALUES (?, ?, ?, ?)
                """, (f"{session_bill_id}_text", session_bill_id, "bill_text", stat_text))
                
                # Update main bill_versions full_text for backward compatibility
                cursor.execute("UPDATE bill_versions SET full_text = ? WHERE session_bill_id = ?", (stat_text, session_bill_id))
                updated_text += 1

            # 2. Fetch Official Staff Analysis (if available)
            analysis_text = fetch_tlo_doc(session, bill_id, doc_type="analysis")
            if analysis_text:
                cursor.execute("""
                    INSERT OR REPLACE INTO bill_documents (doc_id, session_bill_id, doc_type, full_content)
                    VALUES (?, ?, ?, ?)
                """, (f"{session_bill_id}_analysis", session_bill_id, "bill_analysis", analysis_text))
                updated_analysis += 1

            if idx % 50 == 0 or idx == len(bills):
                conn.commit()
                print(f"  Processed {idx}/{len(bills)} bills (Text: {updated_text} | Staff Analyses: {updated_analysis})...")

            time.sleep(0.05)

    print(f"\n[Done] Document store hydration complete for Session {session}.")

if __name__ == "__main__":
    hydrate_session_documents("90R")
