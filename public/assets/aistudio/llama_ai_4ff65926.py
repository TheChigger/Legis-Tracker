import sqlite3
import chromadb
import ollama
from openai import OpenAI

# Connect to SQLite database produced by pipeline.py
conn = sqlite3.connect("texas_capitol_structured.db", check_same_thread=False)
cursor = conn.cursor()

# Connect to Chroma Vector DB collection produced by embed_pipeline.py
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="texas_bills")

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"
)

def generate_answer(user_query):
    query_lower = user_query.lower()
    sql_lines = []
    
    # 1. Parse Query Intent for Filters
    author_filter = "Harrison" if "harrison" in query_lower else None

    bill_type_filter = None
    if "house bill" in query_lower or " hb" in query_lower or query_lower.startswith("hb"):
        bill_type_filter = "HB"
    elif "senate bill" in query_lower or " sb" in query_lower or query_lower.startswith("sb"):
        bill_type_filter = "SB"

    # Build SQL filters dynamically
    where_clauses = []
    params = []

    if author_filter:
        where_clauses.append("a.author_name LIKE ?")
        params.append(f"%{author_filter}%")
    if bill_type_filter:
        where_clauses.append("(v.bill_type = ? OR v.bill_id LIKE ?)")
        params.extend([bill_type_filter, f"{bill_type_filter}%"])

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    # Execute SQL Count Query
    count_query = f"""
        SELECT COUNT(DISTINCT v.bill_id) 
        FROM bill_versions v
        LEFT JOIN bill_authors a ON v.bill_id = a.bill_id
        {where_sql}
    """
    cursor.execute(count_query, params)
    count = cursor.fetchone()[0]

    # Label scope for LLM prompt context
    scope_desc = []
    if bill_type_filter: scope_desc.append(f"{bill_type_filter} (House/Senate) bills")
    if author_filter: scope_desc.append(f"authored by {author_filter}")
    scope_str = " ".join(scope_desc) if scope_desc else "total unique bills across all types and authors"
    
    sql_lines.append(f"Exact SQL Count of {scope_str} in database: {count}")

    # Retrieve Sample/Chronological Bills Under Same Scope
    list_query = f"""
        SELECT DISTINCT v.bill_id, v.discovered_at, v.caption 
        FROM bill_versions v
        LEFT JOIN bill_authors a ON v.bill_id = a.bill_id
        {where_sql}
        ORDER BY v.discovered_at ASC LIMIT 5
    """
    cursor.execute(list_query, params)
    rows = cursor.fetchall()
    if rows:
        sql_lines.append(f"Sample matching bills ({len(rows)} shown):")
        for r in rows:
            sql_lines.append(f"- {r[0]} (Discovered: {r[1]}): {r[2]}")

    sql_context = "\n".join(sql_lines)

    # 2. Vector DB Retrieval
    vector_context = "No vector text chunks retrieved."
    try:
        query_embedding = ollama.embeddings(model="nomic-embed-text", prompt=user_query)["embedding"]
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=4
        )
        if results and results['documents'] and results['documents'][0]:
            docs = results['documents'][0]
            vector_context = "\n---\n".join(docs)
    except Exception as e:
        print(f"[llama_ai] Vector search error: {e}")

    # 3. Prompt Construction
    full_context = f"""=== STRUCTURED METADATA (SQL) ===
{sql_context}

=== BILL PROVISIONS & TEXT (VECTOR DB) ===
{vector_context}"""

    prompt = f"""You are a legislative research assistant. Answer the user's question accurately using ONLY the provided context below.

Context:
{full_context}

Question: {user_query}
Answer:"""

    response = client.chat.completions.create(
        model="llama3.1",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    return response.choices[0].message.content
