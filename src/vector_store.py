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
        self.chroma_client = chromadb.Client()
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
        Converts chunks to vectors and stores them in ChromaDB.
        """
        if not chunks:
            return "No chunks to index."

        documents = [c["page_content"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        ids = [f"id_{i}_{m['source']}" for i, m in enumerate(metadatas)]

        # 4. Manual Embedding Generation
        # We generate embeddings ourselves so we aren't reliant on DB-specific plugins
        embed_response = self.client.models.embed_content(
            model=self.embedding_model,
            contents=documents,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
        )
        
        # Extract vectors from response
        embeddings = [e.values for e in embed_response.embeddings]

        # 5. Add to collection
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        
        return f"Successfully indexed {len(documents)} chunks."

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