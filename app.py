import asyncio
import json
import os
import logging
import time
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.ingestor import RepoIngestor
from src.processor import CodeProcessor
from src.vector_store import VectorStoreManager
from src.brain import CodeLensBrain

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("CodeLensAI")

load_dotenv()

app = FastAPI(title="CodeLensAI API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logger.critical("GEMINI_API_KEY not found in environment variables")
    raise ValueError("Missing API Key")

vector_store = VectorStoreManager(api_key=api_key)
processor = CodeProcessor()
brain = CodeLensBrain(api_key=api_key)

class IngestRequest(BaseModel):
    repo_url: str

class QueryRequest(BaseModel):
    question: str
    repo_url: str

@app.post("/ingest")
async def ingest_repository(request: IngestRequest):
    repo_name = request.repo_url.split("/")[-1]
    start_time = time.time()
    
    logger.info(f"Ingestion process started: {request.repo_url}")

    async def event_generator():
        try:
            def sse_format(status: str, message: str, summary: dict = None):
                log_msg = f"[{repo_name}] {status.upper()}: {message}"
                if status == "error":
                    logger.error(log_msg)
                else:
                    logger.info(log_msg)
                return f"data: {json.dumps({'status': status, 'message': message, 'summary': summary})}\n\n"

            # 1. Persistence Check
            if vector_store.check_if_indexed(request.repo_url):
                yield sse_format("ready", "Cache hit: repository already indexed", {"cached": True})
                return

            # 2. Ingestion/Cloning
            yield sse_format("cloning", "Cloning repository")
            ingestor = RepoIngestor(request.repo_url)
            raw_data = await asyncio.to_thread(ingestor.ingest)
            
            branch = raw_data.get("branch", "main")
            if raw_data.get("errors") and not raw_data.get("extracted_code"):
                yield sse_format("error", f"Cloning failed: {raw_data['errors']}")
                return

            # 3. Processing
            yield sse_format("processing", f"Parsing {len(raw_data['extracted_code'])} files")
            processed_data = await asyncio.to_thread(processor.process, raw_data["extracted_code"])

            # 4. Vectorizing
            chunk_count = len(processed_data.get("chunks", []))
            yield sse_format("vectorizing", f"Generating embeddings for {chunk_count} chunks")
            
            await asyncio.to_thread(
                vector_store.add_documents, 
                request.repo_url, 
                processed_data["chunks"]
            )

            # Final Success
            duration = round(time.time() - start_time, 2)
            logger.info(f"Ingestion completed for {repo_name} in {duration} seconds")
            
            yield sse_format(
                status="ready", 
                message=f"Indexing completed (branch: {branch})",
                summary={**processed_data.get("summary", {}), "branch": branch, "execution_time": duration}
            )

        except Exception as e:
            logger.exception(f"System failure during ingestion: {request.repo_url}")
            yield sse_format("error", f"Internal Server Error: {str(e)}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/query")
async def query_codebase(request: QueryRequest):
    logger.info(f"Query received for {request.repo_url}: {request.question[:50]}...")
    
    try:
        context = vector_store.search(request.repo_url, request.question)
        
        if not context:
            logger.warning(f"No relevant context found for query: {request.question}")
            return StreamingResponse(iter(["data: No relevant code snippets found in the current index.\n\n"]), media_type="text/event-stream")
        
        logger.info(f"Context retrieval successful: {len(context)} snippets retrieved")
        return StreamingResponse(
            brain.generate_answer_stream(request.question, context),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Query processing failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal query processing error")