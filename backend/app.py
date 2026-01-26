# Copyright 2026 Ajay Aradhya
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 

import asyncio
import json
import os
import logging
import time
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
        # 1. Retrieval Phase
        # Ensure search() returns 'source', 'start_line', 'end_line', and 'content'
        context = vector_store.search(request.repo_url, request.question)
        
        if not context:
            # We return a plain string so the UI can render it as a standard message
            return StreamingResponse(
                iter(["I couldn't find any relevant code snippets to answer that question."]), 
                media_type="text/plain"
            )

        # 2. Streaming Wrapper
        async def stream_wrapper():
            try:
                # generate_answer_stream now handles the <cite> tags 
                # and yields METADATA_BATCH: {json} at the very end.
                async for chunk in brain.generate_answer_stream(request.question, context):
                    yield chunk
            except Exception as e:
                logger.error(f"Streaming error: {e}")
                yield f"\n\n[Error during generation: {str(e)}]"

        return StreamingResponse(stream_wrapper(), media_type="text/plain")

    except Exception as e:
        logger.error(f"Query endpoint failed: {e}")
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
    

static_path = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_path, "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Construct the physical path
        file_path = os.path.join(static_path, full_path)
        
        # If the file actually exists (like code-lens-logo.svg), serve it
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Otherwise, if it's not an API call, serve the index.html for React
        if not full_path.startswith("api"):
            return FileResponse(os.path.join(static_path, "index.html"))
        
        return {"error": "Not Found"}