import asyncio
import os
from pathlib import Path

from .file_processor import extract_text_from_file

async def test_pdf_extraction():
    """Test PDF text extraction"""
    # Create a test directory if it doesn't exist
    test_dir = Path("tests/files")
    test_dir.mkdir(parents=True, exist_ok=True)
    
    # Create a simple test PDF file
    pdf_path = test_dir / "test.pdf"
    if not pdf_path.exists():
        print("Please create a test PDF file at tests/files/test.pdf")
        return False
    
    try:
        # Read the PDF file
        with open(pdf_path, "rb") as f:
            file_content = f.read()
        
        # Extract text
        result = await extract_text_from_file(file_content, "test.pdf")
        
        print("\n=== PDF Extraction Test ===")
        print(f"File type: {result['metadata']['type']}")
        print(f"File size: {result['metadata']['size']} bytes")
        print("\nExtracted content:")
        print("-" * 50)
        print(result["content"][:500] + "..." if len(result["content"]) > 500 else result["content"])
        print("-" * 50)
        
        return True
    except Exception as e:
        print(f"Error testing PDF extraction: {str(e)}")
        return False

async def test_text_extraction():
    """Test plain text extraction"""
    test_dir = Path("tests/files")
    test_dir.mkdir(parents=True, exist_ok=True)
    
    # Create a test text file
    text_path = test_dir / "test.txt"
    test_content = "This is a test text file.\nIt has multiple lines.\nLet's see if we can extract it correctly."
    
    with open(text_path, "w") as f:
        f.write(test_content)
    
    try:
        # Read the text file
        with open(text_path, "rb") as f:
            file_content = f.read()
        
        # Extract text
        result = await extract_text_from_file(file_content, "test.txt")
        
        print("\n=== Text File Test ===")
        print(f"File type: {result['metadata']['type']}")
        print(f"File size: {result['metadata']['size']} bytes")
        print("\nExtracted content:")
        print("-" * 50)
        print(result["content"])
        print("-" * 50)
        
        return True
    except Exception as e:
        print(f"Error testing text extraction: {str(e)}")
        return False

async def run_tests():
    """Run all file processing tests"""
    print("Starting file processor tests...")
    
    # Test PDF extraction
    if await test_pdf_extraction():
        print("\n✅ PDF extraction test completed")
    else:
        print("\n❌ PDF extraction test failed")
    
    # Test text file extraction
    if await test_text_extraction():
        print("\n✅ Text file extraction test completed")
    else:
        print("\n❌ Text file extraction test failed")

if __name__ == "__main__":
    asyncio.run(run_tests()) 