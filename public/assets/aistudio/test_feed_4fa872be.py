#!/usr/bin/env python3
import feedparser
import urllib.request
from bs4 import BeautifulSoup

FEED_URL = "https://texas.gov"

print("=========================================")
print(f"Connecting to TLO: {FEED_URL}")
print("=========================================\n")

feed = feedparser.parse(FEED_URL)

if not feed.entries:
    print("❌ The RSS feed was reached but it currently contains 0 active entries.")
else:
    print(f"✅ Success! Found {len(feed.entries)} entries in today's feed.\n")
    for idx, entry in enumerate(feed.entries[:3], 1):
        title = entry.get('title', 'No Title')
        link = entry.get('link', 'No Link')
        print(f"[{idx}] {title}")
        print(f"    Link: {link}")
