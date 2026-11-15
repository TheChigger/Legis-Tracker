export interface PipelineStage {
  id: string;
  schedule: string;
  title: string;
  description: string;
  output: string;
}

export interface PythonScriptDoc {
  filename: string;
  title: string;
  description: string;
  code: string;
  capabilities: string[];
}

export const PIPELINE_ARCHITECTURE = {
  summary: 'Automated TLO FTP Ingestion, Full-Text Caching & Policy Evaluation Architecture',
  stages: [
    {
      id: 'ftp-ingestion',
      schedule: 'Hourly (:00)',
      title: 'TLO FTP Baseline & Live Intraday Sync',
      description:
        'Connects directly to ftp.legis.state.tx.us to parse daily House/Senate filed reports and monitor history_periodic.xml for same-day bill filings, upserting normalized metadata into SQLite WAL (data/texas_legis.db) and exporting atomic snapshots to data/runtime_bills.json.',
      output: 'Live bill catalog synced to SQLite WAL',
    },
    {
      id: 'text-hydration',
      schedule: 'Auto / On Demand',
      title: 'Statutory Full-Text & Code Citation Hydration',
      description:
        'Retrieves official bill texts from Capitol TLO HTTP & FTP feeds via ensure_bill_full_text(), converts legislative margin formatting and redlines into clean plain text in data/bill_texts/, and persists referenced Texas Statutes chapters.',
      output: 'Clean plain-text archive & statute links',
    },
    {
      id: 'ai-enrichment',
      schedule: 'Hourly (:30)',
      title: 'Local Ollama (Llama 3.1) 7-Domain Policy Analysis',
      description:
        'Automatically fetches/caches missing statutory full text before invoking Llama 3.1 to generate SUPPORT, OPPOSE, or NEEDS REVIEW assessments across all 7 policy domains, committing row-by-row to data/texas_legis.db and exporting data/runtime_bills.json.',
      output: 'Row-by-row SQLite persistence & policy triggers',
    },
    {
      id: 'hybrid-search',
      schedule: 'Real-Time API',
      title: 'Grounded Legislative Research Assistant',
      description:
        'Routes queries through Hybrid Gemini -> Local Ollama (llama3.1) -> Capitol DB Grounding with cached statutory excerpts and the 7-domain analyst prompt for instant bill comparisons, lawmaker timelines, and trade-off reviews.',
      output: 'Interactive /api/ai/query synthesis',
    },
  ] as PipelineStage[],
};

