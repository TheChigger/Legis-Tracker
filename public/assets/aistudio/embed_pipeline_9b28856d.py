#!/usr/bin/env python3
"""
Texas Capitol AI Vectorization Engine (Ollama + ChromaDB)
Ingests full text strings from SQLite, processes semantic text fragments,
and generates local embeddings via nomic-embed-text.
"""
import sqlite3
import ollama
import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from datetime import datetime

class TexasCapitolAIEngine:
    def __init__(self, sql_db="texas_capitol_structured.db", vector_db_dir="./chroma_db"):
        self.sql_db = sql_db
        # Initialize an on-disk vector filing cabinet
        self.chroma_client = chromadb.PersistentClient(path=vector_db_dir)
        # Create or fetch a unique vector bucket for bill content strings
        self.collection = self.chroma_client.get_or_create_collection(name="texas_bills")
        
        # Setup clean text partitioner to slice large bills logically
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,      # Characters per AI text block
            chunk_overlap=400,    # Text overlap to preserve conversational context
            length_function=len
        )

    def process_and_vectorize(self):
        print("Connecting to local databases...")
        with sqlite3.connect(self.sql_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT version_key, bill_id, version_status, full_text, caption FROM bill_versions")
            rows = cursor.fetchall()
        
        if not rows:
            print("No bills found in your SQLite directory.")
            return
        print(f"Syncing {len(rows)} bill versions into local vector database...")
        
        for version_key, bill_id, version_status, full_text, caption in rows:
            if not full_text or len(full_text.strip()) < 50:
                continue
                
            # 1. Segment multi-page bills into legal text pieces
            chunks = self.text_splitter.split_text(full_text)
            print(f"  -> {bill_id} ({version_status}): Slicing text into {len(chunks)} fragments...")
            
            chunk_texts = []
            chunk_embeddings = []
            chunk_metadatas = []
            chunk_ids = []
            
            for idx, chunk in enumerate(chunks):
                chunk_id = f"{version_key}_chunk_{idx}"
                
                # 2. Call Ollama locally to translate text to engineering vectors
                try:
                    response = ollama.embeddings(model="nomic-embed-text", prompt=chunk)
                    embedding = response["embedding"]
                except Exception as e:
                    print(f"     Ollama embedding failed for {chunk_id}: {e}")
                    continue
                
                chunk_texts.append(chunk)
                chunk_embeddings.append(embedding)
                chunk_metadatas.append({"bill_id": bill_id, "version_status": version_status, "version_key": version_key, "caption": caption})
                chunk_ids.append(chunk_id)
            
            # 3. Upsert vectors directly into the Chroma filing database
            if chunk_ids:
                self.collection.upsert(
                    ids=chunk_ids,
                    embeddings=chunk_embeddings,
                    metadatas=chunk_metadatas,
                    documents=chunk_texts
                )
                
        print("\nVector generation pipeline complete! Chroma database fully synchronized.")

    def semantic_search_test(self, query, num_results=3):
        print(f"\n[Semantic Search] Searching for: '{query}'")
        try:
            query_embedding = ollama.embeddings(model="nomic-embed-text", prompt=query)["embedding"]
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=num_results
            )
            
            print("Top matches retrieved out of vector database:")
            for idx in range(len(results['ids'][0])):
                doc = results['documents'][0][idx]
                meta = results['metadatas'][0][idx]
                print(f"\n  Match #{idx+1}: {meta['bill_id']} ({meta['version_status']})")
                print(f"  Caption: {meta['caption']}")
                print(f"  Text Excerpt: {doc[:180]}...")
                print("-" * 50)
        except Exception as e:
            print(f"Search test crashed: {e}")

if __name__ == "__main__":
    engine = TexasCapitolAIEngine()
    engine.process_and_vectorize()
    engine.semantic_search_test("artificial intelligence and medical applications")
