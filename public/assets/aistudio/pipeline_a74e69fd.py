#!/usr/bin/env python3
"""
Texas Capitol Pipeline (v20 - Robust Filing Date & Author Ingestion)
Parses official TLO master reports, extracting exact filing dates, multi-author lists,
and captions into session-isolated records.
"""
import sqlite3
import re
import urllib.request
from bs4 import BeautifulSoup
from datetime import datetime

def sync_master_catalogs(sessions=["89R", "90R"], db_name="texas_capitol_structured.db"):
    print("Starting master HTTPS catalog sync...")
    
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bill_versions (
                version_key TEXT PRIMARY KEY,
                session_bill_id TEXT,
                session TEXT,
                bill_id TEXT,
                bill_type TEXT,
                bill_num INTEGER,
                version_status TEXT,
                filed_date TEXT,
                caption TEXT,
                full_text TEXT,
                link TEXT,
                discovered_at TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bill_authors (
                session_bill_id TEXT,
                author_name TEXT,
                PRIMARY KEY (session_bill_id, author_name)
            )
        """)
        conn.commit()

        reports = [
            ("housefiled", "House Bills"),
            ("senatefiled", "Senate Bills")
        ]

        for session in sessions:
            clean_sess = session.upper().strip()
            print(f"\n[Session {clean_sess}] Synchronizing master report...")

            for report_id, report_name in reports:
                url = f"https://capitol.texas.gov/reports/Report.aspx?LegSess={clean_sess}&ID={report_id}"
                print(f"  Fetching {report_name}: {url}...")
                
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=25) as response:
                        html_content = response.read().decode('utf-8', errors='ignore')
                except Exception as e:
                    print(f"    -> Failed to download {report_name}: {e}")
                    continue

                soup = BeautifulSoup(html_content, "html.parser")
                rows = soup.find_all("tr")

                processed_count = 0
                new_authors_count = 0

                for row in rows:
                    cells = row.find_all("td")
                    row_text = row.get_text(separator=" ").strip()
                    
                    # Match Bill ID (e.g. HB 100, SB 14)
                    match = re.search(r'\b(HB|SB|HJR|SJR|HCR|SCR|HR|SR)\s*(\d+)\b', row_text, re.IGNORECASE)
                    if not match:
                        continue

                    b_type, b_num_str = match.groups()
                    b_type = b_type.upper()
                    bill_id = f"{b_type}{b_num_str}"
                    bill_num = int(b_num_str)

                    # Extract Link
                    a_tag = row.find('a')
                    href = a_tag.get('href', '') if a_tag else ''
                    full_link = f"https://capitol.texas.gov{href}" if href.startswith('/') else href

                    # Extract Filing Date (e.g., MM/DD/YYYY format in text or cells)
                    filed_date = "Unknown"
                    date_match = re.search(r'\b(\d{1,2}/\d{1,2}/\d{4})\b', row_text)
                    if date_match:
                        filed_date = date_match.group(1)
                    elif len(cells) >= 2 and re.search(r'\d{1,2}/\d{1,2}/\d{4}', cells[1].get_text()):
                        filed_date = re.search(r'\d{1,2}/\d{1,2}/\d{4}', cells[1].get_text()).group(0)

                    # Extract Author(s)
                    author_name = "Unknown"
                    if len(cells) >= 3:
                        candidate = cells[2].get_text().strip()
                        if candidate and not candidate.lower().startswith("relating"):
                            author_name = candidate
                    elif len(cells) == 2:
                        candidate = cells[1].get_text().strip()
                        if candidate and not re.search(r'\d{1,2}/\d{1,2}/\d{4}', candidate):
                            author_name = candidate

                    # Fallback regex for author if cells didn't catch it
                    if author_name == "Unknown":
                        auth_match = re.search(r'(?:By|Author):\s*([^\n\r|<]+)', row_text, re.IGNORECASE)
                        if auth_match:
                            author_name = auth_match.group(1).strip()

                    # Extract Caption
                    caption = ""
                    if len(cells) >= 4:
                        caption = cells[3].get_text().strip()
                    else:
                        caption_match = re.search(r'(Relating to [^\n\r|<]+)', row_text, re.IGNORECASE)
                        caption = caption_match.group(1).strip() if caption_match else row_text[:300]

                    session_bill_id = f"{clean_sess}_{bill_id}"
                    version_key = f"{session_bill_id}_Introduced"

                    cursor.execute("""
                        INSERT OR IGNORE INTO bill_versions 
                        (version_key, session_bill_id, session, bill_id, bill_type, bill_num, version_status, filed_date, caption, full_text, link, discovered_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (version_key, session_bill_id, clean_sess, bill_id, b_type, bill_num, "Introduced", filed_date, caption, caption, full_link, datetime.now()))

                    # Insert Authors
                    if author_name and author_name != "Unknown":
                        authors = re.split(r'\||,|;', author_name)
                        for single_author in authors:
                            clean_a = single_author.strip()
                            if clean_a and len(clean_a) < 50 and not clean_a.lower().startswith("relating"):
                                cursor.execute("""
                                    INSERT OR IGNORE INTO bill_authors (session_bill_id, author_name)
                                    VALUES (?, ?)
                                """, (session_bill_id, clean_a))
                                new_authors_count += 1

                    processed_count += 1

                conn.commit()
                print(f"    Processed {processed_count} {report_name} ({new_authors_count} author entries linked).")

    print("\nMaster catalog synchronization complete.")

if __name__ == "__main__":
    sync_master_catalogs(sessions=["89R", "90R"])
