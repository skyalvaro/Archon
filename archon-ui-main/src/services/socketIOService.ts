/**
 * Socket.IO WebSocket Service - Enhanced with centralized socket management
 * 
 * Features:
 * - Integrates with SocketManager for singleton connections
 * - Event deduplication and echo prevention
 * - Room-based isolation
 * - Connection state recovery
 * - Backward compatible interface
 */

import { Socket } from 'socket.io-client';
import { 
  getSocketManager, 
  ConnectionState,
  EventDeduplicator,
  RoomManager,
  type SocketEventMetadata 
} from './socket';

export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED'
}

export interface WebSocketConfig {
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  messageTimeout?: number;
  enableHeartbeat?: boolean;
  enableAutoReconnect?: boolean;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
  _meta?: SocketEventMetadata;
  [key: string]: any;
}

type MessageHandler = (message: WebSocketMessage) => void;
type ErrorHandler = (error: Event | Error) => void;
type StateChangeHandler = (state: WebSocketState) => void;

/**
 * Enhanced WebSocketService using SocketManager
 * Maintains backward compatibility while adding new features
 */
export class WebSocketService {
  private socket: Socket | null = null;
  private roomManager: RoomManager | null = null;
  private eventDeduplicator: EventDeduplicator | null = null;
  private config: Required<WebSocketConfig>;
  private sessionId: string = '';
  private namespace: string = '/';
  
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private errorHandlers: ErrorHandler[] = [];
  private stateChangeHandlers: StateChangeHandler[] = [];
  private connectionPromise: Promise<void> | null = null;
  
  private _state: WebSocketState = WebSocketState.DISCONNECTED;
  
  // Track if we're using room-based communication
  private currentRoom: string | null = null;

  constructor(config: WebSocketConfig = {}) {
    this.config = {
      maxReconnectAttempts: 5,
      reconnectInterval: 1000,
      heartbeatInterval: 30000,
      messageTimeout: 60000,
      enableHeartbeat: true,
      enableAutoReconnect: true,
      ...config
    };
  }

  get state(): WebSocketState {
    return this._state;
  }

  private setState(newState: WebSocketState): void {
    if (this._state !== newState) {
      this._state = newState;
      this.notifyStateChange(newState);
    }
  }

