/**
 * useSocketRoom - Generic room management hook with automatic lifecycle
 * 
 * Features:
 * - Automatic room join/leave on mount/unmount
 * - Event handler registration with deduplication
 * - Optimistic update support
 * - Room state tracking
 * - Reconnection handling
 */

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useSocket, useSocketConnection } from '../contexts/SocketContext';
import { RoomState } from '../services/socket/RoomManager';

// Event handler type
export type SocketRoomEventHandler<T = any> = (data: T) => void;

// Room options
export interface UseSocketRoomOptions {
  namespace?: string;
  autoJoin?: boolean;
  autoReconnect?: boolean;
  debugMode?: boolean;
}

// Room event subscription
export interface RoomEventSubscription {
  event: string;
  handler: SocketRoomEventHandler;
  options?: {
    once?: boolean;
    deduplicate?: boolean;
  };
}

// Room hook return value
export interface UseSocketRoomReturn {
  // State
  isInRoom: boolean;
  roomState: RoomState;
  currentRoom: string | null;
  isConnected: boolean;
  
  // Actions
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  switchRoom: (newRoomId: string) => Promise<void>;
  
  // Event handling
  emit: (event: string, data?: any) => boolean;
  emitToRoom: (event: string, data?: any) => boolean;
  emitWithAck: (event: string, data?: any, timeout?: number) => Promise<any>;
  subscribe: (event: string, handler: SocketRoomEventHandler, options?: any) => () => void;
  
  // Optimistic updates
  emitOptimistic: <T>(event: string, data: any, optimisticUpdate: () => T, rollback: (prev: T) => void) => void;
  
  // Stats
  getStats: () => any;
}

/**
 * Generic room management hook
 */