export const PIPELINE_SCRIPTS: PythonScriptDoc[] = [
  {
    filename: 'scripts/db_store.py',
    title: 'SQLite WAL Concurrency & Snapshot Storage Engine',
    description:
      'Manages concurrent reads and writes across cron jobs and Express via SQLite WAL mode (data/texas_legis.db), keeping Git-tracked src/data/realBills.json read-only as the seed.',
    capabilities: [
      'Enables SQLite WAL journaling for safe concurrent reads/writes',
      'Preserves AI enrichments & longer full texts across TLO metadata refreshes',
      'Row-by-row transactional upserts prevent partial data loss on interrupt',
      'Atomically exports data/runtime_bills.json for fast Express API reads',
    ],
    code: `#!/usr/bin/env python3
"""
SQLite WAL storage engine for Texas Capitol Legislative Intelligence.
Keeps runtime mutations in data/texas_legis.db and data/runtime_bills.json
while leaving Git-tracked src/data/realBills.json untouched as a seed.
"""

import sqlite3, json, os

DB_PATH = "data/texas_legis.db"
RUNTIME_JSON_PATH = "data/runtime_bills.json"

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=10000;")
    return conn
`,
  },
  {
    filename: 'scripts/ingest_real_texas_data.py',
    title: 'TLO FTP Master & Intraday Ingestion Engine',
    description:
      'Synchronizes overnight House/Senate filed reports and the live history_periodic.xml intraday feed directly from the Texas Legislature Online FTP portal.',
    capabilities: [
      'Reads daily housefiled.htm & senatefiled.htm FTP reports',
      'Polls live history_periodic.xml for newly introduced bills',
      'Upserts metadata into SQLite WAL via scripts/db_store.py',
      'Atomically exports data/runtime_bills.json without touching Git seed',
    ],
    code: `#!/usr/bin/env python3
"""
Texas Capitol Real-Time Data Ingestion Script
Fetches authentic data from Texas Legislature Online (TLO) FTP portal:
1. Daily baseline reports (housefiled.htm, senatefiled.htm)
2. Live intraday XML feed: ftp://ftp.legis.state.tx.us/bills/90R/billhistory/history_periodic.xml
3. Upserts into data/texas_legis.db (SQLite WAL) & exports data/runtime_bills.json
"""

import urllib.request
import xml.etree.ElementTree as ET
import db_store

def fetch_ftp_text(url: str, timeout: int = 15) -> str:
    req = urllib.request.urlopen(url, timeout=timeout)
    return req.read().decode("utf-8", errors="ignore")

def parse_intraday_feed():
    url = "ftp://ftp.legis.state.tx.us/bills/90R/billhistory/history_periodic.xml"
    xml_data = fetch_ftp_text(url)
    root = ET.fromstring(xml_data)
    return [
        {"id": b.attrib.get("id"), "path": b.attrib.get("path")}
        for b in root.findall("bill")
        if b.attrib.get("id") and b.attrib.get("path")
    ]
`,
  },
  {
    filename: 'scripts/enrich_bills.py',
    title: 'Ollama Llama 3.1 Policy Evaluation Pipeline',
    description:
      'Auto-fetches statutory full text if missing, then evaluates pending bills against the 7-domain legislative framework and commits results row-by-row to SQLite WAL.',
    capabilities: [
      'Auto-fetches & caches missing full text via ensure_bill_full_text()',
      'Reads up to 4,000 chars of statutory text before calling Llama 3.1',
      'Commits each enriched bill row-by-row to SQLite WAL via db_store.py',
      'Supports --re-enrich flag to upgrade prior evaluations',
    ],
    code: `#!/usr/bin/env python3
"""
Texas Capitol Legislative Intelligence - Automated AI Bill Enrichment Pipeline
Auto-fetches full statutory text, evaluates pending bills with Ollama (llama3.1),
and commits each evaluation row-by-row to data/texas_legis.db (SQLite WAL).
"""

import os
import db_store
from hydrate_real_full_texts import ensure_bill_full_text

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")

def load_bill_text_excerpt(bill: dict, max_chars: int = 4000) -> str:
    full_text = ensure_bill_full_text(bill)
    return full_text[:max_chars] if full_text else ""
`,
  },
  {
    filename: 'scripts/hydrate_real_full_texts.py',
    title: 'Statutory Full-Text & Statute Citation Hydrator',
    description:
      'Downloads official Capitol bill HTML/FTP versions via ensure_bill_full_text(), strips page/line margin tables while preserving paragraph indentation, and extracts amended Texas Code chapters.',
    capabilities: [
      'Fetches from Capitol TLO HTTP with automated FTP fallback',
      'Decodes hex/decimal/named HTML entities cleanly',
      'Extracts referenced Texas Codes (Education, Tax, Health & Safety, etc.)',
      'Caches plain text in data/bill_texts/ and persists to SQLite WAL',
    ],
    code: `#!/usr/bin/env python3
"""
Hydrates local cache (data/bill_texts/) with full statutory bill text
and extracts referenced Texas Code chapters for direct statute lookups.
"""

import os, re, html

def clean_legislative_html(raw_html: str) -> str:
    cleaned = re.sub(r"<(head|style|script)[^>]*>.*?</\\1>", "", raw_html, flags=re.S | re.I)
    cleaned = re.sub(r"<td[^>]*width=[\"']?65[\"']?[^>]*>.*?</td>", "", cleaned, flags=re.S | re.I)
    cleaned = re.sub(r"<tr[^>]*>", "\\n", cleaned, flags=re.I)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    return html.unescape(cleaned).strip()
`,
  },
];
