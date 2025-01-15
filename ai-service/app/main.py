from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
from dotenv import load_dotenv
import os
import logging
import openai

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from .utils.vector_store import add_texts, similarity_search_with_score, get_pinecone, delete_all_vectors
from .utils.file_processor import extract_text_from_file
from .utils.realtime_processor import RealTimeProcessor
from .config import get_settings
from .utils.gpt import process_query

# Load environment variables
load_dotenv()
settings = get_settings()

# Verify critical settings
logger.info("=== Environment Check ===")
logger.info(f"OpenAI API Key present: {bool(settings.openai_api_key)}")
if settings.openai_api_key:
    logger.info(f"OpenAI Key format: {settings.openai_api_key[:15]}...")
logger.info(f"Pinecone API Key present: {bool(settings.pinecone_api_key)}")
logger.info(f"Pinecone Environment: {settings.pinecone_environment}")
logger.info(f"Pinecone Index: {settings.pinecone_index}")
logger.info("========================")

app = FastAPI(title="ChatGenius AI Service")

# Initialize real-time processor
processor = RealTimeProcessor(
    batch_size=10,
    rate_limit_per_minute=100,
    max_queue_size=1000
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",     # Next.js dev server
        "http://localhost:3001",     # Optional alternate dev port
        "https://chatgenius.app",    # Add your production domain when ready
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class IndexContentRequest(BaseModel):
    """Request model for indexing content"""
    texts: List[str]
    metadata: Optional[List[Dict[str, Any]]] = None

class QueryRequest(BaseModel):
    """Request model for querying the avatar"""
    query: str
    k: Optional[int] = 4
    filter: Optional[Dict[str, Any]] = None

class SearchResult(BaseModel):
    """Model for search results"""
    content: str
    metadata: Dict[str, Any]
    score: float

class QueryResponse(BaseModel):
    """Response model for queries"""
    results: List[SearchResult]
    answer: str

class ProcessingStatus(BaseModel):
    """Model for processing status"""
    queue_size: int
    processed_count: int
    failed_count: int
    last_processed: Optional[str]
    is_processing: bool

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "chatgenius-ai"}

@app.post("/index", response_model=List[str])
async def index_content(request: IndexContentRequest):
    """
    Index new content for the avatar
    """
    try:
        ids = await add_texts(
            texts=request.texts,
            metadatas=request.metadata
        )
        return ids
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/index/file")
async def index_file(file: UploadFile = File(...)) -> Dict[str, List[str]]:
    """Index a file's content"""
    try:
        content = await file.read()
        logger.info(f"Received file upload: {file.filename}, size: {len(content)} bytes")
        
        try:
            # Extract text and metadata
            result = await extract_text_from_file(content, file.filename)
            logger.info(f"Successfully extracted text from {result['metadata']['filename']}")
        except Exception as e:
            logger.error(f"Text extraction failed: {str(e)}")
            raise
        
        try:
            # Index the content
            _, index = get_pinecone()
            doc_ids = await add_texts(
                texts=[result["content"]],
                metadatas=[result["metadata"]]
            )
            logger.info(f"Successfully indexed document with IDs: {doc_ids}")
        except Exception as e:
            logger.error(f"Indexing failed: {str(e)}")
            raise
        
        return {"document_ids": doc_ids}
        
    except ValueError as e:
        logger.error(f"Invalid file: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:
        logger.error(f"Unsupported file type: {str(e)}")
        raise HTTPException(status_code=415, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def query_avatar(request: QueryRequest):
    """
    Query the avatar's knowledge
    """
    try:
        # Perform similarity search
        results = await similarity_search_with_score(
            request.query,
            k=request.k,
            filter=request.filter
        )
        
        # Format results according to response model
        formatted_results = [
            SearchResult(
                content=doc["content"],
                metadata={k: v for k, v in doc.items() if k != "content"},
                score=score
            )
            for doc, score in results
        ]
        
        # Convert SearchResults to format expected by GPT
        results_for_gpt = [
            {
                "content": result.content,
                "metadata": result.metadata,
                "score": result.score
            }
            for result in formatted_results
        ]
        
        # Generate GPT response
        answer = await process_query(request.query, results_for_gpt)
        
        return QueryResponse(
            results=formatted_results,
            answer=answer
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/index/realtime", response_model=bool)
async def index_realtime(request: IndexContentRequest):
    """
    Queue content for real-time processing
    """
    try:
        for text, metadata in zip(request.texts, request.metadata or [{}] * len(request.texts)):
            success = await processor.add_to_queue(text, metadata)
            if not success:
                raise HTTPException(status_code=503, detail="Processing queue is full")
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/processing", response_model=ProcessingStatus)
async def get_processing_status():
    """
    Get current processing status
    """
    status = processor.get_status()
    if status["last_processed"]:
        status["last_processed"] = status["last_processed"].isoformat()
    return status

@app.post("/index/reset")
async def reset_index():
    """Delete all vectors from the index"""
    try:
        await delete_all_vectors()
        return {"status": "success", "message": "All vectors deleted"}
    except Exception as e:
        logger.error(f"Error resetting index: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 