export function useSocketRoom(
  roomId: string | null,
  options: UseSocketRoomOptions = {}
): UseSocketRoomReturn {
  const {
    namespace = '/',
    autoJoin = true,
    autoReconnect = true,
    debugMode = false
  } = options;

  // Socket context
  const {
    getSocket,
    getRoomManager,
    joinRoom: contextJoinRoom,
    leaveRoom: contextLeaveRoom,
    getCurrentRoom,
    createEventMetadata,
    shouldProcessEvent,
    getEventDeduplicator
  } = useSocket();

  const { connected, connect } = useSocketConnection(namespace);

  // State
  const [roomState, setRoomState] = useState<RoomState>(RoomState.IDLE);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [isInRoom, setIsInRoom] = useState(false);
  
  // Refs for cleanup and state tracking
  const subscriptionsRef = useRef<Map<string, (() => void)[]>>(new Map());
  const mountedRef = useRef(true);
  const joiningRef = useRef(false);
  const targetRoomRef = useRef<string | null>(null);

  // Debug logging
  const debug = useCallback((...args: any[]) => {
    if (debugMode) {
      console.log('[useSocketRoom]', ...args);
    }
  }, [debugMode]);

  // Join room implementation
  const joinRoom = useCallback(async (targetRoomId: string) => {
    if (!targetRoomId) {
      debug('No room ID provided to join');
      return;
    }

    // Prevent concurrent join attempts
    if (joiningRef.current) {
      debug('Already joining a room, skipping');
      return;
    }

    // Check if already in target room
    const roomManager = getRoomManager(namespace);
    const currentRoomInfo = roomManager?.getRoomInfo();
    if (currentRoomInfo?.roomId === targetRoomId && currentRoomInfo?.state === RoomState.JOINED) {
      debug(`Already in room: ${targetRoomId}`);
      setCurrentRoom(targetRoomId);
      setIsInRoom(true);
      return;
    }

    joiningRef.current = true;
    targetRoomRef.current = targetRoomId;

    try {
      debug(`Joining room: ${targetRoomId}`);
      
      // Ensure connected first
      if (!connected && autoReconnect) {
        await connect();
      }
      
      await contextJoinRoom(targetRoomId, namespace);
      
      if (mountedRef.current && targetRoomRef.current === targetRoomId) {
        setCurrentRoom(targetRoomId);
        setIsInRoom(true);
      }
      
      debug(`Successfully joined room: ${targetRoomId}`);
    } catch (error) {
      console.error(`Failed to join room ${targetRoomId}:`, error);
      if (mountedRef.current) {
        setIsInRoom(false);
      }
      throw error;
    } finally {
      joiningRef.current = false;
    }
  }, [connected, connect, contextJoinRoom, namespace, autoReconnect, getRoomManager, debug]);

  // Leave room implementation
  const leaveRoom = useCallback(async () => {
    const roomManager = getRoomManager(namespace);
    const currentRoomInfo = roomManager?.getRoomInfo();
    
    if (!currentRoomInfo?.roomId) {
      debug('No room to leave');
      return;
    }

    // Check if we're already leaving
    if (currentRoomInfo.state === RoomState.LEAVING) {
      debug('Already leaving room');
      return;
    }

    try {
      debug(`Leaving room: ${currentRoomInfo.roomId}`);
      await contextLeaveRoom(namespace);
      
      if (mountedRef.current) {
        setCurrentRoom(null);
        setIsInRoom(false);
        targetRoomRef.current = null;
      }
      
      debug('Successfully left room');
    } catch (error) {
      // Only log real errors, not state conflicts
      if (!error?.message?.includes('Cannot leave room in state')) {
        console.error('Failed to leave room:', error);
      }
      throw error;
    }
  }, [contextLeaveRoom, namespace, getRoomManager, debug]);

  // Switch room implementation
  const switchRoom = useCallback(async (newRoomId: string) => {
    if (currentRoom === newRoomId) {
      debug(`Already in room: ${newRoomId}`);
      return;
    }

    debug(`Switching from ${currentRoom} to ${newRoomId}`);
    
    // Leave current room if any
    if (currentRoom) {
      await leaveRoom();
    }
    
    // Join new room
    await joinRoom(newRoomId);
  }, [currentRoom, joinRoom, leaveRoom, debug]);

  // Emit to general namespace
  const emit = useCallback((event: string, data?: any): boolean => {
    const socket = getSocket(namespace);
    if (!socket) {
      console.warn(`Cannot emit: no socket for namespace ${namespace}`);
      return false;
    }

    const eventData = createEventMetadata(event, data, namespace);
    socket.emit(event, eventData);
    
    debug(`Emitted event: ${event}`, eventData);
    return true;
  }, [namespace, getSocket, createEventMetadata, debug]);

  // Emit to current room only
  const emitToRoom = useCallback((event: string, data?: any): boolean => {
    const roomManager = getRoomManager(namespace);
    if (!roomManager || !currentRoom) {
      console.warn('Cannot emit to room: not in a room');
      return false;
    }

    const eventData = createEventMetadata(event, data, namespace);
    roomManager.emitToRoom(event, eventData);
    
    debug(`Emitted to room ${currentRoom}: ${event}`, eventData);
    return true;
  }, [namespace, currentRoom, getRoomManager, createEventMetadata, debug]);

  // Emit with acknowledgment
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
        debug(`Received ack for ${event}:`, response);
        resolve(response);
      });
    });
  }, [namespace, getSocket, createEventMetadata, debug]);

  // Subscribe to events with deduplication
  const subscribe = useCallback((
    event: string,
    handler: SocketRoomEventHandler,
    options: any = {}
  ): (() => void) => {
    const socket = getSocket(namespace);
    if (!socket) {
      console.warn(`Cannot subscribe: no socket for namespace ${namespace}`);
      return () => {};
    }

    const wrappedHandler = (data: any) => {
      // Check deduplication
      if (shouldProcessEvent(data, namespace)) {
        debug(`Processing event ${event}:`, data);
        handler(data);
      } else {
        debug(`Skipping duplicate/echo event ${event}`);
      }
    };

    // Register handler
    if (options.once) {
      socket.once(event, wrappedHandler);
    } else {
      socket.on(event, wrappedHandler);
    }

    // Track subscription for cleanup
    const unsubscribe = () => {
      socket.off(event, wrappedHandler);
    };

    const subs = subscriptionsRef.current.get(event) || [];
    subs.push(unsubscribe);
    subscriptionsRef.current.set(event, subs);

    debug(`Subscribed to event: ${event}`);

    return unsubscribe;
  }, [namespace, getSocket, shouldProcessEvent, debug]);

  // Optimistic update helper
  const emitOptimistic = useCallback(<T>(
    event: string,
    data: any,
    optimisticUpdate: () => T,
    rollback: (prev: T) => void
  ) => {
    // Apply optimistic update
    const prevState = optimisticUpdate();
    
    // Emit with acknowledgment
    emitWithAck(event, data)
      .then(() => {
        debug(`Optimistic update confirmed for ${event}`);
      })
      .catch((error) => {
        console.error(`Optimistic update failed for ${event}:`, error);
        // Rollback on failure
        rollback(prevState);
      });
  }, [emitWithAck, debug]);

  // Get stats
  const getStats = useCallback(() => {
    const roomManager = getRoomManager(namespace);
    const eventDeduplicator = getEventDeduplicator(namespace);
    
    return {
      roomInfo: roomManager?.getRoomInfo(),
      dedupStats: eventDeduplicator?.getStats(),
      subscriptions: Array.from(subscriptionsRef.current.keys()),
      isInRoom,
      currentRoom,
      roomState
    };
  }, [namespace, getRoomManager, getEventDeduplicator, isInRoom, currentRoom, roomState]);

  // Track room state changes
  useEffect(() => {
    const roomManager = getRoomManager(namespace);
    if (!roomManager) return;

    const unsubscribe = roomManager.onStateChange((state, room) => {
      if (mountedRef.current) {
        setRoomState(state);
        setCurrentRoom(room);
        setIsInRoom(state === RoomState.JOINED);
        debug(`Room state changed: ${state}, room: ${room}`);
      }
    });

    return unsubscribe;
  }, [namespace, getRoomManager, debug]);

  // Auto-join room on mount - single effect to prevent loops
  useEffect(() => {
    if (!autoJoin || !roomId || !mountedRef.current) return;

    let cleanupScheduled = false;

    // Join room after a delay to prevent race conditions
    const joinTimer = setTimeout(() => {
      if (mountedRef.current && roomId && targetRoomRef.current !== roomId) {
        joinRoom(roomId).catch(error => {
          if (mountedRef.current) {
            console.error('Auto-join failed:', error);
          }
        });
      }
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(joinTimer);
      cleanupScheduled = true;
      
      // Leave room on unmount if we're in it
      if (targetRoomRef.current === roomId && !cleanupScheduled) {
        const roomManager = getRoomManager(namespace);
        const currentRoomInfo = roomManager?.getRoomInfo();
        
        if (currentRoomInfo?.roomId === roomId) {
          contextLeaveRoom(namespace).catch(err => {
            // Silently ignore state conflicts on cleanup
            if (!err?.message?.includes('Cannot leave room in state')) {
              console.warn('Error leaving room on cleanup:', err);
            }
          });
        }
      }
    };
  }, [roomId]); // Only depend on roomId to prevent loops

  // Handle reconnection - separate effect
  useEffect(() => {
    if (!autoReconnect || !connected) return;

    // Check if we need to rejoin after reconnection
    const roomManager = getRoomManager(namespace);
    const shouldRejoin = targetRoomRef.current && 
                         roomManager?.getRoomInfo()?.roomId !== targetRoomRef.current;

    if (shouldRejoin && targetRoomRef.current) {
      const rejoinTimer = setTimeout(() => {
        if (mountedRef.current && targetRoomRef.current) {
          joinRoom(targetRoomRef.current).catch(error => {
            console.error('Failed to rejoin room after reconnection:', error);
          });
        }
      }, 500); // Delay to let connection stabilize

      return () => clearTimeout(rejoinTimer);
    }
  }, [connected]); // Only depend on connected state

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      
      // Cleanup all subscriptions
      subscriptionsRef.current.forEach(unsubscribes => {
        unsubscribes.forEach(unsub => unsub());
      });
      subscriptionsRef.current.clear();
    };
  }, []);

  // Return memoized API
  return useMemo(() => ({
    // State
    isInRoom,
    roomState,
    currentRoom,
    isConnected: connected,
    
    // Actions
    joinRoom,
    leaveRoom,
    switchRoom,
    
    // Event handling
    emit,
    emitToRoom,
    emitWithAck,
    subscribe,
    
    // Optimistic updates
    emitOptimistic,
    
    // Stats
    getStats
  }), [
    isInRoom,
    roomState,
    currentRoom,
    connected,
    joinRoom,
    leaveRoom,
    switchRoom,
    emit,
    emitToRoom,
    emitWithAck,
    subscribe,
    emitOptimistic,
    getStats
  ]);
}

/**
 * Typed version of useSocketRoom for specific event types
 */
export function useTypedSocketRoom<TEvents extends Record<string, any>>(
  roomId: string | null,
  options: UseSocketRoomOptions = {}
) {
  const room = useSocketRoom(roomId, options);
  
  // Type-safe emit
  const typedEmit = useCallback(<K extends keyof TEvents>(
    event: K,
    data: TEvents[K]
  ): boolean => {
    return room.emit(event as string, data);
  }, [room]);
  
  // Type-safe subscribe
  const typedSubscribe = useCallback(<K extends keyof TEvents>(
    event: K,
    handler: (data: TEvents[K]) => void,
    options?: any
  ): (() => void) => {
    return room.subscribe(event as string, handler, options);
  }, [room]);
  
  return {
    ...room,
    emit: typedEmit,
    subscribe: typedSubscribe
  };
}