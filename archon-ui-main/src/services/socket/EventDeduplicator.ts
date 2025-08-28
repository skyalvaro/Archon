/**
 * EventDeduplicator - Prevents duplicate events and echo in Socket.IO communications
 * 
 * Features:
 * - Sliding window deduplication with configurable TTL
 * - Echo prevention for self-generated events
 * - Automatic cleanup of expired entries
 * - Thread-safe operations with Map-based storage
 */

export interface SocketEventMetadata {
  id: string;          // Unique event ID
  sourceId: string;    // Client that initiated the event
  timestamp: number;   // Event timestamp for ordering
  type?: string;       // Optional event type
}

export class EventDeduplicator {
  // Track processed events with timestamp for cleanup
  private processedEvents = new Map<string, number>();
  
  // Track our own events to prevent echo
  private ownEvents = new Map<string, number>();
  
  // Client ID for this instance
  private readonly clientId: string;
  
  // Deduplication window in milliseconds
  private readonly windowMs: number;
  
  // Cleanup interval handle
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(windowMs = 100, clientId?: string) {
    this.windowMs = windowMs;
    this.clientId = clientId || `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Start periodic cleanup
    this.startCleanupTimer();
  }

  /**
   * Get the client ID for this deduplicator instance
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Check if an event is a duplicate based on its ID
   * @param eventId - The unique event identifier
   * @returns true if this is a duplicate event within the window
   */
  isDuplicate(eventId: string): boolean {
    const now = Date.now();
    const processed = this.processedEvents.get(eventId);
    
    // Check if we've seen this event within the dedup window
    if (processed && now - processed < this.windowMs) {
      console.debug(`[EventDedup] Duplicate event detected: ${eventId}`);
      return true;
    }
    
    // Mark as processed
    this.processedEvents.set(eventId, now);
    
    // Trigger cleanup if map is getting large
    if (this.processedEvents.size > 1000) {
      this.cleanup();
    }
    
    return false;
  }

  /**
   * Check if an event is an echo (originated from this client)
   * @param sourceId - The source client ID from the event
   * @returns true if this event originated from this client
   */
  isEcho(sourceId: string): boolean {
    if (sourceId === this.clientId) {
      console.debug(`[EventDedup] Echo detected from self: ${sourceId}`);
      return true;
    }
    return false;
  }

  /**
   * Track an event that we're sending to prevent echo
   * @param eventId - The unique event identifier
   * @param sourceId - The source client ID (optional, defaults to our clientId)
   */
  trackEvent(eventId: string, sourceId?: string): void {
    const now = Date.now();
    const actualSourceId = sourceId || this.clientId;
    
    // Track as our own event if it's from us
    if (actualSourceId === this.clientId) {
      this.ownEvents.set(eventId, now);
    }
    
    // Also add to processed events to prevent re-processing
    this.processedEvents.set(eventId, now);
  }

  /**
   * Create event metadata with unique ID and source tracking
   * @param type - The event type
   * @param data - Optional additional data to include
   */
  createEventMetadata(type: string, data?: any): SocketEventMetadata & any {
    const metadata: SocketEventMetadata = {
      id: `${this.clientId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sourceId: this.clientId,
      timestamp: Date.now(),
      type
    };

    // Track this as our own event
    this.trackEvent(metadata.id, metadata.sourceId);

    // Return combined metadata and data
    return data ? { ...data, _meta: metadata } : { _meta: metadata };
  }

  /**
   * Extract metadata from an event
   * @param event - The event object
   * @returns The metadata if present, null otherwise
   */
  extractMetadata(event: any): SocketEventMetadata | null {
    if (event?._meta && typeof event._meta === 'object') {
      return event._meta as SocketEventMetadata;
    }
    
    // Check for metadata at root level
    if (event?.id && event?.sourceId && event?.timestamp) {
      return {
        id: event.id,
        sourceId: event.sourceId,
        timestamp: event.timestamp,
        type: event.type
      };
    }
    
    return null;
  }

  /**
   * Process an incoming event for deduplication and echo detection
   * @param event - The event to process
   * @returns true if the event should be processed, false if it should be ignored
   */
  shouldProcessEvent(event: any): boolean {
    const metadata = this.extractMetadata(event);
    
    if (!metadata) {
      // No metadata, process the event (legacy support)
      console.debug('[EventDedup] Event has no metadata, processing anyway');
      return true;
    }
    
    // Check for echo first
    if (this.isEcho(metadata.sourceId)) {
      return false;
    }
    
    // Check for duplicate
    if (this.isDuplicate(metadata.id)) {
      return false;
    }
    
    return true;
  }

  /**
   * Clean up expired entries from the maps
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    
    // Clean processed events
    for (const [id, timestamp] of this.processedEvents) {
      if (timestamp < cutoff) {
        this.processedEvents.delete(id);
      }
    }
    
    // Clean own events
    for (const [id, timestamp] of this.ownEvents) {
      if (timestamp < cutoff) {
        this.ownEvents.delete(id);
      }
    }
    
    console.debug(`[EventDedup] Cleanup complete. Processed: ${this.processedEvents.size}, Own: ${this.ownEvents.size}`);
  }

  /**
   * Start the periodic cleanup timer
   */
  private startCleanupTimer(): void {
    // Clean up every 10 seconds or 10x the window, whichever is longer
    const interval = Math.max(10000, this.windowMs * 10);
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   * Stop the cleanup timer and clear all maps
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.processedEvents.clear();
    this.ownEvents.clear();
  }

  /**
   * Get statistics about the deduplicator
   */
  getStats(): {
    clientId: string;
    processedCount: number;
    ownEventCount: number;
    windowMs: number;
  } {
    return {
      clientId: this.clientId,
      processedCount: this.processedEvents.size,
      ownEventCount: this.ownEvents.size,
      windowMs: this.windowMs
    };
  }
}

// Export a default instance for convenience
export const defaultDeduplicator = new EventDeduplicator();