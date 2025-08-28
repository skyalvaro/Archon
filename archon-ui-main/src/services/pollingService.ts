/**
 * Polling services for task and project updates
 * Replaces Socket.IO real-time functionality with efficient polling
 */

import { ApiResponse, makeRequest } from './api';

interface TaskPollingOptions {
  projectId: string;
  onTasksUpdated?: (tasks: any[]) => void;
  onError?: (error: Error) => void;
}

interface ProjectPollingOptions {
  onProjectsUpdated?: (projects: any[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Service for polling task updates
 */
export class TaskPollingService {
  private etag: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private projectId: string;
  private onTasksUpdated?: (tasks: any[]) => void;
  private onError?: (error: Error) => void;

  constructor(options: TaskPollingOptions) {
    this.projectId = options.projectId;
    this.onTasksUpdated = options.onTasksUpdated;
    this.onError = options.onError;
  }

  /**
   * Start polling for task updates
   */
  start(interval = 3000): void {
    // Clear any existing interval
    this.stop();

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
  }

  /**
   * Poll once for updates
   */
  async poll(): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      
      // Include ETag if we have one
      if (this.etag) {
        headers['If-None-Match'] = this.etag;
      }

      const response = await fetch(`/api/projects/${this.projectId}/tasks`, {
        headers,
        credentials: 'include',
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        // Data hasn't changed
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      // Store new ETag
      const newEtag = response.headers.get('ETag');
      if (newEtag) {
        this.etag = newEtag;
      }

      const data = await response.json();
      
      // Notify listeners of updated tasks
      if (this.onTasksUpdated && data.tasks) {
        this.onTasksUpdated(data.tasks);
      }
    } catch (error) {
      console.error('Task polling error:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  /**
   * Handle visibility change - pause when hidden, resume when visible
   */
  handleVisibilityChange(): void {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  }
}

/**
 * Service for polling project list updates
 */
export class ProjectPollingService {
  private etag: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onProjectsUpdated?: (projects: any[]) => void;
  private onError?: (error: Error) => void;

  constructor(options: ProjectPollingOptions) {
    this.onProjectsUpdated = options.onProjectsUpdated;
    this.onError = options.onError;
  }

  /**
   * Start polling for project updates
   */
  start(interval = 5000): void {
    // Clear any existing interval
    this.stop();

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
  }

  /**
   * Poll once for updates
   */
  async poll(): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      
      // Include ETag if we have one
      if (this.etag) {
        headers['If-None-Match'] = this.etag;
      }

      const response = await fetch('/api/projects', {
        headers,
        credentials: 'include',
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        // Data hasn't changed
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      // Store new ETag
      const newEtag = response.headers.get('ETag');
      if (newEtag) {
        this.etag = newEtag;
      }

      const data = await response.json();
      
      // Notify listeners of updated projects
      if (this.onProjectsUpdated && data.projects) {
        this.onProjectsUpdated(data.projects);
      }
    } catch (error) {
      console.error('Project polling error:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  /**
   * Handle visibility change - pause when hidden, resume when visible
   */
  handleVisibilityChange(): void {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  }
}

/**
 * Global polling manager to coordinate multiple polling services
 */
class PollingManager {
  private services: Map<string, TaskPollingService | ProjectPollingService> = new Map();

  /**
   * Register a polling service
   */
  register(id: string, service: TaskPollingService | ProjectPollingService): void {
    // Stop any existing service with the same ID
    this.unregister(id);
    
    this.services.set(id, service);
    
    // Start the service
    service.start();
    
    // Set up visibility handling
    const handleVisibility = () => service.handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibility);
    
    // Store the handler for cleanup
    (service as any)._visibilityHandler = handleVisibility;
  }

  /**
   * Unregister a polling service
   */
  unregister(id: string): void {
    const service = this.services.get(id);
    if (service) {
      service.stop();
      
      // Clean up visibility handler
      const handler = (service as any)._visibilityHandler;
      if (handler) {
        document.removeEventListener('visibilitychange', handler);
      }
      
      this.services.delete(id);
    }
  }

  /**
   * Stop all polling services
   */
  stopAll(): void {
    this.services.forEach(service => service.stop());
  }

  /**
   * Resume all polling services
   */
  resumeAll(): void {
    this.services.forEach(service => service.start());
  }

  /**
   * Clean up all services
   */
  cleanup(): void {
    this.services.forEach((_, id) => this.unregister(id));
  }
}

// Export singleton instance
export const pollingManager = new PollingManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pollingManager.cleanup();
  });
}