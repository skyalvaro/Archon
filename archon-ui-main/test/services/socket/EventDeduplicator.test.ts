/**
 * Unit tests for EventDeduplicator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventDeduplicator } from '../../../src/services/socket/EventDeduplicator';

describe('EventDeduplicator', () => {
  let deduplicator: EventDeduplicator;

  beforeEach(() => {
    // Use short window for fast tests
    deduplicator = new EventDeduplicator(50, 'test-client-123');
  });

  afterEach(() => {
    deduplicator.destroy();
  });

  describe('Constructor and Basic Properties', () => {
    it('should initialize with default client ID if none provided', () => {
      const defaultDedup = new EventDeduplicator();
      expect(defaultDedup.getClientId()).toMatch(/^client-\d+-[a-z0-9]+$/);
      defaultDedup.destroy();
    });

    it('should use provided client ID', () => {
      expect(deduplicator.getClientId()).toBe('test-client-123');
    });

    it('should return correct stats', () => {
      const stats = deduplicator.getStats();
      expect(stats).toEqual({
        clientId: 'test-client-123',
        processedCount: 0,
        ownEventCount: 0,
        windowMs: 50
      });
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate events within window', () => {
      const eventId = 'test-event-1';
      
      // First time - not duplicate
      expect(deduplicator.isDuplicate(eventId)).toBe(false);
      
      // Second time within window - is duplicate
      expect(deduplicator.isDuplicate(eventId)).toBe(true);
    });

    it('should not detect duplicates after window expires', async () => {
      const eventId = 'test-event-2';
      
      // First time
      expect(deduplicator.isDuplicate(eventId)).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // Should not be duplicate anymore
      expect(deduplicator.isDuplicate(eventId)).toBe(false);
    });

    it('should handle multiple different events', () => {
      expect(deduplicator.isDuplicate('event-1')).toBe(false);
      expect(deduplicator.isDuplicate('event-2')).toBe(false);
      expect(deduplicator.isDuplicate('event-3')).toBe(false);
      
      // Check duplicates
      expect(deduplicator.isDuplicate('event-1')).toBe(true);
      expect(deduplicator.isDuplicate('event-2')).toBe(true);
      expect(deduplicator.isDuplicate('event-3')).toBe(true);
    });
  });

  describe('Echo Prevention', () => {
    it('should detect echo from same client', () => {
      expect(deduplicator.isEcho('test-client-123')).toBe(true);
    });

    it('should not detect echo from different client', () => {
      expect(deduplicator.isEcho('other-client-456')).toBe(false);
    });

    it('should handle empty/null source IDs', () => {
      expect(deduplicator.isEcho('')).toBe(false);
      expect(deduplicator.isEcho(null as any)).toBe(false);
    });
  });

  describe('Event Tracking', () => {
    it('should track own events correctly', () => {
      const eventId = 'track-test-1';
      
      deduplicator.trackEvent(eventId);
      
      // Should be marked as processed
      expect(deduplicator.isDuplicate(eventId)).toBe(true);
      
      const stats = deduplicator.getStats();
      expect(stats.ownEventCount).toBe(1);
      expect(stats.processedCount).toBe(1);
    });

    it('should track events from other sources', () => {
      const eventId = 'track-test-2';
      
      deduplicator.trackEvent(eventId, 'other-client');
      
      // Should be marked as processed but not as own event
      expect(deduplicator.isDuplicate(eventId)).toBe(true);
      
      const stats = deduplicator.getStats();
      expect(stats.ownEventCount).toBe(0);
      expect(stats.processedCount).toBe(1);
    });
  });

  describe('Event Metadata Management', () => {
    it('should create event metadata correctly', () => {
      const metadata = deduplicator.createEventMetadata('test_event', { message: 'hello' });
      
      expect(metadata._meta).toBeDefined();
      expect(metadata._meta.id).toMatch(/^test-client-123-\d+-[a-z0-9]+$/);
      expect(metadata._meta.sourceId).toBe('test-client-123');
      expect(metadata._meta.type).toBe('test_event');
      expect(metadata._meta.timestamp).toBeTypeOf('number');
      expect(metadata.message).toBe('hello');
    });

    it('should create metadata without additional data', () => {
      const metadata = deduplicator.createEventMetadata('simple_event');
      
      expect(metadata._meta).toBeDefined();
      expect(metadata._meta.type).toBe('simple_event');
      expect(Object.keys(metadata)).toEqual(['_meta']);
    });

    it('should extract metadata from events', () => {
      const event = {
        _meta: {
          id: 'test-id',
          sourceId: 'test-source',
          timestamp: 12345,
          type: 'test_type'
        },
        data: 'test'
      };

      const extracted = deduplicator.extractMetadata(event);
      expect(extracted).toEqual(event._meta);
    });

    it('should extract metadata from root level', () => {
      const event = {
        id: 'root-id',
        sourceId: 'root-source',
        timestamp: 67890,
        type: 'root_type',
        data: 'test'
      };

      const extracted = deduplicator.extractMetadata(event);
      expect(extracted).toEqual({
        id: 'root-id',
        sourceId: 'root-source',
        timestamp: 67890,
        type: 'root_type'
      });
    });

    it('should return null for events without metadata', () => {
      const event = { data: 'no metadata' };
      expect(deduplicator.extractMetadata(event)).toBeNull();
    });
  });

  describe('Event Processing Decision', () => {
    it('should process events without metadata', () => {
      const event = { data: 'no metadata' };
      expect(deduplicator.shouldProcessEvent(event)).toBe(true);
    });

    it('should reject echo events', () => {
      const event = deduplicator.createEventMetadata('test_event');
      
      // Should reject because it's from same client (echo)
      expect(deduplicator.shouldProcessEvent(event)).toBe(false);
    });

    it('should reject duplicate events', () => {
      const event = {
        _meta: {
          id: 'dup-test',
          sourceId: 'other-client',
          timestamp: Date.now(),
          type: 'test_event'
        }
      };

      // First time - should process
      expect(deduplicator.shouldProcessEvent(event)).toBe(true);
      
      // Second time - should reject as duplicate
      expect(deduplicator.shouldProcessEvent(event)).toBe(false);
    });

    it('should process valid events from other clients', () => {
      const event = {
        _meta: {
          id: 'valid-event',
          sourceId: 'other-client',
          timestamp: Date.now(),
          type: 'test_event'
        }
      };

      expect(deduplicator.shouldProcessEvent(event)).toBe(true);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should cleanup expired entries', async () => {
      // Add some events
      deduplicator.trackEvent('cleanup-1');
      deduplicator.trackEvent('cleanup-2');
      
      expect(deduplicator.getStats().processedCount).toBe(2);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // Trigger cleanup by adding many events
      for (let i = 0; i < 1001; i++) {
        deduplicator.isDuplicate(`bulk-${i}`);
      }
      
      // Original events should be cleaned up
      const stats = deduplicator.getStats();
      expect(stats.processedCount).toBeLessThan(1003); // Some cleanup occurred
    });

    it('should destroy properly', () => {
      deduplicator.trackEvent('destroy-test');
      expect(deduplicator.getStats().processedCount).toBe(1);
      
      deduplicator.destroy();
      
      const stats = deduplicator.getStats();
      expect(stats.processedCount).toBe(0);
      expect(stats.ownEventCount).toBe(0);
    });
  });

  describe('Console Logging', () => {
    it('should log debug messages', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      const eventId = 'log-test';
      
      // First call - should not log duplicate
      deduplicator.isDuplicate(eventId);
      
      // Second call - should log duplicate
      deduplicator.isDuplicate(eventId);
      
      // Should log echo
      deduplicator.isEcho('test-client-123');
      
      expect(consoleSpy).toHaveBeenCalledWith('[EventDedup] Duplicate event detected: log-test');
      expect(consoleSpy).toHaveBeenCalledWith('[EventDedup] Echo detected from self: test-client-123');
      
      consoleSpy.mockRestore();
    });
  });
});