import sqlite3
import json
import re
from openai import OpenAI

# Local Ollama OpenAI-compatible client
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"
)

POLITICAL_CRITERIA = """
Evaluate the bill against these specific policy priorities:

- SUPPORT / HIGH PRIORITY:
  1. Church/State Separation: Bills maintaining or strengthening secular governance and religious neutrality in public institutions.
  2. Healthcare Access: Bills expanding access to medical services, reproductive healthcare, coverage, or lowering care barriers.
  3. Voter Representation: Bills expanding voter access, protecting voting rights, or facilitating fair representation.

- OPPOSE / HIGH PRIORITY:
  1. Church/State Separation: Bills blurring religious neutrality in public schools/government offices or mandating religious displays/practices.
  2. Healthcare Access: Bills restricting medical access, cutting coverage, or placing regulatory burdens on patient care.
  3. Voter Representation: Bills creating voter registration hurdles, limiting voting windows/mail options, or suppressing voter turnout.

- NEUTRAL:
  Non-substantive administrative edits, local resolutions, highway designations, or routine procedural updates.
"""

def init_analysis_table():
    with sqlite3.connect("texas_capitol_structured.db") as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bill_analysis (
                bill_id TEXT PRIMARY KEY,
                summary TEXT,
                stance TEXT,
                priority_score INTEGER,
                key_takeaways TEXT,
                analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

def analyze_bill_with_llama(bill_id, caption, full_text):
    content = full_text if (full_text and len(full_text.strip()) > 50) else caption
    
    prompt = f"""You are a senior legislative analyst. Analyze the following Texas bill and output strictly valid JSON matching this schema:

{{
  "summary": "2-3 sentence executive summary of what the bill changes.",
  "stance": "SUPPORT" or "OPPOSE" or "NEUTRAL",
  "priority_score": 1 to 5 (5 being massive policy impact, 1 being minor/routine),
  "key_takeaways": ["Point 1", "Point 2"]
}}

Criteria:
{POLITICAL_CRITERIA}

Bill ID: {bill_id}
Caption: {caption}
Bill Text Excerpt:
{content[:3000]}

Return ONLY the raw JSON object. Do not include markdown formatting or explanations."""

    try:
        response = client.chat.completions.create(
            model="llama3.1",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        raw_text = response.choices[0].message.content.strip()
        clean_json = re.sub(r'^```json\s*|\s*```$', '', raw_text, flags=re.MULTILINE).strip()
        return json.loads(clean_json)
    except Exception as e:
        print(f"  [Error] Failed to analyze {bill_id}: {e}")
        return None

def process_unassigned_bills():
    init_analysis_table()
    
    with sqlite3.connect("texas_capitol_structured.db") as conn:
        cursor = conn.cursor()
        
        # Prioritize Session 90R bills in batches of 100
        cursor.execute("""
            SELECT v.bill_id, v.caption, v.full_text 
            FROM bill_versions v
            LEFT JOIN bill_analysis a ON v.bill_id = a.bill_id
            WHERE a.bill_id IS NULL AND v.version_key LIKE '90R_%'
            GROUP BY v.bill_id
            LIMIT 100
        """)
        pending_bills = cursor.fetchall()
        
        print(f"Found {len(pending_bills)} pending 90R bills to analyze in this batch...")
        
        for bill_id, caption, full_text in pending_bills:
            print(f"Analyzing {bill_id} via Llama 3.1...")
            analysis = analyze_bill_with_llama(bill_id, caption, full_text)
            
            if analysis:
                takeaways_str = " | ".join(analysis.get("key_takeaways", []))
                cursor.execute("""
                    INSERT OR REPLACE INTO bill_analysis 
                    (bill_id, summary, stance, priority_score, key_takeaways)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    bill_id,
                    analysis.get("summary", "No summary generated."),
                    analysis.get("stance", "NEUTRAL").upper(),
                    int(analysis.get("priority_score", 1)),
                    takeaways_str
                ))
                conn.commit()
                print(f"  -> {bill_id}: {analysis.get('stance')} (Priority: {analysis.get('priority_score')})")

if __name__ == "__main__":
    process_unassigned_bills()
