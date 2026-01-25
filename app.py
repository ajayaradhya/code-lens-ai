from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
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
    """
    Step 1 & 2: Clone and Process the Repository
    """
    ingestor = RepoIngestor(request.repo_url)
    
    # Ingesting
    raw_data = ingestor.ingest()
    if raw_data["errors"] and not raw_data["extracted_code"]:
        raise HTTPException(status_code=400, detail=raw_data["errors"])
    
    # Processing (Chunking)
    processed_data = processor.process(raw_data["extracted_code"])
    
    # Vectorizing
    status = vector_store.add_documents(processed_data["chunks"])
    
    return {
        "status": status,
        "summary": processed_data["summary"],
        "warnings": raw_data["warnings"] + processed_data["warnings"]
    }

@app.post("/query")
async def query_codebase(request: QueryRequest):
    """
    Step 3: Semantic Search and LLM Reasoning
    """
    # 1. Search for relevant snippets
    context = vector_store.search(request.question)
    
    if not context:
        return {"answer": "I couldn't find any relevant code to answer that."}
    
    # 2. Get the answer from the Brain
    return StreamingResponse(
        brain.generate_answer_stream(request.question, context),
        media_type="text/event-stream"
    )
