from typing import List, Dict, Any
import PyPDF2
from io import BytesIO
import magic
import os
import logging
import json

# Configure logging
logger = logging.getLogger(__name__)

SUPPORTED_MIME_TYPES = {
    'application/pdf': 'pdf',
    'image/png': 'image',
    'image/jpeg': 'image',
    'text/plain': 'text',
}

async def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text content from a PDF file"""
    pdf_file = BytesIO(file_content)
    logger.info(f"Processing PDF file of size: {len(file_content)} bytes")
    
    try:
        # Create PDF reader object
        reader = PyPDF2.PdfReader(pdf_file)
        logger.info(f"PDF has {len(reader.pages)} pages")
        
        # Extract text from all pages
        text_content = []
        total_text_size = 0
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                text_content.append(text.strip())
                total_text_size += len(text.encode('utf-8'))
                logger.info(f"Page {i+1}: extracted {len(text.encode('utf-8'))} bytes of text")
        
        combined_text = "\n\n".join(text_content)
        logger.info(f"Total extracted text size: {total_text_size} bytes")
        return combined_text
    except Exception as e:
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

async def detect_file_type(file_content: bytes) -> str:
    """Detect the MIME type of a file"""
    try:
        mime = magic.from_buffer(file_content, mime=True)
        logger.info(f"Detected MIME type: {mime}")
        if mime not in SUPPORTED_MIME_TYPES:
            raise ValueError(f"Unsupported MIME type: {mime}")
        return mime
    except Exception as e:
        raise ValueError(f"Failed to detect file type: {str(e)}")

async def extract_text_from_file(content: bytes, filename: str) -> dict:
    """Extract text from a file"""
    try:
        mime_type = await detect_file_type(content)
        logger.info(f"Processing file {filename} of type {mime_type}")
        
        if mime_type == "application/pdf":
            text = await extract_text_from_pdf(content)
        elif mime_type == "text/plain":
            text = content.decode('utf-8')
            logger.info(f"Extracted {len(text.encode('utf-8'))} bytes of text from plain text file")
        else:
            # This shouldn't happen due to detect_file_type validation
            raise NotImplementedError(f"File type {mime_type} is not supported")
        
        # Return minimal metadata to stay under Pinecone's limit
        result = {
            "content": text,
            "metadata": {
                "type": mime_type.split('/')[-1],  # just 'pdf' or 'plain' 
                "filename": filename,
                "size": len(content)
            }
        }
        
        # Log sizes
        metadata_size = len(json.dumps(result["metadata"]).encode('utf-8'))
        content_size = len(result["content"].encode('utf-8'))
        total_size = len(json.dumps(result).encode('utf-8'))
        logger.info(f"Extraction result sizes:")
        logger.info(f"  - Metadata: {metadata_size} bytes")
        logger.info(f"  - Content: {content_size} bytes")
        logger.info(f"  - Total: {total_size} bytes")
        
        return result
    except ValueError as e:
        # Re-raise ValueError for invalid file types
        raise e
    except Exception as e:
        # Wrap other errors
        raise ValueError(f"Failed to process file {filename}: {str(e)}") 