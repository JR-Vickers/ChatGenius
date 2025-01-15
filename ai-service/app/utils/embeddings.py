from langchain_openai import OpenAIEmbeddings
from typing import List
import base64
from ..config import get_settings

settings = get_settings()

def get_embeddings_model() -> OpenAIEmbeddings:
    """Get the embeddings model instance"""
    return OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=settings.openai_api_key,
        dimensions=1536,  # Matches our Pinecone index
    )

async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Get embeddings for a list of texts
    
    Args:
        texts: List of texts to embed
        
    Returns:
        List of embedding vectors
    """
    embeddings = get_embeddings_model()
    return await embeddings.aembed_documents(texts)

async def get_query_embedding(text: str) -> List[float]:
    """
    Get embedding for a single query text
    
    Args:
        text: Text to embed
        
    Returns:
        Embedding vector
    """
    embeddings = get_embeddings_model()
    return await embeddings.aembed_query(text) 