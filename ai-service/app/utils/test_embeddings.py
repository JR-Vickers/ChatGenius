import asyncio
from .embeddings import get_embeddings
from .vector_store import add_texts, similarity_search_with_score

async def test_embeddings():
    """Test the embeddings and vector store setup"""
    
    # Test texts
    texts = [
        "The quick brown fox jumps over the lazy dog",
        "A lazy dog sleeps in the sun",
        "The fox is quick and clever",
    ]
    
    # Get embeddings
    print("Getting embeddings...")
    embeddings = await get_embeddings(texts)
    print(f"Generated {len(embeddings)} embeddings")
    print(f"Embedding dimension: {len(embeddings[0])}")
    
    # Add to vector store
    print("\nAdding texts to vector store...")
    ids = await add_texts(
        texts=texts,
        metadatas=[{"source": f"test_{i}"} for i in range(len(texts))]
    )
    print(f"Added {len(ids)} documents")
    
    # Wait for indexing
    print("Waiting for indexing...")
    await asyncio.sleep(5)
    
    # Test similarity search
    print("\nTesting similarity search...")
    query = "sleeping dog"
    results = await similarity_search_with_score(query, k=2)
    
    print(f"\nTop 2 results for query: '{query}'")
    for doc, score in results:
        print(f"Score: {score:.4f} | Text: {doc['content']}")

if __name__ == "__main__":
    asyncio.run(test_embeddings()) 