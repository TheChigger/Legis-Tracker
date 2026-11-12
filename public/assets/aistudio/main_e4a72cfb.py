"""
Texas Capitol AI Application Server (v9.4 - Production Logic & Chroma Fix)
Engineered for reliable SQLite context retrieval, dynamic author matching,
and seamless vector injection into local Llama 3.1 inference streams.
"""
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import sqlite3
import chromadb
import ollama
import uvicorn
import re
from typing import List, Dict, Any

app = FastAPI(title="Texas Capitol Advanced Agent UI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SQL_DB = "texas_capitol_structured.db"
CHROMA_DIR = "./chroma_db"

# Initialize Persistent Vector Database Client
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
collection = chroma_client.get_or_create_collection(name="texas_bills")


def get_db_connection():
    conn = sqlite3.connect(SQL_DB)
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/dashboard", response_class=HTMLResponse)
def get_visual_webpage():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="index.html not found.")


@app.get("/stats")
def get_dashboard_stats():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM bill_versions")
            total_versions = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(DISTINCT bill_id) FROM bill_versions")
            total_unique_bills = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(DISTINCT author_name) FROM bill_authors")
            total_authors = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM amendments_and_notes")
            total_sidecars = cursor.fetchone()[0]

        return {
            "total_tracked_versions": total_versions,
            "total_unique_bills": total_unique_bills,
            "total_authors_registered": total_authors,
            "total_secondary_documents": total_sidecars
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/authors")
def get_top_authors(limit: int = 10):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT author_name, COUNT(bill_id) as bill_count 
                FROM bill_authors 
                GROUP BY author_name 
                ORDER BY bill_count DESC 
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
        return [{"author": row["author_name"], "bills_filed": row["bill_count"]} for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ai-chat")
def structured_ai_agent_chat(q: str = Query(..., description="Query terminal prompt pipeline.")):
    try:
        q_lower = q.lower()
        injected_facts: List[str] = []
        source_materials = set()
        detected_author = None

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Dynamic Author Detection (Scans SQLite for registered lawmakers)
            cursor.execute("SELECT DISTINCT author_name FROM bill_authors")
            all_authors = [row["author_name"] for row in cursor.fetchall()]

            for author in all_authors:
                # Check for surname match in the user prompt
                surname = author.split()[-1].lower()
                if len(surname) > 2 and surname in q_lower:
                    detected_author = author
                    break

            # Global Bill Counts
            if any(k in q_lower for k in ["how many bills", "total", "count"]):
                cursor.execute("SELECT COUNT(DISTINCT bill_id) FROM bill_versions")
                g_total = cursor.fetchone()[0]
                injected_facts.append(f"FACT: Total unique bills indexed across all chambers is {g_total}.")
                source_materials.add("Database Global Counters")

            # Author-Specific Bill Metadata
            if detected_author:
                cursor.execute("""
                    SELECT ba.bill_id, bv.caption, bv.bill_num
                    FROM bill_authors ba
                    LEFT JOIN bill_versions bv ON ba.bill_id = bv.bill_id
                    WHERE ba.author_name LIKE ?
                    GROUP BY ba.bill_id
                    ORDER BY bv.bill_num ASC
                """, (f"%{detected_author}%",))
                author_bills = cursor.fetchall()

                # Fallback text scanner if bill_authors linkage is incomplete
                if not author_bills:
                    surname = detected_author.split()[-1]
                    cursor.execute("""
                        SELECT bill_id, caption, bill_num 
                        FROM bill_versions 
                        WHERE full_text LIKE ? OR full_text LIKE ?
                        ORDER BY bill_num ASC
                    """, (f"%By: {surname}%", f"%By:\n{surname}%"))
                    author_bills = cursor.fetchall()

                if author_bills:
                    b_ids = [row["bill_id"] for row in author_bills]
                    first_bill_id = author_bills[0]["bill_id"]
                    first_bill_caption = author_bills[0]["caption"] or "No Caption Available"

                    injected_facts.append(
                        f"FACT: Lawmaker {detected_author} has filed exactly {len(author_bills)} bills. "
                        f"Their complete bill list includes: {', '.join(b_ids)}."
                    )
                    injected_facts.append(
                        f"FACT: {detected_author}'s chronological earliest/first bill is {first_bill_id} "
                        f"which has the caption: '{first_bill_caption}'."
                    )
                    source_materials.add(f"SQL Automated Extraction Tracker: {detected_author}")

            # Chronological Earliest Bills Query
            if any(k in q_lower for k in ["first", "earliest", "chronological"]):
                cursor.execute("SELECT bill_id, caption FROM bill_versions WHERE bill_type = 'HB' ORDER BY bill_num ASC LIMIT 1")
                first_hb = cursor.fetchone()
                cursor.execute("SELECT bill_id, caption FROM bill_versions WHERE bill_type = 'SB' ORDER BY bill_num ASC LIMIT 1")
                first_sb = cursor.fetchone()

                if first_hb:
                    injected_facts.append(f"FACT: The first House Bill indexed chronologically is {first_hb['bill_id']} (Caption: '{first_hb['caption']}').")
                if first_sb:
                    injected_facts.append(f"FACT: The first Senate Bill indexed chronologically is {first_sb['bill_id']} (Caption: '{first_sb['caption']}').")
                source_materials.add("SQL Timeline Matrix Sorted Query")

        # =====================================================================
        # SEMANTIC CHROMADB VECTOR RETRIEVAL (Fixed Nested 2D Array Handling)
        # =====================================================================
        context_chunks: List[str] = []
        try:
            query_embedding = ollama.embeddings(model="nomic-embed-text", prompt=q)["embedding"]
            vector_results = collection.query(query_embeddings=[query_embedding], n_results=15)

            if vector_results and vector_results.get("documents") and len(vector_results["documents"]) > 0:
                docs = vector_results["documents"][0]
                metas = vector_results["metadatas"][0]

                for doc_chunk, meta in zip(docs, metas):
                    bill_id = meta.get("bill_id", "Unknown Bill")
                    status = meta.get("version_status", "General")
                    source_materials.add(f"{bill_id} ({status})")
                    context_chunks.append(f"--- Document Snippet from {bill_id} ---\n{doc_chunk}")
        except Exception as vec_err:
            print(f"Vector search warning: {vec_err}")

        facts_summary = "\n".join(injected_facts) if injected_facts else "None available."
        semantic_summary = "\n\n".join(context_chunks) if context_chunks else "No semantic snippets found."

        # =====================================================================
        # CONTEXT INJECTION SYNTHESIS & INFERENCE
        # =====================================================================
        system_instructions = (
            "You are an expert legislative intelligence AI assistant analyzing files for the Texas Capitol. "
            "State the exact bill counts and list array elements provided in the VERIFIED SYSTEM STATISTICAL FACTS verbatim at the very beginning of your response. "
            "Synthesize the provided structural facts and document text fragments into a single, cohesive, highly professional response. "
            "STRICT GROUNDING: You must base your answer ONLY on the provided VERIFIED SYSTEM STATISTICAL FACTS and SEMANTIC TEXT CORES. "
            "If the information required to answer the question is not present in the provided context, state that explicitly. "
            "Do not use outside knowledge, do not guess, and do not hallucinate details about bills or dates. "
            "Maintain an objective, highly intelligent tone."
        )

        unified_prompt = (
            f"VERIFIED SYSTEM STATISTICAL FACTS:\n{facts_summary}\n\n"
            f"SEMANTIC TEXT CORES:\n{semantic_summary}\n\n"
            f"USER QUESTION: {q}\n\n"
            f"Provide a clear, detailed, synthesized answer addressing all parts of the user's question:"
        )

        llm_response = ollama.generate(
            model="llama3.1",
            prompt=unified_prompt,
            system=system_instructions
        )

        return {
            "question": q,
            "answer": llm_response["response"],
            "source_material_used": list(source_materials)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
