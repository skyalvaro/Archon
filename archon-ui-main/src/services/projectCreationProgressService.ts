/**
 * Project Creation Progress Service
 * Handles polling for project creation progress
 */

export interface ProjectCreationProgressData {
  progressId: string;
  projectId?: string;
  status: 'starting' | 'analyzing' | 'creating_prp' | 'creating_tasks' | 'completed' | 'failed' | 'cancelled';
  percentage: number;
  step: string;
  message?: string;
  error?: string;
  result?: any;
  timestamp?: string;
}

interface StreamCallbacks {
  onMessage?: (data: ProjectCreationProgressData) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onComplete?: (data: ProjectCreationProgressData) => void;
}

class ProjectCreationProgressService {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private callbacks: Map<string, StreamCallbacks> = new Map();

  /**
   * Start polling for project creation progress
   */
  async streamProgress(
    progressId: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    // Store callbacks
    this.callbacks.set(progressId, callbacks);
    
    // Notify connected
    if (callbacks.onConnect) {
      callbacks.onConnect();
    }

    // Start polling
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/progress/${progressId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Transform to expected format
          const progressData: ProjectCreationProgressData = {
            progressId: data.operation_id,
            projectId: data.metadata?.project_id,
            status: this.mapStatus(data.status),
            percentage: data.percentage,
            step: data.message || data.metadata?.step || 'Processing...',
            message: data.message,
            error: data.error,
            result: data.metadata?.result,
            timestamp: data.timestamp
          };

          if (callbacks.onMessage) {
            callbacks.onMessage(progressData);
          }

          // Handle completion
          if (data.status === 'completed') {
            if (callbacks.onComplete) {
              callbacks.onComplete(progressData);
            }
            this.stopStreaming(progressId);
          } else if (data.status === 'failed' || data.status === 'error') {
            if (callbacks.onError) {
              callbacks.onError(data.error || 'Operation failed');
            }
            this.stopStreaming(progressId);
          }
        } else if (response.status === 404) {
          // Operation not found
          this.stopStreaming(progressId);
          if (callbacks.onError) {
            callbacks.onError('Progress operation not found');
          }
        }
      } catch (error) {
        console.error('Error polling project creation progress:', error);
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
    this.callbacks.clear();
  }

  /**
   * Map backend status to expected format
   */
  private mapStatus(status: string): ProjectCreationProgressData['status'] {
    switch (status) {
      case 'running':
        return 'analyzing';
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

export const projectCreationProgressService = new ProjectCreationProgressService();