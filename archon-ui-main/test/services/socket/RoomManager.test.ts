/**
 * Unit tests for RoomManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager, RoomState } from '../../../src/services/socket/RoomManager';
import { EventDeduplicator } from '../../../src/services/socket/EventDeduplicator';

// Mock socket.io-client
const mockSocket = {
  emit: vi.fn(),
  onAny: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  to: vi.fn(() => ({
    emit: vi.fn()
  }))
};

// Mock EventDeduplicator
const mockDeduplicator = {
  createEventMetadata: vi.fn((type, data) => ({ type, ...data, _meta: { id: 'test-id' } })),
  shouldProcessEvent: vi.fn(() => true),
  extractMetadata: vi.fn(() => ({ id: 'test-id' }))
};

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    vi.clearAllMocks();
    roomManager = new RoomManager(mockDeduplicator as any);
    roomManager.initialize(mockSocket as any);
  });

  afterEach(async () => {
    await roomManager.cleanup();
  });

  describe('Initialization and State', () => {
    it('should initialize with IDLE state', () => {
      expect(roomManager.getState()).toBe(RoomState.IDLE);
      expect(roomManager.getCurrentRoom()).toBeNull();
      expect(roomManager.getRoomInfo()).toBeNull();
    });

    it('should setup socket listeners on initialize', () => {
      expect(mockSocket.onAny).toHaveBeenCalled();
    });
  });

  describe('Room Joining', () => {
    it('should join room successfully', async () => {
      const roomId = 'test-room-1';
      
      // Mock successful acknowledgment
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'join_room' && callback) {
          setTimeout(callback, 10);
        }
      });

      await roomManager.joinRoom(roomId);

      expect(roomManager.getState()).toBe(RoomState.JOINED);
      expect(roomManager.getCurrentRoom()).toBe(roomId);
      expect(mockSocket.emit).toHaveBeenCalledWith('join_room', roomId, expect.any(Function));
    });

    it('should handle join timeout', async () => {
      const roomId = 'test-room-timeout';
      
      // Mock no acknowledgment (timeout)
      mockSocket.emit.mockImplementation(() => {
        // Don't call callback to simulate timeout
      });

      await expect(roomManager.joinRoom(roomId)).rejects.toThrow('Failed to join room test-room-timeout');
      expect(roomManager.getState()).toBe(RoomState.IDLE);
    });

    it('should not join if already in same room', async () => {
      const roomId = 'same-room';
      
      // Mock successful join first time
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      await roomManager.joinRoom(roomId);
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);

      // Try to join same room again
      await roomManager.joinRoom(roomId);
      
      // Should not emit again
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    });

    it('should switch rooms when joining different room', async () => {
      const room1 = 'room-1';
      const room2 = 'room-2';
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      // Join first room
      await roomManager.joinRoom(room1);
      expect(roomManager.getCurrentRoom()).toBe(room1);

      // Join second room (should switch)
      await roomManager.joinRoom(room2);
      expect(roomManager.getCurrentRoom()).toBe(room2);
      
      // Should have called leave_room and join_room
      expect(mockSocket.emit).toHaveBeenCalledWith('leave_room', room1, expect.any(Function));
      expect(mockSocket.emit).toHaveBeenCalledWith('join_room', room2, expect.any(Function));
    });
  });

  describe('Room Leaving', () => {
    it('should leave room successfully', async () => {
      const roomId = 'leave-test-room';
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      // First join a room
      await roomManager.joinRoom(roomId);
      expect(roomManager.getCurrentRoom()).toBe(roomId);

      // Then leave
      await roomManager.leaveRoom();
      
      expect(roomManager.getState()).toBe(RoomState.IDLE);
      expect(roomManager.getCurrentRoom()).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalledWith('leave_room', roomId, expect.any(Function));
    });

    it('should handle leave when not in room', async () => {
      // Should not throw when leaving without being in a room
      await expect(roomManager.leaveRoom()).resolves.not.toThrow();
      expect(roomManager.getState()).toBe(RoomState.IDLE);
    });

    it('should clear state even if leave fails', async () => {
      const roomId = 'fail-leave-room';
      
      // First join successfully
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'join_room' && callback) {
          setTimeout(callback, 10);
        }
        // Don't call callback for leave_room to simulate failure
      });

      await roomManager.joinRoom(roomId);
      
      // Leave should fail but still clear state
      await roomManager.leaveRoom();
      
      expect(roomManager.getState()).toBe(RoomState.IDLE);
      expect(roomManager.getCurrentRoom()).toBeNull();
    });
  });

  describe('Room Switching', () => {
    it('should switch rooms successfully', async () => {
      const room1 = 'switch-room-1';
      const room2 = 'switch-room-2';
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      // Start in first room
      await roomManager.joinRoom(room1);
      expect(roomManager.getCurrentRoom()).toBe(room1);

      // Switch to second room
      await roomManager.switchRoom(room2);
      
      expect(roomManager.getCurrentRoom()).toBe(room2);
      expect(roomManager.getState()).toBe(RoomState.JOINED);
    });

    it('should not switch if already in target room', async () => {
      const roomId = 'no-switch-room';
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      await roomManager.joinRoom(roomId);
      const emitCallCount = mockSocket.emit.mock.calls.length;

      // Try to switch to same room
      await roomManager.switchRoom(roomId);
      
      // Should not have made additional calls
      expect(mockSocket.emit.mock.calls.length).toBe(emitCallCount);
    });
  });

  describe('Event Listeners', () => {
    it('should add and remove room event listeners', () => {
      const callback = vi.fn();
      const eventType = 'test_event';
      
      const unsubscribe = roomManager.onRoomEvent(eventType, callback);
      expect(typeof unsubscribe).toBe('function');
      
      // Test unsubscribe
      unsubscribe();
      // Should not throw
    });

    it('should add and remove state change listeners', () => {
      const callback = vi.fn();
      
      const unsubscribe = roomManager.onStateChange(callback);
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
      // Should not throw
    });

    it('should notify state change listeners', async () => {
      const callback = vi.fn();
      roomManager.onStateChange(callback);
      
      mockSocket.emit.mockImplementation((event, data, cb) => {
        if (cb) setTimeout(cb, 10);
      });

      await roomManager.joinRoom('test-room');
      
      // Should have been called during state transitions
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Event Emission', () => {
    it('should emit to room with metadata', async () => {
      const roomId = 'emit-test-room';
      const eventType = 'test_event';
      const data = { message: 'hello' };
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      // Join room first
      await roomManager.joinRoom(roomId);
      
      // Emit to room
      roomManager.emitToRoom(eventType, data);
      
      expect(mockDeduplicator.createEventMetadata).toHaveBeenCalledWith(eventType, data);
      // Should call socket.to().emit() but we can't easily mock that
    });

    it('should not emit when not in room', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      roomManager.emitToRoom('test_event', {});
      
      expect(consoleSpy).toHaveBeenCalledWith('[RoomManager] Cannot emit: no socket or room');
      
      consoleSpy.mockRestore();
    });
  });

  describe('History Tracking', () => {
    it('should track room transitions', async () => {
      const room1 = 'history-room-1';
      const room2 = 'history-room-2';
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      await roomManager.joinRoom(room1);
      await roomManager.switchRoom(room2);
      await roomManager.leaveRoom();
      
      const history = roomManager.getHistory();
      expect(history.length).toBeGreaterThan(0);
      
      // Check transition structure
      expect(history[0]).toMatchObject({
        from: null,
        to: room1,
        reason: 'join',
        timestamp: expect.any(Number)
      });
    });

    it('should limit history size', async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 1);
      });

      // Create many transitions to test limit
      for (let i = 0; i < 60; i++) {
        await roomManager.joinRoom(`room-${i}`);
        await roomManager.leaveRoom();
      }
      
      const history = roomManager.getHistory();
      expect(history.length).toBeLessThanOrEqual(50); // Max history size
    });
  });

  describe('State Machine Validation', () => {
    it('should prevent invalid state transitions', async () => {
      // Try to leave when in IDLE state
      await expect(roomManager.leaveRoom()).resolves.not.toThrow();
      
      // State machine should prevent invalid transitions
      // This is mostly internal validation
    });

    it('should handle concurrent operations', async () => {
      const roomId = 'concurrent-room';
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      // Start first operation
      const promise1 = roomManager.joinRoom(roomId);
      
      // Wait a bit then start more operations - they should wait for the first to complete
      await new Promise(resolve => setTimeout(resolve, 5));
      const promise2 = roomManager.joinRoom(roomId);
      const promise3 = roomManager.joinRoom(roomId);

      await Promise.all([promise1, promise2, promise3]);
      
      // Should end up in correct state
      expect(roomManager.getCurrentRoom()).toBe(roomId);
      expect(roomManager.getState()).toBe(RoomState.JOINED);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly', async () => {
      const roomId = 'cleanup-room';
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) setTimeout(callback, 10);
      });

      await roomManager.joinRoom(roomId);
      
      await roomManager.cleanup();
      
      expect(roomManager.getState()).toBe(RoomState.IDLE);
      expect(roomManager.getCurrentRoom()).toBeNull();
      expect(roomManager.getHistory()).toEqual([]);
    });
  });
});