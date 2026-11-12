import sqlite3
import chromadb
from chromadb.utils import embedding_functions

# Initialize SQLite Metadata DB
conn = sqlite3.connect("texas_bills.db")
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS bill_metadata (
    bill_id TEXT PRIMARY KEY,
    author TEXT,
    bill_number INT,
    filing_date DATE,
    effective_date DATE,
    caption TEXT
)
""")
conn.commit()

# Use PersistentClient so vectors save to ./chroma_db
chroma_client = chromadb.PersistentClient(path="./chroma_db")
ef = embedding_functions.DefaultEmbeddingFunction()
collection = chroma_client.get_or_create_collection(name="bill_chunks", embedding_function=ef)

def ingest_bill(bill_id, author, bill_num, filing_date, effective_date, caption, chunks):
    cursor.execute("""
        INSERT OR REPLACE INTO bill_metadata VALUES (?, ?, ?, ?, ?, ?)
    """, (bill_id, author, bill_num, filing_date, effective_date, caption))
    conn.commit()
    
    documents = []
    metadatas = []
    ids = []
    for idx, chunk in enumerate(chunks):
        documents.append(chunk)
        metadatas.append({
            "bill_id": bill_id,
            "author": author,
            "filing_date": filing_date
        })
        ids.append(f"{bill_id}_chunk_{idx}")
        
    collection.add(documents=documents, metadatas=metadatas, ids=ids)
