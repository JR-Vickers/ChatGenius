from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime, timedelta
import logging
from collections import deque

from .vector_store import add_texts

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RealTimeProcessor:
    def __init__(self, 
                 batch_size: int = 10,
                 rate_limit_per_minute: int = 100,
                 max_queue_size: int = 1000):
        # Queue for incoming content
        self.queue = deque(maxlen=max_queue_size)
        
        # Processing settings
        self.batch_size = batch_size
        self.rate_limit_per_minute = rate_limit_per_minute
        self.processing = False
        
        # Rate limiting
        self.request_times = deque(maxlen=rate_limit_per_minute)
        
        # Status tracking
        self.processed_count = 0
        self.failed_count = 0
        self.last_processed_time = None
    
    async def add_to_queue(self, content: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Add content to the processing queue"""
        if len(self.queue) >= self.queue.maxlen:
            logger.warning("Queue is full, content rejected")
            return False
            
        self.queue.append({
            "content": content,
            "metadata": metadata or {},
            "timestamp": datetime.now()
        })
        
        # Start processing if not already running
        if not self.processing:
            asyncio.create_task(self._process_queue())
        
        return True
    
    def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits"""
        now = datetime.now()
        
        # Remove old requests from tracking
        while self.request_times and (now - self.request_times[0]) > timedelta(minutes=1):
            self.request_times.popleft()
        
        # Check if we're at the limit
        return len(self.request_times) < self.rate_limit_per_minute
    
    async def _process_queue(self):
        """Process items in the queue"""
        if self.processing:
            return
        
        self.processing = True
        try:
            while self.queue:
                if not self._check_rate_limit():
                    # Wait if we hit rate limit
                    await asyncio.sleep(1)
                    continue
                
                # Process items in batches
                batch = []
                batch_metadata = []
                
                for _ in range(min(self.batch_size, len(self.queue))):
                    if not self.queue:
                        break
                    
                    item = self.queue.popleft()
                    batch.append(item["content"])
                    batch_metadata.append(item["metadata"])
                
                if batch:
                    try:
                        # Add to vector store
                        await add_texts(texts=batch, metadatas=batch_metadata)
                        
                        # Update stats
                        self.processed_count += len(batch)
                        self.last_processed_time = datetime.now()
                        self.request_times.append(datetime.now())
                        
                        logger.info(f"Processed batch of {len(batch)} items")
                    except Exception as e:
                        self.failed_count += len(batch)
                        logger.error(f"Error processing batch: {str(e)}")
                
                # Small delay between batches
                await asyncio.sleep(0.1)
        
        finally:
            self.processing = False
    
    def get_status(self) -> Dict[str, Any]:
        """Get current processing status"""
        return {
            "queue_size": len(self.queue),
            "processed_count": self.processed_count,
            "failed_count": self.failed_count,
            "last_processed": self.last_processed_time,
            "is_processing": self.processing
        } 