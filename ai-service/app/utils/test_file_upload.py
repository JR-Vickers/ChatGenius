import asyncio
import httpx
from pathlib import Path

BASE_URL = "http://localhost:8000"

async def test_file_upload():
    """Test file upload and indexing"""
    test_dir = Path("tests/files")
    
    # Test PDF upload
    pdf_path = test_dir / "test.pdf"
    if not pdf_path.exists():
        print("PDF test file not found")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            # Upload PDF
            print("\n=== PDF Upload Test ===")
            with open(pdf_path, "rb") as f:
                files = {"file": (pdf_path.name, f, "application/pdf")}
                response = await client.post(f"{BASE_URL}/index/file", files=files)
            
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                print(f"Document IDs: {response.json()}")
            else:
                print(f"Error: {response.text}")
            
            # Wait for indexing
            print("\nWaiting for indexing...")
            await asyncio.sleep(5)
            
            # Test query with uploaded content
            print("\n=== Query Test ===")
            query_data = {
                "query": "What is this test file about?",
                "k": 2
            }
            
            response = await client.post(f"{BASE_URL}/query", json=query_data)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print("\nGPT Answer:")
                print("-" * 50)
                print(data["answer"])
                print("-" * 50)
                
                print("\nRelevant Documents:")
                for idx, result in enumerate(data["results"], 1):
                    print(f"\n{idx}. Score: {result['score']:.4f}")
                    print(f"   Content: {result['content']}")
                    print(f"   Metadata: {result['metadata']}")
            else:
                print(f"Error: {response.text}")
            
            return True
    except Exception as e:
        print(f"Error testing file upload: {str(e)}")
        return False

async def run_tests():
    """Run all file upload tests"""
    if await test_file_upload():
        print("\n✅ File upload test completed")
    else:
        print("\n❌ File upload test failed")

if __name__ == "__main__":
    asyncio.run(run_tests()) 