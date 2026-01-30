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
        # Using gemini's embedding model
        self.client = genai.Client(api_key=api_key)

        # Text embedding 004 is perfect as it is trained on massive codebases
        # Has exactly 768-dimensional vectors dense enough for low latency searches 
        self.embedding_model = "text-embedding-004"

        # Persistent client retains connection even after server restarts
        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")

    def _get_repo_hash(self, repo_url: str) -> str:
        """
        Generates a repo hash using repo URL.
        This is used to check if we have already indexed a repo.
        """
        clean_url = repo_url.lower().strip().rstrip('/')
        # TODO: Add latest commit hash of the codebase along with repo URL
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
            
            # To see if the collection actually has data
            count = col.count()
            if count > 0:
                return True, col.metadata 
                
            return False, None
        except Exception as e:
            logger.warning(f"Collection check failed for {collection_name}: {str(e)}")
            return False, None

    def add_documents(self, repo_url: str, chunks: list, branch: str = "master"):
        if not chunks:
            return "No chunks to index."

        collection_name = self._get_repo_hash(repo_url)
        
        try:
            self.chroma_client.delete_collection(name=collection_name)
            logger.info(f"Wiped existing collection for {repo_url}")
        except Exception:
            pass

        collection = self.chroma_client.create_collection(
            name=collection_name,
            metadata={"branch": branch, "repo_url": repo_url} 
        )

        documents = [c["page_content"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        ids = [f"{collection_name}_{i}" for i in range(len(documents))]

        # Batch embedding to save time
        batch_size = 100
        all_embeddings = []
        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i : i + batch_size]
            embed_response = self.client.models.embed_content(
                model=self.embedding_model,
                contents=batch_docs,
                # This tells the embedding model to embed this data as 'searchable'
                # It will be used as query-able vector during embedding
                # This optimizes vector for long form content
                # While querying, we will use "RETRIEVAL_QUERY" as task type
                # TODO: We can pass title as file path including extension to add more context
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
            # This optimizes embedding as more of a 'search query' than a 'searchable block'
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
        ).embeddings[0].values

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        
        return [
            {
                "content": doc, 
                "source": meta.get("source", "unknown"),
                "start_line": meta.get("start_line", 1),
                "end_line": meta.get("end_line", 1)
            }
            for doc, meta in zip(results['documents'][0], results['metadatas'][0])
        ]