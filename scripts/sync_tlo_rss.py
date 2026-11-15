#!/usr/bin/env python3
"""
Texas Capitol Live RSS Monitor & Persistent Event Sync
Polls all 10 official Texas Legislature Online (TLO) RSS feeds:
  - upcomingmeetingshouse / upcomingmeetingssenate
  - upcomingcalendarshouse / upcomingcalendarssenate
  - todaysbilltext / todaysfiscalnotes / todaysbillanalyses
  - todaysfiledhouse / todaysfiledsenate / todaysbillspassed

Persists chronological wire events to SQLite (rss_items), updates
committee_meetings (keeping saved user notes intact), and persists any
newly discovered bills or full texts into SQLite (bills).
"""

import email.utils
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from typing import Optional

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import db_store
from hydrate_real_full_texts import (
    CHAMBER_FTP_FOLDERS,
    extract_statutes_from_text,
    fetch_clean_bill_text,
)
from ingest_real_texas_data import (
    classify_bill_policy,
    fetch_bill_detail_from_xml,
    normalize_tlo_text,
    parse_coauthors_from_author,
)

USER_AGENT = "Mozilla/5.0 (compatible; TexasCapitolTracker/1.0)"
DEFAULT_ACTIVE_SESSION = "90R"

TLO_RSS_FEEDS = [
    {
        "feedType": "todaysfiledhouse",
        "feedLabel": "House Filed",
        "chamber": "House",
        "group": "filings",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysfiledhouse",
    },
    {
        "feedType": "todaysfiledsenate",
        "feedLabel": "Senate Filed",
        "chamber": "Senate",
        "group": "filings",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysfiledsenate",
    },
    {
        "feedType": "todaysbilltext",
        "feedLabel": "Bill Text",
        "chamber": None,
        "group": "documents",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysbilltext",
    },
    {
        "feedType": "todaysfiscalnotes",
        "feedLabel": "Fiscal Notes",
        "chamber": None,
        "group": "documents",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysfiscalnotes",
    },
    {
        "feedType": "todaysbillanalyses",
        "feedLabel": "Bill Analyses",
        "chamber": None,
        "group": "documents",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysbillanalyses",
    },
    {
        "feedType": "todaysbillspassed",
        "feedLabel": "Passed Bills",
        "chamber": None,
        "group": "filings",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysbillspassed",
    },
    {
        "feedType": "upcomingcalendarshouse",
        "feedLabel": "House Calendars",
        "chamber": "House",
        "group": "calendars",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingcalendarshouse",
    },
    {
        "feedType": "upcomingcalendarssenate",
        "feedLabel": "Senate Calendars",
        "chamber": "Senate",
        "group": "calendars",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingcalendarssenate",
    },
    {
        "feedType": "upcomingmeetingshouse",
        "feedLabel": "House Meetings",
        "chamber": "House",
        "group": "meetings",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingshouse",
    },
    {
        "feedType": "upcomingmeetingssenate",
        "feedLabel": "Senate Meetings",
        "chamber": "Senate",
        "group": "meetings",
        "url": "https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=upcomingmeetingssenate",
    },
]

BILL_NUM_RE = re.compile(r"\b(HB|SB|HJR|SJR|HCR|SCR|HR|SR)\s*0*(\d+)\b", re.IGNORECASE)
SESSION_IN_URL_RE = re.compile(r"LegSess=(\d{2}[RS]\d?)", re.IGNORECASE)


def strip_html(raw: str) -> str:
    if not raw:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", raw, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text).replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return normalize_tlo_text(text)


def extract_bill_numbers(text: str) -> list[str]:
    found = []
    seen = set()
    for prefix, num in BILL_NUM_RE.findall(text or ""):
        norm = f"{prefix.upper()} {int(num)}"
        if norm not in seen:
            seen.add(norm)
            found.append(norm)
    return found


def infer_chamber(feed_chamber: Optional[str], bill_number: Optional[str], text: str) -> str:
    if feed_chamber in ("House", "Senate"):
        return feed_chamber
    if bill_number:
        return "Senate" if bill_number.upper().startswith("S") else "House"
    lowered = (text or "").lower()
    if "senate" in lowered:
        return "Senate"
    return "House"


def infer_session(link: str, title: str, description: str) -> str:
    m = SESSION_IN_URL_RE.search(link or "")
    if m:
        return m.group(1).upper()
    combined = f"{title} {description}"
    if "89(R)" in combined or "89R" in combined or "89th Legislature" in combined:
        return "89R"
    return DEFAULT_ACTIVE_SESSION


