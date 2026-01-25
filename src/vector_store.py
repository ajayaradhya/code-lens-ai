"""
VectorStoreManager converts chunks into mathematical vectors.
It uses Google's text-embedding-004 to convert chunk into list of 768 numbers.
Codes that are functionally similar will lie in close proximity of each other in vector space.
"""

import chromadb
from chromadb.utils import embedding_functions
import os

class VectorStoreManager:
    def __init__(self, api_key):
        # 1. Initialize Google's Embedding Function
        self.embedding_fn = embedding_functions.GoogleGenerativeAiEmbeddingFunction(
            api_key=api_key,
            model_name="models/text-embedding-004"
        )
        
        # 2. Initialize Ephemeral (In-Memory) Chroma Client
        self.client = chromadb.Client()
        self.collection_name = "code_snippets"
        
        # Ensure we start fresh
        try:
            self.client.delete_collection(self.collection_name)
        except:
            pass
            
        self.collection = self.client.create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_fn
        )

    def add_documents(self, chunks):
        """
        Takes the output of CodeProcessor and adds it to ChromaDB.
        """
        # Prepare data for ChromaDB format
        ids = [f"id_{i}" for i in range(len(chunks))]
        documents = [c["page_content"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]

        # Batching for stability
        batch_size = 100
        for i in range(0, len(documents), batch_size):
            self.collection.add(
                ids=ids[i:i+batch_size],
                documents=documents[i:i+batch_size],
                metadatas=metadatas[i:i+batch_size]
            )
        
        return f"Successfully indexed {len(documents)} chunks."

    def search(self, query, n_results=5):
        """
        Finds the most relevant code snippets for a given question.
        """
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        # Reformat results for easier use by the LLM
        formatted_context = []
        for i in range(len(results['documents'][0])):
            formatted_context.append({
                "content": results['documents'][0][i],
                "source": results['metadatas'][0][i]['source']
            })
        return formatted_context
