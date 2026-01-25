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
    force: bool = False

class QueryRequest(BaseModel):
    question: str
    repo_url: str

@app.post("/ingest")
async def ingest_repository(request: IngestRequest):
    repo_name = request.repo_url.split("/")[-1]
    start_time = time.time()
    
    async def event_generator():
        try:
            def sse_format(status: str, message: str, summary: dict = None):
                return f"data: {json.dumps({'status': status, 'message': message, 'summary': summary})}\n\n"

            # 1. Persistence Check
            if not request.force:
                is_indexed, metadata = vector_store.check_if_indexed(request.repo_url)
                if is_indexed:
                    cached_branch = metadata.get("branch", "main") if metadata else "main"
                    yield sse_format("ready", f"Using cached index (branch: {cached_branch})", {"cached": True, "branch": cached_branch})
                    return

            # 2. Ingestion
            yield sse_format("cloning", "Cloning repository...")
            ingestor = RepoIngestor(request.repo_url)
            raw_data = await asyncio.to_thread(ingestor.ingest)
            branch = raw_data.get("branch", "main")

            # 3. Processing (Now with Line Awareness)
            yield sse_format("processing", f"Analyzing {len(raw_data['extracted_code'])} files for structure and line mapping...")
            processed_data = await asyncio.to_thread(processor.process, raw_data["extracted_code"])

            # 4. Vectorizing
            chunk_count = len(processed_data.get("chunks", []))
            yield sse_format("vectorizing", f"Generating embeddings for {chunk_count} code segments...")
            await asyncio.to_thread(vector_store.add_documents, request.repo_url, processed_data["chunks"], branch=branch)

            # Final Success
            duration = round(time.time() - start_time, 2)
            yield sse_format("ready", "Repository fully indexed with line-level citations.", {
                **processed_data.get("summary", {}), 
                "branch": branch, 
                "execution_time": duration
            })

        except Exception as e:
            logger.exception("Ingestion failed")
            yield sse_format("error", f"Indexing failed: {str(e)}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/query")
async def query_codebase(request: QueryRequest):
    try:
        # Search now returns list of dicts with: content, source, start_line, end_line
        context = vector_store.search(request.repo_url, request.question)
        
        if not context:
            return StreamingResponse(iter(["data: No relevant context found.\n\n"]), media_type="text/event-stream")

        async def stream_wrapper():
            # The context now contains line numbers which the Brain will use for [file:line] citations
            try:
                async for chunk in brain.generate_answer_stream(request.question, context):
                    yield chunk
            except Exception as e:
                yield f"\n\n[Generation Error: {str(e)}]"

        return StreamingResponse(stream_wrapper(), media_type="text/event-stream")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.delete("/ingest")
async def delete_index(request: IngestRequest):
    try:
        repo_hash = vector_store._get_repo_hash(request.repo_url)
        vector_store.chroma_client.delete_collection(name=repo_hash)
        logger.info(f"Deleted index for: {request.repo_url}")
        return {"status": "success", "message": "Index deleted successfully"}
    except ValueError:
        # Collection already gone or never existed
        return {"status": "success", "message": "Index already clear"}
    except Exception as e:
        logger.error(f"Failed to delete index: {str(e)}")
        return {"status": "error", "message": str(e)}