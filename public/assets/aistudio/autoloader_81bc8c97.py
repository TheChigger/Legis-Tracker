import sqlite3
import chromadb
from chromadb.utils import embedding_functions

# Connect to SQLite
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

# Connect to Persistent Chroma
chroma_client = chromadb.PersistentClient(path="./chroma_db")
ef = embedding_functions.DefaultEmbeddingFunction()
collection = chroma_client.get_or_create_collection(name="bill_chunks", embedding_function=ef)

def populate_bills(bill_list):
    sql_records = []
    docs, metadatas, ids = [], [], []

    for bill in bill_list:
        sql_records.append((
            bill['bill_id'],
            bill['author'],
            bill['bill_number'],
            bill['filing_date'],
            bill['effective_date'],
            bill['caption']
        ))
        
        # Chunk text provisions for Chroma
        for idx, chunk in enumerate(bill['chunks']):
            docs.append(chunk)
            metadatas.append({
                "bill_id": bill['bill_id'],
                "author": bill['author'],
                "filing_date": bill['filing_date']
            })
            ids.append(f"{bill['bill_id']}_chunk_{idx}")

    # Insert into SQL
    cursor.executemany("""
        INSERT OR REPLACE INTO bill_metadata VALUES (?, ?, ?, ?, ?, ?)
    """, sql_records)
    conn.commit()

    # Insert into Chroma Vector DB
    if docs:
        collection.add(documents=docs, metadatas=metadatas, ids=ids)
    print(f"Successfully ingested {len(bill_list)} bills into database.")

# Replace this array with your actual scraped/parsed TLO dataset
sample_tlo_data = [
    {
        "bill_id": "HB817",
        "author": "Harrison",
        "bill_number": 817,
        "filing_date": "2024-11-12",
        "effective_date": "2027-09-01",
        "caption": "Relating to healthcare provider fee disclosures.",
        "chunks": ["HB 817 mandates that healthcare providers must publish itemized prices prior to treatment."]
    },
    {
        "bill_id": "HB1049",
        "author": "Harrison",
        "bill_number": 1049,
        "filing_date": "2024-12-05",
        "effective_date": "2028-01-01",
        "caption": "Relating to voter identification requirements.",
        "chunks": ["HB 1049 requires specific forms of identification when casting a ballot in Texas elections."]
    },
    {
        "bill_id": "HB300",
        "author": "Smith",
        "bill_number": 300,
        "filing_date": "2024-11-10",
        "effective_date": "2025-09-01",
        "caption": "Relating to state highway funding allocations.",
        "chunks": ["HB 300 allocates surplus tax revenues directly toward rural infrastructure."]
    }
]

if __name__ == "__main__":
    populate_bills(sample_tlo_data)
