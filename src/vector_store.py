"""
VectorStoreManager converts chunks into mathematical vectors.
It uses Google's text-embedding-004 to convert chunk into list of 768 numbers.
Codes that are functionally similar will lie in close proximity of each other in vector space.
"""

import chromadb
from google import genai
from google.genai import types

class VectorStoreManager:
    def __init__(self, api_key: str):
        # 1. Initialize the modern Gemini Client
        self.client = genai.Client(api_key=api_key)
        self.embedding_model = "text-embedding-004"
        
        # 2. Initialize ChromaDB
        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
        self.collection_name = "code_lens_indices"
        
        # 3. Defensive Re-initialization
        # We delete existing collections to ensure a 'Clean Room' environment for each session
        try:
            self.chroma_client.delete_collection(self.collection_name)
        except Exception:
            pass # Collection didn't exist, which is fine
            
        self.collection = self.chroma_client.create_collection(name=self.collection_name)

    def add_documents(self, chunks: list):
        """
        Converts chunks to vectors in batches of 100 to stay within API limits.
        """
        if not chunks:
            return "No chunks to index."

        documents = [c["page_content"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        ids = [f"id_{i}_{m['source']}" for i, m in enumerate(metadatas)]

        # Lead Move: Professional Batching Logic
        batch_size = 100
        all_embeddings = []

        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i : i + batch_size]
            
            # Generate embeddings for this specific batch
            embed_response = self.client.models.embed_content(
                model=self.embedding_model,
                contents=batch_docs,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            
            # Append the new vectors to our master list
            all_embeddings.extend([e.values for e in embed_response.embeddings])

        # Add the full set to ChromaDB
        self.collection.add(
            ids=ids,
            embeddings=all_embeddings,
            documents=documents,
            metadatas=metadatas
        )
        
        return f"Successfully indexed {len(documents)} chunks in {len(range(0, len(documents), batch_size))} batches."

    def search(self, query: str, n_results: int = 5):
        """
        Performs semantic search by embedding the user's query first.
        """
        # Embed the query with the proper task type
        query_embedding = self.client.models.embed_content(
            model=self.embedding_model,
            contents=query,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
        ).embeddings[0].values

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        
        # Clean re-formatting for the Brain
        return [
            {"content": doc, "source": meta["source"]}
            for doc, meta in zip(results['documents'][0], results['metadatas'][0])
        ]