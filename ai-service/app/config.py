from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    """Application settings"""
    openai_api_key: str
    pinecone_api_key: str
    pinecone_environment: str
    pinecone_index: str
    langsmith_tracing: bool = False
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    langsmith_api_key: str | None = None
    langsmith_project: str | None = None
    
    class Config:
        env_file = ".env.ai-service"

@lru_cache()
def get_settings():
    """Get cached settings"""
    return Settings() 