def parse_pub_timestamp(pub_date_raw: str) -> tuple[str, int]:
    now_ts = int(time.time())
    if not pub_date_raw:
        return time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(now_ts)), now_ts
    try:
        dt = email.utils.parsedate_to_datetime(pub_date_raw)
        if dt is not None:
            ts = int(dt.timestamp())
            return pub_date_raw.strip(), ts
    except Exception:
        pass
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", pub_date_raw)
    if m:
        try:
            iso = f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
            ts = int(time.mktime(time.strptime(iso, "%Y-%m-%d")))
            return iso, ts
        except Exception:
            pass
    return pub_date_raw.strip(), now_ts


def fetch_rss_xml(url: str, timeout: int = 12) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    try:
        decoded = raw.decode("utf-8")
    except UnicodeDecodeError:
        decoded = raw.decode("cp1252", errors="replace")
    return normalize_tlo_text(decoded)


def parse_rss_items(feed_meta: dict, xml_text: str) -> list[dict]:
    if not xml_text or "<rss" not in xml_text.lower() and "<feed" not in xml_text.lower():
        return []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    parsed = []
    items = root.findall(".//item")
    for idx, elem in enumerate(items):
        raw_title = normalize_tlo_text(elem.findtext("title") or "").strip()
        raw_desc = elem.findtext("description") or ""
        desc = strip_html(raw_desc)
        link = (elem.findtext("link") or feed_meta["url"]).strip()
        guid = (elem.findtext("guid") or "").strip()
        pub_raw = (elem.findtext("pubDate") or "").strip()
        pub_date_str, pub_ts = parse_pub_timestamp(pub_raw)

        if not raw_title and not desc:
            continue

        title = raw_title or desc[:120]
        if (
            "no items" in title.lower()
            or "no upcoming" in title.lower()
            or "there are no" in title.lower()
        ) and not extract_bill_numbers(f"{title} {desc}"):
            continue

        bill_nums = extract_bill_numbers(f"{title} {desc} {link}")
        primary_bill = bill_nums[0] if bill_nums else None
        chamber = infer_chamber(feed_meta.get("chamber"), primary_bill, f"{title} {desc}")
        session = infer_session(link, title, desc)

        key_src = f"{feed_meta['feedType']}|{guid or link}|{title}|{pub_raw or idx}"
        digest = hashlib.sha1(key_src.encode("utf-8")).hexdigest()[:16]

        parsed.append(
            {
                "id": f"rss-{feed_meta['feedType']}-{digest}",
                "feedType": feed_meta["feedType"],
                "feedLabel": feed_meta["feedLabel"],
                "session": session,
                "chamber": chamber,
                "billNumber": primary_bill,
                "title": title,
                "description": desc or title,
                "link": link,
                "pubDate": pub_date_str,
                "pubTimestamp": pub_ts,
            }
        )
    return parsed


