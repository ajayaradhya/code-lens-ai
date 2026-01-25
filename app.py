import asyncio
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.ingestor import RepoIngestor
from src.processor import CodeProcessor
from src.vector_store import VectorStoreManager
from src.brain import CodeLensBrain
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="CodeLensAI API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: Replace with proper URL in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize our components
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("Missing API Key. Please set 'GEMINI_API_KEY' in the environment.")

vector_store = VectorStoreManager(api_key=api_key)
processor = CodeProcessor()
brain = CodeLensBrain(api_key=api_key)

# Request Models
class IngestRequest(BaseModel):
    repo_url: str

class QueryRequest(BaseModel):
    question: str

@app.post("/ingest")
async def ingest_repository(request: IngestRequest):
    async def event_generator():
        try:
            # Helper to wrap the data in SSE format
            def sse_format(status: str, message: str, summary: dict = None):
                payload = {"status": status, "message": message}
                if summary:
                    payload["summary"] = summary
                return f"data: {json.dumps(payload)}\n\n"

            # Stage 1: Cloning
            yield sse_format("cloning", "Cloning repository...")
            ingestor = RepoIngestor(request.repo_url)
            raw_data = await asyncio.to_thread(ingestor.ingest)
            
            if raw_data.get("errors") and not raw_data.get("extracted_code"):
                yield sse_format("error", f"Ingestion Error: {raw_data['errors']}")
                return

            # Stage 2: Processing/Chunking
            yield sse_format("processing", "Parsing and chunking code...")
            processed_data = await asyncio.to_thread(processor.process, raw_data["extracted_code"])

            # Stage 3: Vectorizing
            chunk_count = len(processed_data.get("chunks", []))
            yield sse_format("vectorizing", f"Indexing {chunk_count} code chunks...")
            
            # Offload heavy vector store IO to a thread
            status = await asyncio.to_thread(vector_store.add_documents, processed_data["chunks"])

            # Stage 4: Final Summary
            yield sse_format(
                status=status, 
                message="Successfully indexed architecture.",
                summary=processed_data.get("summary")
            )

        except Exception as e:
            yield sse_format("error", f"System Failure: {str(e)}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/query")
async def query_codebase(request: QueryRequest):
    """
    Step 3: Semantic Search and LLM Reasoning
    """
    # 1. Search for relevant snippets
    context = vector_store.search(request.question)

    print(f"DEBUG: Found {len(context)} snippets for query.")
    for i, res in enumerate(context):
        print(f"Snippet {i} Source: {res['source']}")
    
    if not context:
        return {"answer": "I couldn't find any relevant code to answer that."}
    
    # 2. Get the answer from the Brain
    return StreamingResponse(
        brain.generate_answer_stream(request.question, context),
        media_type="text/event-stream"
    )
