/**
 * Crawl Progress Service
 * Handles polling for crawl operation progress
 */

export interface CrawlProgressData {
  progressId: string;
  status: 'starting' | 'crawling' | 'processing' | 'completed' | 'failed' | 'cancelled';
  currentUrl?: string;
  pagesQueued?: number;
  pagesVisited?: number;
  docsCreated?: number;
  progress?: number;
  message?: string;
  error?: string;
  result?: any;
  timestamp?: string;
}

export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED',
  RECONNECTING = 'RECONNECTING'
}

interface StreamCallbacks {
  onMessage?: (data: CrawlProgressData) => void;
  onStateChange?: (state: WebSocketState) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
}

class CrawlProgressService {
  private pollingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private callbacks: Map<string, StreamCallbacks> = new Map();
  private connectionState: WebSocketState = WebSocketState.DISCONNECTED;

  /**
   * Start polling for progress updates
   */
  async streamProgressEnhanced(
    progressId: string, 
    callbacks: StreamCallbacks
  ): Promise<void> {
    // Store callbacks
    this.callbacks.set(progressId, callbacks);
    
    // Notify connected state (simulating WebSocket connection)
    this.connectionState = WebSocketState.CONNECTED;
    if (callbacks.onStateChange) {
      callbacks.onStateChange(WebSocketState.CONNECTED);
    }
    if (callbacks.onConnect) {
      callbacks.onConnect();
    }

    // Start polling
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/knowledge/crawl-progress/${progressId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Transform to expected format
          const progressData: CrawlProgressData = {
            progressId: data.operation_id,
            status: this.mapStatus(data.status),
            message: data.message,
            progress: data.percentage,
            error: data.error,
            ...data.metadata
          };

          if (callbacks.onMessage) {
            callbacks.onMessage(progressData);
          }

          // Stop polling if completed or failed
          if (data.status === 'completed' || data.status === 'failed' || data.status === 'error') {
            this.stopStreaming(progressId);
          }
        } else if (response.status === 404) {
          // Operation not found, stop polling
          this.stopStreaming(progressId);
          if (callbacks.onError) {
            callbacks.onError('Progress operation not found');
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        if (callbacks.onError) {
          callbacks.onError(error instanceof Error ? error.message : 'Polling error');
        }
      }
    }, 1000); // Poll every second

    this.pollingIntervals.set(progressId, pollInterval);
  }

  /**
   * Stop polling for a specific progress ID
   */
  stopStreaming(progressId: string) {
    const interval = this.pollingIntervals.get(progressId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(progressId);
    }
    
    const callbacks = this.callbacks.get(progressId);
    if (callbacks?.onStateChange) {
      callbacks.onStateChange(WebSocketState.DISCONNECTED);
    }
    this.callbacks.delete(progressId);
  }

  /**
   * Disconnect all polling
   */
  disconnect() {
    // Stop all polling intervals
    this.pollingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
    
    // Notify all callbacks of disconnection
    this.callbacks.forEach((callbacks) => {
      if (callbacks.onStateChange) {
        callbacks.onStateChange(WebSocketState.DISCONNECTED);
      }
    });
    this.callbacks.clear();
    
    this.connectionState = WebSocketState.DISCONNECTED;
  }

  /**
   * Wait for connection (simulated for compatibility)
   */
  async waitForConnection(timeout: number = 5000): Promise<void> {
    // Since we're using polling, we're always "connected"
    // This is here for compatibility with existing code
    return Promise.resolve();
  }

  /**
   * Map backend status to expected format
   */
  private mapStatus(status: string): CrawlProgressData['status'] {
    switch (status) {
      case 'running':
        return 'crawling';
      case 'completed':
        return 'completed';
      case 'failed':
      case 'error':
        return 'failed';
      default:
        return 'starting';
    }
  }
}

export const crawlProgressService = new CrawlProgressService();