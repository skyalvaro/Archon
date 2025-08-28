/**
 * SocketContext - React context for centralized socket management
 * 
 * Features:
 * - Provides socket instances and managers via context
 * - Hooks for socket operations
 * - Connection state management
 * - Room management hooks
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  getSocketManager, 
  ConnectionState,
  EventDeduplicator,
  RoomManager,
  type SocketEventMetadata
} from '../services/socket';

// Context value type
export interface SocketContextValue {
  // Socket instances
  getSocket: (namespace?: string) => Socket | null;
  
  // Connection management
  isConnected: (namespace?: string) => boolean;
  connectionState: (namespace?: string) => ConnectionState;
  ensureConnected: (namespace?: string) => Promise<Socket>;
  reconnect: (namespace?: string) => void;
  
  // Room management
  getRoomManager: (namespace?: string) => RoomManager | null;
  joinRoom: (roomId: string, namespace?: string) => Promise<void>;
  leaveRoom: (namespace?: string) => Promise<void>;
  getCurrentRoom: (namespace?: string) => string | null;
  
  // Event deduplication
  getEventDeduplicator: (namespace?: string) => EventDeduplicator | null;
  createEventMetadata: (type: string, data?: any, namespace?: string) => any;
  shouldProcessEvent: (event: any, namespace?: string) => boolean;
  
  // Stats and debugging
  getStats: () => Record<string, any>;
}

// Create context with undefined default
const SocketContext = createContext<SocketContextValue | undefined>(undefined);

/**
 * SocketProvider - Provides socket management to the app
 */
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketManager = getSocketManager();
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    // Listen for connection state changes
    const unsubscribe = socketManager.onStateChange((state, namespace) => {
      if (mountedRef.current) {
        setConnectionStates(prev => ({
          ...prev,
          [namespace]: state
        }));
      }
    });

    // Cleanup
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [socketManager]);

  // Context value implementation
  const contextValue: SocketContextValue = {
    // Socket instances
    getSocket: useCallback((namespace = '/') => {
      try {
        return socketManager.getSocket(namespace);
      } catch (error) {
        console.error(`Failed to get socket for namespace ${namespace}:`, error);
        return null;
      }
    }, [socketManager]),

    // Connection management
    isConnected: useCallback((namespace = '/') => {
      return socketManager.isConnected(namespace);
    }, [socketManager]),

    connectionState: useCallback((namespace = '/') => {
      return connectionStates[namespace] || socketManager.getConnectionState(namespace);
    }, [socketManager, connectionStates]),

    ensureConnected: useCallback(async (namespace = '/') => {
      return socketManager.ensureConnected(namespace);
    }, [socketManager]),

    reconnect: useCallback((namespace = '/') => {
      socketManager.reconnect(namespace);
    }, [socketManager]),

    // Room management
    getRoomManager: useCallback((namespace = '/') => {
      return socketManager.getRoomManager(namespace);
    }, [socketManager]),

    joinRoom: useCallback(async (roomId: string, namespace = '/') => {
      const roomManager = socketManager.getRoomManager(namespace);
      if (roomManager) {
        await roomManager.joinRoom(roomId);
      } else {
        throw new Error(`No room manager for namespace: ${namespace}`);
      }
    }, [socketManager]),

    leaveRoom: useCallback(async (namespace = '/') => {
      const roomManager = socketManager.getRoomManager(namespace);
      if (roomManager) {
        await roomManager.leaveRoom();
      }
    }, [socketManager]),

    getCurrentRoom: useCallback((namespace = '/') => {
      const roomManager = socketManager.getRoomManager(namespace);
      return roomManager?.getCurrentRoom() || null;
    }, [socketManager]),

    // Event deduplication
    getEventDeduplicator: useCallback((namespace = '/') => {
      return socketManager.getEventDeduplicator(namespace);
    }, [socketManager]),

    createEventMetadata: useCallback((type: string, data?: any, namespace = '/') => {
      const deduplicator = socketManager.getEventDeduplicator(namespace);
      if (deduplicator) {
        return deduplicator.createEventMetadata(type, data);
      }
      return data;
    }, [socketManager]),

    shouldProcessEvent: useCallback((event: any, namespace = '/') => {
      const deduplicator = socketManager.getEventDeduplicator(namespace);
      if (deduplicator) {
        return deduplicator.shouldProcessEvent(event);
      }
      return true; // Process if no deduplicator
    }, [socketManager]),

    // Stats and debugging
    getStats: useCallback(() => {
      return socketManager.getStats();
    }, [socketManager])
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

/**
 * useSocket - Hook to access socket context
 */
export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

/**
 * useSocketConnection - Hook for connection state
 */
export const useSocketConnection = (namespace = '/') => {
  const { isConnected, connectionState, ensureConnected, reconnect } = useSocket();
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);

  useEffect(() => {
    // Initial state
    setConnected(isConnected(namespace));
    setState(connectionState(namespace));

    // Listen for changes
    const socketManager = getSocketManager();
    const unsubscribe = socketManager.onStateChange((newState, ns) => {
      if (ns === namespace) {
        setState(newState);
        setConnected(newState === ConnectionState.CONNECTED);
      }
    });

    return unsubscribe;
  }, [namespace, isConnected, connectionState]);

  return {
    connected,
    state,
    connect: () => ensureConnected(namespace),
    reconnect: () => reconnect(namespace)
  };
};

