/**
 * Socket Services - Centralized exports for socket management
 */

// Core classes
export { 
  EventDeduplicator, 
  defaultDeduplicator,
  type SocketEventMetadata 
} from './EventDeduplicator';

export { 
  RoomManager, 
  defaultRoomManager,
  RoomState,
  type RoomInfo,
  type RoomTransition 
} from './RoomManager';

export { 
  SocketManager, 
  getSocketManager,
  ConnectionState,
  type SocketConfig,
  type NamespaceInfo 
} from './SocketManager';

// Convenience re-exports from socket.io-client
export type { Socket } from 'socket.io-client';