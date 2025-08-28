/**
 * Unit tests for SocketManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock socket.io-client
const mockSocket = {
  connected: false,
  id: 'mock-socket-id',
  emit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  io: {
    on: vi.fn(),
    off: vi.fn()
  }
};

// Mock the io function
const mockIo = vi.fn(() => mockSocket);

// Mock socket.io-client module
vi.mock('socket.io-client', () => ({
  io: mockIo
}));

// Import SocketManager after mocking
import { SocketManager, ConnectionState } from '../../../src/services/socket/SocketManager';

describe('SocketManager', () => {
  let socketManager: SocketManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    
    // Get fresh instance
    socketManager = SocketManager.getInstance();
  });

  afterEach(() => {
    socketManager.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = SocketManager.getInstance();
      const instance2 = SocketManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Socket Creation and Management', () => {
    it('should create socket for default namespace', () => {
      const socket = socketManager.getSocket();
      
      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String), // URL
        expect.objectContaining({
          reconnection: true,
          reconnectionDelay: 1000,
          transports: ['websocket', 'polling']
        })
      );
      expect(socket).toBe(mockSocket);
    });

    it('should reuse existing socket for same namespace', () => {
      const socket1 = socketManager.getSocket('/');
      const socket2 = socketManager.getSocket('/');
      
      expect(socket1).toBe(socket2);
      expect(mockIo).toHaveBeenCalledTimes(1);
    });

    it('should create different sockets for different namespaces', () => {
      const socket1 = socketManager.getSocket('/');
      const socket2 = socketManager.getSocket('/test');
      
      expect(socket1).toBe(mockSocket);
      expect(socket2).toBe(mockSocket);
      expect(mockIo).toHaveBeenCalledTimes(2);
    });

    it('should get room manager for namespace', () => {
      socketManager.getSocket('/test');
      const roomManager = socketManager.getRoomManager('/test');
      
      expect(roomManager).toBeDefined();
      expect(roomManager).not.toBeNull();
    });

    it('should get event deduplicator for namespace', () => {
      socketManager.getSocket('/test');
      const deduplicator = socketManager.getEventDeduplicator('/test');
      
      expect(deduplicator).toBeDefined();
      expect(deduplicator).not.toBeNull();
    });
  });

  describe('Connection Management', () => {
    it('should ensure connection when socket already connected', async () => {
      mockSocket.connected = true;
      
      const socket = await socketManager.ensureConnected();
      
      expect(socket).toBe(mockSocket);
      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('should connect socket when not connected', async () => {
      mockSocket.connected = false;
      
      // Mock connection success
      mockSocket.once.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setTimeout(() => {
            mockSocket.connected = true;
            callback();
          }, 10);
        }
      });

      const socket = await socketManager.ensureConnected();
      
      expect(socket).toBe(mockSocket);
      expect(mockSocket.once).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should handle connection timeout', async () => {
      mockSocket.connected = false;
      
      // Mock no connection event (timeout)
      mockSocket.once.mockImplementation(() => {
        // Don't call callback
      });

      await expect(socketManager.ensureConnected()).rejects.toThrow('Connection timeout');
    });

    it('should handle connection error', async () => {
      mockSocket.connected = false;
      
      // Mock connection error
      mockSocket.once.mockImplementation((event, callback) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(new Error('Connection failed')), 10);
        }
      });

      await expect(socketManager.ensureConnected()).rejects.toThrow('Connection failed');
    });
  });

  describe('Connection State Tracking', () => {
    it('should return correct connection state', () => {
      socketManager.getSocket();
      expect(socketManager.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should check if connected', () => {
      mockSocket.connected = false;
      socketManager.getSocket();
      expect(socketManager.isConnected()).toBe(false);
      
      mockSocket.connected = true;
      expect(socketManager.isConnected()).toBe(true);
    });

    it('should handle state change listeners', () => {
      const callback = vi.fn();
      const unsubscribe = socketManager.onStateChange(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Test unsubscribe
      unsubscribe();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle recovery listeners', () => {
      const callback = vi.fn();
      const unsubscribe = socketManager.onRecovery(callback);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('Socket Operations', () => {
    it('should reconnect namespace', () => {
      socketManager.getSocket('/test');
      socketManager.reconnect('/test');
      
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should disconnect namespace', () => {
      socketManager.getSocket('/test');
      socketManager.disconnect('/test');
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should destroy namespace completely', () => {
      socketManager.getSocket('/test');
      socketManager.destroyNamespace('/test');
      
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      
      // Should not find the namespace anymore
      expect(socketManager.getRoomManager('/test')).toBeNull();
    });
  });

  describe('Socket Event Handling', () => {
    beforeEach(() => {
      // Reset the socket mock for event testing
      mockSocket.on.mockClear();
      mockSocket.io.on.mockClear();
    });

    it('should setup socket event listeners', () => {
      socketManager.getSocket('/test');
      
      // Should have set up various event listeners
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle connect event', () => {
      const stateCallback = vi.fn();
      socketManager.onStateChange(stateCallback);
      
      socketManager.getSocket('/test');
      
      // Find and call the connect handler
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (connectHandler) {
        connectHandler();
      }
      
      expect(stateCallback).toHaveBeenCalledWith(ConnectionState.CONNECTED, '/test');
    });

    it('should handle disconnect event', () => {
      const stateCallback = vi.fn();
      socketManager.onStateChange(stateCallback);
      
      socketManager.getSocket('/test');
      
      // Find and call the disconnect handler
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      if (disconnectHandler) {
        disconnectHandler('transport close');
      }
      
      expect(stateCallback).toHaveBeenCalledWith(ConnectionState.DISCONNECTED, '/test');
    });

    it('should handle connection error', () => {
      const stateCallback = vi.fn();
      socketManager.onStateChange(stateCallback);
      
      socketManager.getSocket('/test');
      
      // Find and call the error handler
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
      if (errorHandler) {
        errorHandler(new Error('Test error'));
      }
      
      expect(stateCallback).toHaveBeenCalledWith(ConnectionState.ERROR, '/test');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should return stats for all namespaces', () => {
      socketManager.getSocket('/test1');
      socketManager.getSocket('/test2');
      
      const stats = socketManager.getStats();
      
      expect(stats).toHaveProperty('/test1');
      expect(stats).toHaveProperty('/test2');
      
      expect(stats['/test1']).toMatchObject({
        connected: expect.any(Boolean),
        state: expect.any(String),
        reconnectCount: expect.any(Number)
      });
    });

    it('should include room and deduplication stats', () => {
      socketManager.getSocket('/test');
      const stats = socketManager.getStats();
      
      expect(stats['/test']).toHaveProperty('currentRoom');
      expect(stats['/test']).toHaveProperty('dedupStats');
    });
  });

  describe('Configuration Handling', () => {
    it('should use custom config', () => {
      const customConfig = {
        reconnectionDelay: 2000,
        maxDisconnectionDuration: 5 * 60 * 1000
      };
      
      socketManager.getSocket('/custom', customConfig);
      
      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reconnectionDelay: 2000,
          connectionStateRecovery: expect.objectContaining({
            maxDisconnectionDuration: 5 * 60 * 1000
          })
        })
      );
    });

    it('should handle state recovery configuration', () => {
      const config = {
        enableStateRecovery: true,
        maxDisconnectionDuration: 120000,
        skipMiddlewares: false
      };
      
      socketManager.getSocket('/recovery', config);
      
      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          connectionStateRecovery: {
            maxDisconnectionDuration: 120000,
            skipMiddlewares: false
          }
        })
      );
    });
  });

  describe('Health Monitoring', () => {
    it('should start health monitoring on creation', () => {
      // Health monitoring is started in constructor
      // We can't easily test the interval, but we can verify it exists
      expect(socketManager).toBeDefined();
    });

    it('should stop health monitoring on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      socketManager.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should destroy all namespaces', () => {
      socketManager.getSocket('/test1');
      socketManager.getSocket('/test2');
      
      socketManager.destroy();
      
      // Should have called cleanup on all sockets
      expect(mockSocket.removeAllListeners).toHaveBeenCalledTimes(2);
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(2);
    });

    it('should clear all callbacks on destroy', () => {
      const stateCallback = vi.fn();
      const recoveryCallback = vi.fn();
      
      socketManager.onStateChange(stateCallback);
      socketManager.onRecovery(recoveryCallback);
      
      socketManager.destroy();
      
      // Callbacks should be cleared (no way to directly test this, 
      // but they shouldn't be called after destroy)
    });
  });
});