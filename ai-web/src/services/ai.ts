import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000';

export interface SearchResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export interface QueryResponse {
  results: SearchResult[];
  answer: string;
}

export interface ProcessingStatus {
  queue_size: number;
  processed_count: number;
  failed_count: number;
  last_processed: string | null;
  is_processing: boolean;
}

interface HealthResponse {
  status: string;
  service: string;
}

class AIService {
  private client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get<HealthResponse>('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async query(query: string, k: number = 4): Promise<QueryResponse> {
    const response = await this.client.post<QueryResponse>('/query', { query, k });
    return response.data;
  }

  async uploadFile(file: File): Promise<string[]> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<string[]>('/index/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async indexContent(texts: string[], metadata?: Record<string, any>[]): Promise<string[]> {
    const response = await this.client.post<string[]>('/index', {
      texts,
      metadata,
    });
    return response.data;
  }

  async indexRealtimeContent(texts: string[], metadata?: Record<string, any>[]): Promise<boolean> {
    const response = await this.client.post<boolean>('/index/realtime', {
      texts,
      metadata,
    });
    return response.data;
  }

  async getProcessingStatus(): Promise<ProcessingStatus> {
    const response = await this.client.get<ProcessingStatus>('/status/processing');
    return response.data;
  }
}

export const aiService = new AIService(); 