def _parse_meeting_date_time(text: str, fallback_ts: int) -> tuple[str, str]:
    # Try MM/DD/YYYY or YYYY-MM-DD in title/description
    m_iso = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text or "")
    if m_iso:
        date_str = m_iso.group(1)
    else:
        m_us = re.search(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", text or "")
        if m_us:
            date_str = f"{m_us.group(3)}-{int(m_us.group(1)):02d}-{int(m_us.group(2)):02d}"
        else:
            date_str = time.strftime("%Y-%m-%d", time.gmtime(fallback_ts or int(time.time())))

    m_time = re.search(r"\b(\d{1,2}:\d{2}\s*(?:AM|PM|a\.m\.|p\.m\.))\b", text or "", re.IGNORECASE)
    time_str = m_time.group(1).upper().replace(".", "") if m_time else "Upon Adjournment / See Notice"
    return date_str, time_str


def _build_meeting_from_rss_item(item: dict) -> dict:
    feed_type = item["feedType"]
    chamber = item["chamber"]
    is_calendar = "calendar" in feed_type
    combined = f"{item['title']} — {item['description']}"
    date_str, time_str = _parse_meeting_date_time(combined, item["pubTimestamp"])

    m_loc = re.search(r"(?:Room|Rm\.?|Location:?)\s*([A-Z0-9\.\-\s]{2,32})", item["description"], re.IGNORECASE)
    location = m_loc.group(1).strip(" ,.;") if m_loc else (
        f"{chamber} Chamber, Texas Capitol" if is_calendar else f"Texas Capitol Extension ({chamber})"
    )

    agenda_bills = extract_bill_numbers(f"{item['title']} {item['description']}")
    committee_name = re.sub(r"\s*[-–|]\s*\d{1,2}/\d{1,2}/\d{4}.*$", "", item["title"]).strip()
    if len(committee_name) > 90:
        committee_name = committee_name[:87].rstrip() + "..."

    digest = hashlib.sha1(f"{feed_type}|{committee_name}|{date_str}".encode("utf-8")).hexdigest()[:12]
    broadcast_url = (
        "https://senate.texas.gov/" if chamber == "Senate" else "https://house.texas.gov/video-audio/"
    )
    rss_url = next((f["url"] for f in TLO_RSS_FEEDS if f["feedType"] == feed_type), "")

    return {
        "id": f"cm-live-{feed_type}-{digest}",
        "session": item["session"],
        "eventType": "Floor Calendar" if is_calendar else "Committee Hearing",
        "committeeName": committee_name or (f"{chamber} Daily Calendar" if is_calendar else f"{chamber} Committee Hearing"),
        "chamber": chamber,
        "meetingDate": date_str,
        "meetingTime": time_str,
        "location": location,
        "status": "Scheduled",
        "agendaBills": agenda_bills,
        "witnessRegistrationOpen": not is_calendar,
        "minutesSummary": item["description"],
        "noticeUrl": item["link"],
        "recordingUrl": broadcast_url,
        "rssFeedUrl": rss_url,
    }


def _build_persistent_bill_from_rss(session: str, bill_number: str, item: dict) -> Optional[dict]:
    m = re.match(r"^(HB|SB|HJR|SJR|HCR|SCR|HR|SR)\s*(\d+)$", bill_number.strip(), re.IGNORECASE)
    if not m:
        return None
    prefix = m.group(1).upper()
    num = int(m.group(2))
    bill_code = f"{prefix}{num:05d}"
    folder = CHAMBER_FTP_FOLDERS.get(prefix, "senate_bills" if prefix.startswith("S") else "house_bills")
    xml_path = f"/bills/{session}/billhistory/{folder}/{bill_code}.xml"

    details = fetch_bill_detail_from_xml(xml_path)
    caption = (details.get("caption") if details else "") or strip_html(item.get("description") or item.get("title") or "")
    author = (details.get("author") if details else "") or "Unknown"
    date_filed = (details.get("dateFiled") if details else "") or time.strftime("%Y-%m-%d", time.gmtime(item["pubTimestamp"]))
    last_action = (details.get("lastAction") if details else "") or f"{date_filed} {item['chamber'][0]} RSS Notice"
    subjects = (details.get("subjects") if details else []) or []

    full_text, tlo_url, pdf_url = fetch_clean_bill_text(session, bill_number, "I")
    if not full_text:
        full_text = caption

    chamber = "Senate" if prefix.startswith("S") else "House"
    cat, stance, prio, cc = classify_bill_policy(caption, subjects)
    statutes = extract_statutes_from_text(full_text) if len(full_text) >= 150 else []

    try:
        filed_ts = int(time.mktime(time.strptime(date_filed, "%Y-%m-%d")))
    except Exception:
        filed_ts = int(item.get("pubTimestamp") or time.time())

    bill_obj = {
        "id": f"{session}-{prefix}{num}",
        "session": session,
        "billNumber": f"{prefix} {num}",
        "chamber": chamber,
        "author": author,
        "coauthors": parse_coauthors_from_author(author),
        "dateFiled": date_filed,
        "lastAction": last_action,
        "lastActionDate": date_filed,
        "currentStatus": "Passed Chamber" if item["feedType"] == "todaysbillspassed" else "Filed / Introduced",
        "committee": "Pending Assignment",
        "caption": caption,
        "summary": caption,
        "stance": stance,
        "priorityScore": prio,
        "primaryCategory": cat,
        "categories": subjects[:4] if subjects else [cat],
        "comportConflict": cc,
        "versions": [
            {
                "versionCode": "I",
                "versionName": "Introduced",
                "dateFiled": date_filed,
                "charCount": len(full_text),
                "snippet": full_text[:240],
                "fullText": full_text,
            }
        ],
        "votes": [],
        "amendments": [],
        "impactedAgencies": [],
        "officialTloUrl": tlo_url or item["link"],
        "officialPdfUrl": pdf_url,
        "urgencyLevel": "Immediate Attention" if prio == 5 else ("High Watch" if prio >= 4 else "Routine"),
        "filedDateTimestamp": filed_ts,
    }
    if statutes:
        bill_obj["amendedStatutes"] = statutes
    if stance in ("SUPPORT", "OPPOSE"):
        bill_obj["recommendedStance"] = stance
    elif cc and cc[0].get("alignment") == "NEUTRAL":
        bill_obj["recommendedStance"] = "NEEDS REVIEW"
    return bill_obj


def sync_all_rss_feeds() -> dict:
    conn = db_store.get_connection()
    stats = {
        "feedsPolled": 0,
        "feedsSucceeded": 0,
        "itemsIngested": 0,
        "meetingsUpdated": 0,
        "billsUpdated": 0,
        "feedErrors": [],
    }
    try:
        db_store.init_and_sync_seed(conn)
        existing_bills = {
            row["id"]: json.loads(row["bill_json"])
            for row in conn.execute("SELECT id, bill_json FROM bills").fetchall()
        }

        for feed_meta in TLO_RSS_FEEDS:
            stats["feedsPolled"] += 1
            feed_type = feed_meta["feedType"]
            try:
                xml_text = fetch_rss_xml(feed_meta["url"])
                items = parse_rss_items(feed_meta, xml_text)
                stats["feedsSucceeded"] += 1
            except Exception as exc:
                stats["feedErrors"].append(f"{feed_type}: {exc}")
                continue

            if not items:
                continue

            # Replace baseline seed items for this feed once real TLO items arrive
            conn.execute("DELETE FROM rss_items WHERE id LIKE ?", (f"seed-{feed_type}-%",))

            for item in items:
                db_store.upsert_rss_item(conn, item)
                stats["itemsIngested"] += 1

                # Sync schedule feeds into committee_meetings
                if feed_type in (
                    "upcomingmeetingshouse",
                    "upcomingmeetingssenate",
                    "upcomingcalendarshouse",
                    "upcomingcalendarssenate",
                ):
                    meeting = _build_meeting_from_rss_item(item)
                    db_store.upsert_committee_meeting(conn, meeting)
                    stats["meetingsUpdated"] += 1
                    continue

                # Sync bill feeds into persistent SQLite bills table
                bnum = item.get("billNumber")
                if not bnum:
                    continue
                session = item.get("session") or DEFAULT_ACTIVE_SESSION
                bid = f"{session}-{bnum.replace(' ', '')}"

                if bid not in existing_bills and feed_type in ("todaysfiledhouse", "todaysfiledsenate", "todaysbilltext"):
                    new_bill = _build_persistent_bill_from_rss(session, bnum, item)
                    if new_bill:
                        db_store.upsert_ingested_bill(conn, new_bill)
                        existing_bills[bid] = new_bill
                        stats["billsUpdated"] += 1
                elif bid in existing_bills:
                    existing = existing_bills[bid]
                    mutated = False
                    if feed_type == "todaysbillspassed" and existing.get("currentStatus") != "Passed Chamber":
                        existing["currentStatus"] = "Passed Chamber"
                        existing["lastActionDate"] = time.strftime("%Y-%m-%d", time.gmtime(item["pubTimestamp"]))
                        mutated = True
                    elif feed_type == "todaysbilltext":
                        best_len = max((len(v.get("fullText") or "") for v in existing.get("versions") or []), default=0)
                        if best_len < 400:
                            text, tlo_url, pdf_url = fetch_clean_bill_text(session, bnum, "I")
                            if len(text) > best_len:
                                existing["versions"] = [
                                    {
                                        "versionCode": "I",
                                        "versionName": "Introduced",
                                        "dateFiled": existing.get("dateFiled", "2026-11-09"),
                                        "charCount": len(text),
                                        "snippet": text[:240],
                                        "fullText": text,
                                    }
                                ]
                                if tlo_url:
                                    existing["officialTloUrl"] = tlo_url
                                if pdf_url:
                                    existing["officialPdfUrl"] = pdf_url
                                statutes = extract_statutes_from_text(text)
                                if statutes:
                                    existing["amendedStatutes"] = statutes
                                mutated = True
                    elif feed_type == "todaysfiscalnotes" and not existing.get("fiscalNote"):
                        existing["fiscalNote"] = {
                            "preparedBy": "Legislative Budget Board",
                            "fiveYearCost": "See LBB Fiscal Note",
                            "impactOnLocalGov": item.get("description", "")[:240],
                            "impactOnGeneralRevenue": "Published via TLO todaysfiscalnotes RSS",
                            "methodologySummary": item.get("link", ""),
                        }
                        mutated = True
                    elif feed_type == "todaysbillanalyses" and not existing.get("billAnalysis"):
                        existing["billAnalysis"] = {
                            "agency": "Texas Legislative Council / Committee Analysis",
                            "author": existing.get("author", "Unknown"),
                            "subject": existing.get("primaryCategory", "Texas Legislation"),
                            "background": item.get("description", "")[:300] or item.get("link", ""),
                            "argumentsFor": [],
                            "argumentsAgainst": [],
                            "impactedStatutes": [],
                        }
                        mutated = True
                    if mutated:
                        db_store.upsert_ingested_bill(conn, existing)
                        stats["billsUpdated"] += 1

        conn.commit()
        db_store.export_runtime_rss(conn)
        db_store.export_runtime_meetings(conn)
        if stats["billsUpdated"] > 0:
            db_store.export_runtime_snapshot(conn)
        return stats
    finally:
        conn.close()


if __name__ == "__main__":
    summary = sync_all_rss_feeds()
    print(json.dumps(summary, ensure_ascii=False))
