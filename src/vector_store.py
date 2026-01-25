import logging
import chromadb
import hashlib
from google import genai
from google.genai import types

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("CodeLensAI")

class VectorStoreManager:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.embedding_model = "text-embedding-004"
        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")

    def _get_repo_hash(self, repo_url: str) -> str:
        clean_url = repo_url.lower().strip().rstrip('/')
        hash_obj = hashlib.md5(clean_url.encode())
        return f"repo_{hash_obj.hexdigest()}"

    def check_if_indexed(self, repo_url: str):
        collection_name = self._get_repo_hash(repo_url)
        try:
            # list_collections() is the most reliable way to check physical existence
            existing = [c.name for c in self.chroma_client.list_collections()]
            if collection_name not in existing:
                return False, None

            col = self.chroma_client.get_collection(name=collection_name)
            
            # Smoke test
            count = col.count()
            if count > 0:
                return True, col.metadata 
                
            return False, None
        except Exception as e:
            logger.warning(f"Collection check failed for {collection_name}: {str(e)}")
            return False, None

    def add_documents(self, repo_url: str, chunks: list, branch: str = "main"):
        if not chunks:
            return "No chunks to index."

        collection_name = self._get_repo_hash(repo_url)
        
        # We store the branch name in the COLLECTION metadata, not just individual chunks
        collection = self.chroma_client.get_or_create_collection(
            name=collection_name,
            metadata={"branch": branch} 
        )

        documents = [c["page_content"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        ids = [f"id_{i}_{m.get('source', 'chunk')}" for i, m in enumerate(metadatas)]

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
            {"content": doc, "source": meta.get("source", "unknown")}
            for doc, meta in zip(results['documents'][0], results['metadatas'][0])
        ]