/**
 * useSocketRoom - Hook for room management (basic version, full version in separate file)
 */
export const useSocketRoomBasic = (roomId: string | null, namespace = '/') => {
  const { joinRoom, leaveRoom, getCurrentRoom, getRoomManager } = useSocket();
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<any>(null);

  useEffect(() => {
    if (!roomId) return;

    const join = async () => {
      try {
        await joinRoom(roomId, namespace);
        setCurrentRoom(roomId);
      } catch (error) {
        console.error(`Failed to join room ${roomId}:`, error);
      }
    };

    join();

    // Listen for room state changes
    const roomManager = getRoomManager(namespace);
    if (roomManager) {
      const unsubscribe = roomManager.onStateChange((state, room) => {
        setRoomState({ state, room });
      });

      return () => {
        unsubscribe();
        leaveRoom(namespace).catch(err => 
          console.warn('Error leaving room on cleanup:', err)
        );
      };
    }
  }, [roomId, namespace, joinRoom, leaveRoom, getRoomManager]);

  return {
    currentRoom,
    roomState,
    isInRoom: currentRoom === roomId
  };
};

/**
 * useSocketEmit - Hook for emitting events with metadata
 */
export const useSocketEmit = (namespace = '/') => {
  const { getSocket, createEventMetadata, getRoomManager } = useSocket();

  const emit = useCallback((event: string, data?: any, options?: { toRoom?: boolean }) => {
    const socket = getSocket(namespace);
    if (!socket) {
      console.warn(`Cannot emit: no socket for namespace ${namespace}`);
      return false;
    }

    // Add metadata
    const eventData = createEventMetadata(event, data, namespace);

    // Emit based on options
    if (options?.toRoom) {
      const roomManager = getRoomManager(namespace);
      if (roomManager && roomManager.getCurrentRoom()) {
        roomManager.emitToRoom(event, eventData);
      } else {
        console.warn('Cannot emit to room: not in a room');
        return false;
      }
    } else {
      socket.emit(event, eventData);
    }

    return true;
  }, [namespace, getSocket, createEventMetadata, getRoomManager]);

  const emitWithAck = useCallback((event: string, data?: any, timeout = 5000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = getSocket(namespace);
      if (!socket) {
        reject(new Error(`No socket for namespace ${namespace}`));
        return;
      }

      const eventData = createEventMetadata(event, data, namespace);
      
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event} acknowledgment`));
      }, timeout);

      socket.emit(event, eventData, (response: any) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }, [namespace, getSocket, createEventMetadata]);

  return { emit, emitWithAck };
};

/**
 * useSocketListener - Hook for listening to events with deduplication
 */
export const useSocketListener = (
  event: string,
  handler: (data: any) => void,
  namespace = '/',
  deps: React.DependencyList = []
) => {
  const { getSocket, shouldProcessEvent } = useSocket();

  useEffect(() => {
    const socket = getSocket(namespace);
    if (!socket) return;

    const wrappedHandler = (data: any) => {
      // Check if we should process this event
      if (shouldProcessEvent(data, namespace)) {
        handler(data);
      }
    };

    socket.on(event, wrappedHandler);

    return () => {
      socket.off(event, wrappedHandler);
    };
  }, [namespace, event, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
};

/**
 * useSocketStats - Hook for monitoring socket stats
 */
export const useSocketStats = () => {
  const { getStats } = useSocket();
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => {
    // Update stats periodically
    const updateStats = () => {
      setStats(getStats());
    };

    updateStats(); // Initial
    const interval = setInterval(updateStats, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [getStats]);

  return stats;
};