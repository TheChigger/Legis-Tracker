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
        'Connects directly to ftp.legis.state.tx.us to parse daily House/Senate filed reports and monitor history_periodic.xml for same-day bill filings, normalizing metadata and committee actions into src/data/realBills.json.',
      output: 'Live bill catalog synced to Capitol FTP',
    },
    {
      id: 'text-hydration',
      schedule: 'On Demand / Batch',
      title: 'Statutory Full-Text & Code Citation Hydration',
      description:
        'Retrieves official HTML bill texts from Capitol servers, converts legislative margin formatting and redlines into clean readable text in data/bill_texts/, and extracts referenced Texas Statutes chapters.',
      output: 'Clean plain-text archive & statute links',
    },
    {
      id: 'ai-enrichment',
      schedule: 'Hourly (:30)',
      title: 'Local Ollama (Llama 3.1) 7-Domain Policy Analysis',
      description:
        'Reads bill captions and cached statutory text excerpts to generate SUPPORT, OPPOSE, or NEEDS REVIEW assessments across Church/State, Public Education, LGBTQ+ Rights, Healthcare, Transit, Fiscal Policy, and 2nd Amendment nuance.',
      output: 'Structured stance, triggers & plain-English summary',
    },
    {
      id: 'hybrid-search',
      schedule: 'Real-Time API',
      title: 'Grounded Legislative Research Assistant',
      description:
        'Pairs the live Capitol database with Gemini reasoning and the 7-domain legislative analyst system prompt for instant bill comparisons, lawmaker filing timelines, and trade-off reviews.',
      output: 'Interactive /api/ai/query synthesis',
    },
  ] as PipelineStage[],
};

export const PIPELINE_SCRIPTS: PythonScriptDoc[] = [
  {
    filename: 'scripts/ingest_real_texas_data.py',
    title: 'TLO FTP Master & Intraday Ingestion Engine',
    description:
      'Synchronizes overnight House/Senate filed reports and the live history_periodic.xml intraday feed directly from the Texas Legislature Online FTP portal.',
    capabilities: [
      'Reads daily housefiled.htm & senatefiled.htm FTP reports',
      'Polls live history_periodic.xml for newly introduced bills',
      'Direction-aware baseline stance classification',
      'Atomic JSON writes to prevent partial database reads',
    ],
    code: `#!/usr/bin/env python3
"""
Texas Capitol Real-Time Data Ingestion Script
Fetches authentic data from Texas Legislature Online (TLO) FTP portal:
1. Daily baseline reports (housefiled.htm, senatefiled.htm)
2. Live intraday XML feed: ftp://ftp.legis.state.tx.us/bills/90R/billhistory/history_periodic.xml
3. Individual bill history XML files for newly filed bills
"""

import urllib.request
import re
import json
import os
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

BILLS_JSON_PATH = "src/data/realBills.json"

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
      'Evaluates filed bills and cached full statutory text excerpts against the 7-domain legislative framework (with nuanced 2nd Amendment and Tax/Surplus rules).',
    capabilities: [
      'Reads up to 3,500 chars of cached full statutory text per bill',
      'Distinguishes repeals vs. enactments (e.g. ESA repeal -> SUPPORT)',
      'Applies nuanced rules for 2nd Amendment & Budget Surplus',
      'Supports --re-enrich flag to upgrade prior evaluations',
    ],
    code: `#!/usr/bin/env python3
"""
Texas Capitol Legislative Intelligence - Automated AI Bill Enrichment Pipeline
Evaluates pending bills using local Ollama (llama3.1) against the 7-domain framework:
1. Separation of Church & State (Strict)
2. Public Education & School Funding
3. Civil Rights & LGBTQ+ / Transgender Equality
4. Healthcare, Medicare & Medicaid
5. Transportation, Transit & Multimodal Infrastructure
6. Taxation, Fiscal Policy & Budget Surplus (Nuanced)
7. Second Amendment & Practical Gun Safety (Nuanced)
"""

import os, json, re, urllib.request

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")

def evaluate_with_ollama(bill_number: str, author: str, caption: str, text_excerpt: str) -> dict:
    # Sends structured prompt + statutory excerpt to local Ollama daemon
    # Returns recommended_stance (SUPPORT | OPPOSE | NEEDS REVIEW),
    # confidence, policy_triggers, what_it_does bullets, and reasoning.
    ...
`,
  },
  {
    filename: 'scripts/hydrate_real_full_texts.py',
    title: 'Statutory Full-Text & Statute Citation Hydrator',
    description:
      'Downloads official Capitol bill HTML versions, strips page/line margin tables while preserving paragraph indentation, and extracts amended Texas Code chapters.',
    capabilities: [
      'Decodes hex/decimal/named HTML entities cleanly',
      'Preserves statutory section structure and indentation',
      'Extracts referenced Texas Codes (Education, Tax, Health & Safety, etc.)',
      'Caches plain text locally in data/bill_texts/',
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
