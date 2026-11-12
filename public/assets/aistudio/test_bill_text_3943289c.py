#!/usr/bin/env python3
"""
Targeted TLO Feed Diagnostic
Connects strictly to "Today's Bill Text" and runs a test scrape on a live bill.
"""
import feedparser
import urllib.request
from bs4 import BeautifulSoup
import re

FEED_URL = "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysbilltext"

print("==================================================")
print("  LAUNCHING TARGETED CAPITOL RSS TEST  ")
print("==================================================")

print(f"\n1. Connecting directly to TLO stream:\n   {FEED_URL}")
feed = feedparser.parse(FEED_URL)

if not feed.entries:
    print("\n❌ The server returned an empty array channel.")
    print("This means TLO has zero live entries on this specific index right now.")
else:
    print(f"\n✅ SUCCESS! Found {len(feed.entries)} bills currently live in this feed.")
    print("\nListing the first 5 bills in the stream:")
    print("--------------------------------------------------")
    
    for idx, entry in enumerate(feed.entries[:5], 1):
        title = entry.get('title', 'Unknown Bill')
        author = entry.get('dc_creator', 'Unknown Author')
        print(f"  [{idx}] {title.strip()} - Sponsored by: {author}")
    
    # Let's pick the very first bill in the array to test our full-text scaper
    test_entry = feed.entries[0]
    test_title = test_entry.get('title', 'Unknown Bill').strip()
    test_link = test_entry.get('link', '')
    
    print("\n--------------------------------------------------")
    print(f"2. Testing Full-Text Extractor on: {test_title}")
    print(f"   Target Link: {test_link}")
    print("--------------------------------------------------")
    
    if test_link:
        try:
            req = urllib.request.Request(test_link, headers={'User-Agent': 'TexasCapitolAI-Diagnostic/5.0'})
            with urllib.request.urlopen(req, timeout=12) as response:
                html_content = response.read()
                
            soup = BeautifulSoup(html_content, 'html.parser')
            raw_text = soup.get_text(separator='\n')
            clean_lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
            full_text = '\n'.join(clean_lines)
            
            print("\n✅ SUCCESS! Full text scraped from the Capitol website.")
            print("\n--- Preview of the first 250 characters of actual bill text ---")
            print(full_text[:250] + "\n...")
            print("--------------------------------------------------")
            
        except Exception as e:
            print(f"\n❌ Scraper hit a roadblock visiting the link: {e}")

print("\nDiagnostic Complete!")
print("==================================================")
