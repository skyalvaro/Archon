/**
 * Crawl progress data interface
 */
export interface CrawlProgressData {
  progressId: string;
  status: 'starting' | 'initializing' | 'crawling' | 'processing' | 'completed' | 'failed' | 'cancelled' | 
          'error' | 'stale' | 'stopping' | 'analyzing' | 'source_creation' | 'document_storage' | 
          'code_storage' | 'code_extraction' | 'finalization' | 'reading' | 'extracting' | 
          'chunking' | 'creating_source' | 'summarizing' | 'storing';
  currentUrl?: string;
  pagesQueued?: number;
  pagesVisited?: number;
  docsCreated?: number;
  progress: number;  // Required field representing progress 0-100
  message?: string;
  error?: string;
  result?: any;
  timestamp?: string;
  
  // Step information from backend
  currentStep?: string;
  stepMessage?: string;
  log?: string;
  logs?: string[];
  
  // Upload-specific fields
  uploadType?: 'document' | 'crawl';
  fileName?: string;
  fileType?: string;
  chunksStored?: number;
  wordCount?: number;
  sourceId?: string;
  duration?: string;
  
  // Batch processing fields
  totalPages?: number;
  processedPages?: number;
  parallelWorkers?: number;
  totalJobs?: number;
  completedBatches?: number;
  totalBatches?: number;
  total_batches?: number;
  completed_batches?: number;
  active_workers?: number;
  current_batch?: number;
  chunks_in_batch?: number;
  total_chunks_in_batch?: number;
}