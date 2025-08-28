/**
 * Progress polling service for long-running operations
 * Replaces Socket.IO progress tracking with simple polling
 */

export interface ProgressState {
  operation_id: string;
  status: 'running' | 'completed' | 'failed';
  percentage: number;
  message: string;
  metadata?: any;
  error?: string;
  timestamp: string;
}

interface ProgressPollingOptions {
  onProgress?: (progress: ProgressState) => void;
  onComplete?: (progress: ProgressState) => void;
  onError?: (error: string) => void;
}

/**
 * Service for polling operation progress
 */
export class ProgressPollingService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private operationId: string | null = null;
  private onProgress?: (progress: ProgressState) => void;
  private onComplete?: (progress: ProgressState) => void;
  private onError?: (error: string) => void;
  private etag: string | null = null;

  constructor(options: ProgressPollingOptions = {}) {
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Start polling for a specific operation
   */
  start(operationId: string, interval = 1000): void {
    this.stop();
    this.operationId = operationId;
    this.etag = null;
    
    // Start polling
    this.poll();
    this.intervalId = setInterval(() => this.poll(), interval);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.operationId = null;
    this.etag = null;
  }

  /**
   * Poll once for progress
   */
  private async poll(): Promise<void> {
    if (!this.operationId) return;

    try {
      const headers: Record<string, string> = {};
      
      // Include ETag if we have one
      if (this.etag) {
        headers['If-None-Match'] = this.etag;
      }

      const response = await fetch(`/api/progress/${this.operationId}`, {
        headers,
        credentials: 'include',
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        return; // Progress hasn't changed
      }

      if (!response.ok) {
        if (response.status === 404) {
          // Operation not found, stop polling
          this.stop();
          if (this.onError) {
            this.onError('Operation not found');
          }
          return;
        }
        throw new Error(`Failed to fetch progress: ${response.statusText}`);
      }

      // Store new ETag
      const newEtag = response.headers.get('ETag');
      if (newEtag) {
        this.etag = newEtag;
      }

      const progress: ProgressState = await response.json();
      
      // Notify progress update
      if (this.onProgress) {
        this.onProgress(progress);
      }

      // Handle completion
      if (progress.status === 'completed') {
        this.stop();
        if (this.onComplete) {
          this.onComplete(progress);
        }
      }

      // Handle failure
      if (progress.status === 'failed') {
        this.stop();
        if (this.onError) {
          this.onError(progress.error || 'Operation failed');
        }
      }
    } catch (error) {
      console.error('Progress polling error:', error);
      if (this.onError) {
        this.onError((error as Error).message);
      }
    }
  }
}

/**
 * Simplified hook-friendly progress tracking
 */
export function trackProgress(
  operationId: string,
  callbacks: ProgressPollingOptions
): () => void {
  const service = new ProgressPollingService(callbacks);
  service.start(operationId);
  
  // Return cleanup function
  return () => service.stop();
}

/**
 * Progress state manager for multiple operations
 */
export class ProgressManager {
  private services: Map<string, ProgressPollingService> = new Map();

  /**
   * Start tracking an operation
   */
  track(
    operationId: string,
    callbacks: ProgressPollingOptions
  ): void {
    // Stop any existing tracking for this operation
    this.stopTracking(operationId);

    // Create and start new service
    const service = new ProgressPollingService(callbacks);
    service.start(operationId);
    this.services.set(operationId, service);
  }

  /**
   * Stop tracking an operation
   */
  stopTracking(operationId: string): void {
    const service = this.services.get(operationId);
    if (service) {
      service.stop();
      this.services.delete(operationId);
    }
  }

  /**
   * Stop all tracking
   */
  stopAll(): void {
    this.services.forEach(service => service.stop());
    this.services.clear();
  }

  /**
   * Get active operation IDs
   */
  getActiveOperations(): string[] {
    return Array.from(this.services.keys());
  }
}

// Export singleton instance
export const progressManager = new ProgressManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    progressManager.stopAll();
  });
}