from typing import List, Dict, Any
import os
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are a helpful AI assistant that answers questions based on the provided context.
Your answers should be:
1. Accurate and based only on the provided context
2. Concise but complete
3. Natural and conversational
4. Include relevant quotes or references from the context when appropriate

If the context doesn't contain enough information to answer the question, say so clearly."""

async def format_context(results: List[Dict[str, Any]]) -> str:
    """Format search results into a context string for GPT"""
    context_parts = []
    for idx, result in enumerate(results, 1):
        content = result["content"]
        metadata = result["metadata"]
        source = metadata.get("source", "Unknown")
        context_parts.append(f"[{idx}] From {source}:\n{content}\n")
    
    return "\n".join(context_parts)

async def generate_response(query: str, context: str) -> str:
    """Generate a response using GPT based on the query and context"""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
    ]
    
    response = await client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=messages,
        temperature=0.7,
        max_tokens=500
    )
    
    return response.choices[0].message.content

async def process_query(query: str, search_results: List[Dict[str, Any]]) -> str:
    """Process a query using the search results to generate a response"""
    context = await format_context(search_results)
    response = await generate_response(query, context)
    return response 