  /**
   * Connect to Socket.IO using SocketManager
   */
  async connect(endpoint: string): Promise<void> {
    // Parse endpoint to extract session/room info
    const { sessionId, roomId } = this.parseEndpoint(endpoint);
    
    // If socket is null but we think we're connected, reset state
    if (!this.socket && this.state === WebSocketState.CONNECTED) {
      this.setState(WebSocketState.DISCONNECTED);
    }
    
    // If already connected to same session with a valid socket, return
    if (this.socket && this.state === WebSocketState.CONNECTED && this.sessionId === sessionId) {
      // If room changed, switch rooms
      if (roomId && roomId !== this.currentRoom) {
        await this.joinRoom(roomId);
      }
      return Promise.resolve();
    }

    // If currently connecting, return existing promise
    if (this.connectionPromise && this.state === WebSocketState.CONNECTING) {
      return this.connectionPromise;
    }

    // Disconnect if session changed or socket is invalid
    if ((this.socket && this.sessionId !== sessionId) || (!this.socket && this.sessionId)) {
      this.disconnect();
    }

    this.sessionId = sessionId;
    this.setState(WebSocketState.CONNECTING);

    // Create connection promise
    this.connectionPromise = this.establishConnection(roomId);
    
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private parseEndpoint(endpoint: string): { sessionId: string; roomId?: string } {
    // Extract project ID for room-based communication
    const projectMatch = endpoint.match(/projects\/([^/]+)/);
    if (projectMatch) {
      return { 
        sessionId: projectMatch[1],
        roomId: `project:${projectMatch[1]}`
      };
    }
    
    // Legacy support for other endpoint types
    const sessionMatch = endpoint.match(/sessions\/([^/]+)/);
    const progressMatch = endpoint.match(/crawl-progress\/([^/]+)/);
    const projectProgressMatch = endpoint.match(/project-creation-progress\/([^/]+)/);
    
    const sessionId = sessionMatch?.[1] || progressMatch?.[1] || projectProgressMatch?.[1] || '';
    return { sessionId };
  }

  private async establishConnection(roomId?: string): Promise<void> {
    const socketManager = getSocketManager();
    
    try {
      console.log('🔗 Establishing Socket.IO connection via SocketManager');
      
      // Get socket from manager (creates if needed)
      this.socket = await socketManager.ensureConnected(this.namespace);
      
      // Get associated managers
      this.roomManager = socketManager.getRoomManager(this.namespace);
      this.eventDeduplicator = socketManager.getEventDeduplicator(this.namespace);
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Join room if specified
      if (roomId && this.roomManager) {
        await this.joinRoom(roomId);
      }
      
      // Update state
      this.setState(WebSocketState.CONNECTED);
      
      console.log('🔌 Socket.IO connected successfully via SocketManager');
      
    } catch (error) {
      console.error('❌ Failed to establish Socket.IO connection:', error);
      this.setState(WebSocketState.FAILED);
      throw error;
    }
  }

  private async joinRoom(roomId: string): Promise<void> {
    if (!this.roomManager) {
      console.warn('Cannot join room: RoomManager not initialized');
      return;
    }

    try {
      await this.roomManager.joinRoom(roomId);
      this.currentRoom = roomId;
      console.log(`📍 Joined room: ${roomId}`);
    } catch (error) {
      console.error(`Failed to join room ${roomId}:`, error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    const socketManager = getSocketManager();
    
    // Listen for connection state changes
    socketManager.onStateChange((state, namespace) => {
      if (namespace === this.namespace) {
        // Map ConnectionState to WebSocketState
        const mappedState = this.mapConnectionState(state);
        this.setState(mappedState);
      }
    });

    // Listen for recovery events
    socketManager.onRecovery((recovered, namespace) => {
      if (namespace === this.namespace && recovered) {
        console.log('🔄 Connection state recovered');
        // Re-join room if needed
        if (this.currentRoom && this.roomManager) {
          this.joinRoom(this.currentRoom);
        }
      }
    });

    // Handle incoming messages with deduplication
    this.socket.onAny((eventName: string, ...args: any[]) => {
      // Skip internal Socket.IO events
      if (eventName.startsWith('connect') || eventName.startsWith('disconnect') || 
          eventName.startsWith('reconnect') || eventName === 'error') {
        return;
      }
      
      // Extract event data
      const eventData = args[0];
      
      // Check if we should process this event
      // Only apply deduplication to events that have our metadata structure
      // Backend io.emit() events won't have _meta field and should always be processed
      if (eventData && eventData._meta && this.eventDeduplicator && !this.eventDeduplicator.shouldProcessEvent(eventData)) {
        return; // Skip duplicate or echo
      }
      
      // Convert to WebSocketMessage format
      const message: WebSocketMessage = {
        type: eventName,
        data: eventData,
        timestamp: new Date().toISOString(),
        _meta: this.eventDeduplicator?.extractMetadata(eventData) || undefined
      };
      
      this.handleMessage(message);
    });

    // Handle errors
    this.socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
      this.notifyError(error);
    });
  }

  private mapConnectionState(state: ConnectionState): WebSocketState {
    switch (state) {
      case ConnectionState.CONNECTING:
        return WebSocketState.CONNECTING;
      case ConnectionState.CONNECTED:
        return WebSocketState.CONNECTED;
      case ConnectionState.RECONNECTING:
        return WebSocketState.RECONNECTING;
      case ConnectionState.DISCONNECTED:
        return WebSocketState.DISCONNECTED;
      case ConnectionState.ERROR:
        return WebSocketState.FAILED;
      default:
        return WebSocketState.DISCONNECTED;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    // Notify specific type handlers
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in message handler for type ${message.type}:`, error);
      }
    });
    
    // Notify wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*') || [];
    wildcardHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in wildcard message handler:', error);
      }
    });
  }

  private notifyError(error: Event | Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('Error in error handler:', err);
      }
    });
  }

  private notifyStateChange(state: WebSocketState): void {
    this.stateChangeHandlers.forEach(handler => {
      try {
        handler(state);
      } catch (error) {
        console.error('Error in state change handler:', error);
      }
    });
  }

  /**
   * Add message handler for specific message type
   * Use '*' to handle all message types
   */
  addMessageHandler(type: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  removeMessageHandler(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  addErrorHandler(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  removeErrorHandler(handler: ErrorHandler): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  addStateChangeHandler(handler: StateChangeHandler): void {
    this.stateChangeHandlers.push(handler);
  }

  removeStateChangeHandler(handler: StateChangeHandler): void {
    const index = this.stateChangeHandlers.indexOf(handler);
    if (index > -1) {
      this.stateChangeHandlers.splice(index, 1);
    }
  }

  /**
   * Send a message via Socket.IO with event metadata
   */
  send(data: any): boolean {
    // Check both that we're connected AND have a socket instance
    if (!this.socket || !this.isConnected()) {
      console.warn('Cannot send message: Socket.IO not connected or socket is null');
      return false;
    }
    
    try {
      // Add event metadata if we have a deduplicator
      let messageData = data;
      if (this.eventDeduplicator && data.type) {
        messageData = this.eventDeduplicator.createEventMetadata(data.type, data.data || data);
      }
      
      // Send to room or broadcast
      if (this.currentRoom && this.roomManager) {
        // Use room manager to emit (excludes self)
        this.roomManager.emitToRoom(data.type || 'message', messageData);
      } else {
        // Regular emit
        if (data.type) {
          this.socket.emit(data.type, messageData);
        } else {
          this.socket.emit('message', messageData);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  /**
   * Wait for connection to be established
   */
  async waitForConnection(timeout: number = 10000): Promise<void> {
    if (this.isConnected()) {
      return Promise.resolve();
    }
    
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);
      
      const checkConnection = () => {
        // Check both socket existence and connection state
        if (this.socket && this.isConnected()) {
          clearTimeout(timeoutId);
          resolve();
        } else if (this.state === WebSocketState.FAILED) {
          clearTimeout(timeoutId);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }

  isConnected(): boolean {
    // Must have a socket instance AND be connected via SocketManager
    if (!this.socket) {
      return false;
    }
    const socketManager = getSocketManager();
    return socketManager.isConnected(this.namespace);
  }

  /**
   * Get deduplication stats
   */
  getDeduplicationStats(): any {
    return this.eventDeduplicator?.getStats() || null;
  }

  /**
   * Get room state
   */
  getRoomState(): any {
    return this.roomManager?.getRoomInfo() || null;
  }

  disconnect(): void {
    this.setState(WebSocketState.DISCONNECTED);
    
    // Leave room if in one
    if (this.currentRoom && this.roomManager) {
      this.roomManager.leaveRoom().catch(err => 
        console.warn('Error leaving room on disconnect:', err)
      );
    }
    
    // Note: We don't disconnect the socket from SocketManager
    // as it may be used by other services
    this.socket = null;
    this.roomManager = null;
    this.eventDeduplicator = null;
    
    // Clear handlers
    this.messageHandlers.clear();
    this.errorHandlers = [];
    this.stateChangeHandlers = [];
    this.sessionId = '';
    this.currentRoom = null;
  }
}

// Export factory function for creating instances
export function createWebSocketService(config?: WebSocketConfig): WebSocketService {
  return new WebSocketService(config);
}

// Export singleton instances for backward compatibility
// These now all use the same underlying socket connection via SocketManager
export const knowledgeSocketIO = new WebSocketService();
export const taskUpdateSocketIO = new WebSocketService();
export const projectListSocketIO = new WebSocketService();