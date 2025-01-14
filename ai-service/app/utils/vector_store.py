from typing import List, Optional, Dict, Any
from pinecone import Pinecone
import uuid
import logging
import json
from .embeddings import get_embeddings, get_query_embedding
from ..config import get_settings

# Configure logging
logger = logging.getLogger(__name__)

settings = get_settings()
_pinecone_client = None
_index = None

def get_pinecone():
    """Get or create Pinecone client"""
    global _pinecone_client, _index
    if _pinecone_client is None:
        _pinecone_client = Pinecone(api_key=settings.pinecone_api_key)
        _index = _pinecone_client.Index(settings.pinecone_index)
    return _pinecone_client, _index

def chunk_text(text: str, chunk_size: int = 1000) -> List[str]:
    """Split text into chunks of roughly equal size"""
    words = text.split()
    chunks = []
    current_chunk = []
    current_size = 0
    
    for word in words:
        word_size = len(word.encode('utf-8'))
        if current_size + word_size > chunk_size and current_chunk:
            chunks.append(' '.join(current_chunk))
            current_chunk = [word]
            current_size = word_size
        else:
            current_chunk.append(word)
            current_size += word_size
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

async def add_texts(
    texts: List[str],
    metadatas: Optional[List[dict]] = None,
) -> List[str]:
    """Add texts to the vector store"""
    _, index = get_pinecone()
    
    # Split texts into chunks
    all_chunks = []
    chunk_metadatas = []
    
    for i, text in enumerate(texts):
        logger.info(f"Processing text {i} of length: {len(text)} bytes")
        chunks = chunk_text(text)
        logger.info(f"Split into {len(chunks)} chunks")
        
        # Create metadata for each chunk
        base_metadata = (metadatas or [{}])[i].copy() if metadatas and i < len(metadatas) else {}
        for j, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            chunk_metadata = base_metadata.copy()
            chunk_metadata.update({
                "chunk_index": j,
                "total_chunks": len(chunks),
                "content": chunk
            })
            chunk_metadatas.append(chunk_metadata)
            metadata_size = len(json.dumps(chunk_metadata).encode('utf-8'))
            logger.info(f"Chunk {j} metadata size: {metadata_size} bytes")
    
    # Generate embeddings for all chunks
    embeddings = await get_embeddings(all_chunks)
    logger.info(f"Generated embeddings, dimension: {len(embeddings[0])}")
    
    # Generate IDs
    ids = [str(uuid.uuid4()) for _ in all_chunks]
    
    # Prepare vectors
    vectors = []
    for i, (chunk, embedding, metadata) in enumerate(zip(all_chunks, embeddings, chunk_metadatas)):
        vector_entry = {
            "id": ids[i],
            "values": embedding,
            "metadata": metadata
        }
        vector_size = len(json.dumps(vector_entry).encode('utf-8'))
        logger.info(f"Vector {i} total size: {vector_size} bytes")
        logger.info(f"Vector {i} metadata size: {len(json.dumps(metadata).encode('utf-8'))} bytes")
        vectors.append(vector_entry)
    
    # Upsert to Pinecone
    logger.info(f"Upserting {len(vectors)} vectors to Pinecone...")
    index.upsert(vectors=vectors)
    logger.info("Upsert complete")
    
    return ids

async def similarity_search_with_score(
    query: str,
    k: int = 4,
    filter: Optional[Dict[str, Any]] = None,
) -> List[tuple[dict, float]]:
    """
    Search for similar texts and return scores
    """
    _, index = get_pinecone()
    
    # Get query embedding
    query_embedding = await get_query_embedding(query)
    
    # Search in Pinecone
    results = index.query(
        vector=query_embedding,
        top_k=k * 2,
        include_metadata=True,
        filter=filter
    )
    
    # Process results
    unique_results = []
    seen_chunks = set()
    
    for match in results.matches:
        metadata = match.metadata
        chunk_key = f"{metadata.get('filename', '')}_{metadata.get('chunk_index', '')}"
        
        if chunk_key not in seen_chunks and len(unique_results) < k:
            seen_chunks.add(chunk_key)
            doc = metadata.copy()
            unique_results.append((doc, match.score))
    
    return unique_results

async def similarity_search(
    query: str,
    k: int = 4,
    filter: Optional[Dict[str, Any]] = None,
) -> List[dict]:
    """
    Search for similar texts
    
    Args:
        query: Query text
        k: Number of results to return
        filter: Optional metadata filter
        
    Returns:
        List of documents
    """
    results = await similarity_search_with_score(query, k, filter)
    return [doc for doc, _ in results] 