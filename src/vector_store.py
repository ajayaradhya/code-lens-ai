import chromadb
import hashlib
from google import genai
from google.genai import types

class VectorStoreManager:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.embedding_model = "text-embedding-004"
        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
        # We no longer initialize a single collection here

    def _get_repo_hash(self, repo_url: str) -> str:
        """Creates a safe, unique collection name from a URL."""
        # ChromaDB collection names must be 3-63 chars, start/end with alnum
        clean_url = repo_url.lower().strip().rstrip('/')
        hash_obj = hashlib.md5(clean_url.encode())
        return f"repo_{hash_obj.hexdigest()}"

    def check_if_indexed(self, repo_url: str) -> bool:
        """Returns True if a collection for this repo exists and has data."""
        collection_name = self._get_repo_hash(repo_url)
        try:
            col = self.chroma_client.get_collection(name=collection_name)
            return col.count() > 0
        except Exception:
            return False

    def add_documents(self, repo_url: str, chunks: list):
        if not chunks:
            return "No chunks to index."

        collection_name = self._get_repo_hash(repo_url)
        # Get or create the specific collection for this repo
        collection = self.chroma_client.get_or_create_collection(name=collection_name)

        documents = [c["page_content"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        ids = [f"id_{i}_{m['source']}" for i, m in enumerate(metadatas)]

        batch_size = 100
        all_embeddings = []

        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i : i + batch_size]
            embed_response = self.client.models.embed_content(
                model=self.embedding_model,
                contents=batch_docs,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            all_embeddings.extend([e.values for e in embed_response.embeddings])

        collection.add(
            ids=ids,
            embeddings=all_embeddings,
            documents=documents,
            metadatas=metadatas
        )
        return "ready"

    def search(self, repo_url: str, query: str, n_results: int = 5):
        collection_name = self._get_repo_hash(repo_url)
        collection = self.chroma_client.get_collection(name=collection_name)

        query_embedding = self.client.models.embed_content(
            model=self.embedding_model,
            contents=query,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
        ).embeddings[0].values

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        
        return [
            {"content": doc, "source": meta["source"]}
            for doc, meta in zip(results['documents'][0], results['metadatas'][0])
        ]