import asyncio
import httpx
import random
from datetime import datetime

BASE_URL = "http://localhost:8000"

async def test_realtime_processing():
    """Test real-time content processing"""
    try:
        async with httpx.AsyncClient() as client:
            print("\n=== Real-time Processing Test ===")
            
            # Generate test content
            test_content = [
                f"Test message {i} at {datetime.now()}"
                for i in range(25)  # Test with 25 messages
            ]
            
            test_metadata = [
                {
                    "source": "test",
                    "timestamp": datetime.now().isoformat(),
                    "priority": random.choice(["high", "medium", "low"])
                }
                for _ in range(25)
            ]
            
            # Submit content for processing
            print("\nSubmitting content for processing...")
            response = await client.post(
                f"{BASE_URL}/index/realtime",
                json={
                    "texts": test_content,
                    "metadata": test_metadata
                }
            )
            
            print(f"Submission Status: {response.status_code}")
            if response.status_code != 200:
                print(f"Error: {response.text}")
                return False
            
            # Monitor processing status
            print("\nMonitoring processing status...")
            for _ in range(10):  # Check status 10 times
                response = await client.get(f"{BASE_URL}/status/processing")
                if response.status_code == 200:
                    status = response.json()
                    print(f"\nQueue Size: {status['queue_size']}")
                    print(f"Processed: {status['processed_count']}")
                    print(f"Failed: {status['failed_count']}")
                    print(f"Processing: {'Yes' if status['is_processing'] else 'No'}")
                    if status['last_processed']:
                        print(f"Last Processed: {status['last_processed']}")
                else:
                    print(f"Error getting status: {response.text}")
                
                await asyncio.sleep(1)  # Wait 1 second between checks
            
            # Test query after processing
            print("\n=== Testing Query ===")
            query_data = {
                "query": "What are the test messages about?",
                "k": 3
            }
            
            response = await client.post(f"{BASE_URL}/query", json=query_data)
            if response.status_code == 200:
                data = response.json()
                print("\nGPT Answer:")
                print("-" * 50)
                print(data["answer"])
                print("\nTop Results:")
                for idx, result in enumerate(data["results"], 1):
                    print(f"\n{idx}. Score: {result['score']:.4f}")
                    print(f"   Content: {result['content'][:100]}...")
            else:
                print(f"Error querying: {response.text}")
            
            return True
            
    except Exception as e:
        print(f"Error testing real-time processing: {str(e)}")
        return False

async def run_tests():
    """Run all real-time processing tests"""
    if await test_realtime_processing():
        print("\n✅ Real-time processing test completed")
    else:
        print("\n❌ Real-time processing test failed")

if __name__ == "__main__":
    asyncio.run(run_tests()) 