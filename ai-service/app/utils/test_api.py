import asyncio
import httpx
from typing import List, Dict, Any

BASE_URL = "http://localhost:8000"

async def test_health():
    """Test the health check endpoint"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        print("\n=== Health Check ===")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200

async def test_index():
    """Test the index endpoint"""
    test_data = {
        "texts": [
            "Python is a versatile programming language known for its readability and extensive library ecosystem",
            "FastAPI is a modern web framework for building APIs with Python 3.7+ based on standard Python type hints",
            "Pinecone is a vector database that enables fast similarity search for machine learning applications"
        ],
        "metadata": [
            {"source": "python_docs", "type": "language"},
            {"source": "fastapi_docs", "type": "framework"},
            {"source": "pinecone_docs", "type": "database"}
        ]
    }
    
    async with httpx.AsyncClient() as client:
        print("\n=== Index Content ===")
        response = await client.post(f"{BASE_URL}/index", json=test_data)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Document IDs: {response.json()}")
        else:
            print(f"Error: {response.text}")
        return response.status_code == 200

async def test_query(queries: List[Dict[str, Any]]):
    """Test the query endpoint with multiple queries"""
    async with httpx.AsyncClient() as client:
        print("\n=== Query Tests ===")
        for query_data in queries:
            response = await client.post(f"{BASE_URL}/query", json=query_data)
            print(f"\nQuery: {query_data['query']}")
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                results = data["results"]
                answer = data["answer"]
                
                print("\nGPT Answer:")
                print("-" * 50)
                print(answer)
                print("-" * 50)
                
                print("\nRelevant Documents:")
                for idx, result in enumerate(results, 1):
                    print(f"\n{idx}. Score: {result['score']:.4f}")
                    print(f"   Content: {result['content']}")
                    print(f"   Metadata: {result['metadata']}")
            else:
                print(f"Error: {response.text}")
            
            # Add a small delay between queries
            await asyncio.sleep(1)

async def run_tests():
    """Run all API tests"""
    # Test health endpoint
    if not await test_health():
        print("Health check failed, skipping other tests")
        return
    
    # Test index endpoint
    if not await test_index():
        print("Index test failed, skipping query tests")
        return
    
    # Wait for indexing
    print("\nWaiting for indexing...")
    await asyncio.sleep(5)
    
    # Test queries
    test_queries = [
        {
            "query": "What are the key features of Python?",
            "k": 2
        },
        {
            "query": "How does FastAPI help in building APIs?",
            "k": 2
        },
        {
            "query": "What is Pinecone used for in machine learning?",
            "k": 2,
            "filter": {"type": "database"}
        }
    ]
    
    await test_query(test_queries)

if __name__ == "__main__":
    asyncio.run(run_tests()) 