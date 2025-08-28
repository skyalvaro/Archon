/**
 * SocketManager - Singleton manager for Socket.IO connections
 * 
 * Features:
 * - Singleton pattern for single connection per namespace
 * - Connection state recovery (Socket.IO v4.6+)
 * - Namespace support for isolation
 * - Automatic reconnection with exponential backoff
 * - Connection health monitoring
 * - Event subscription management
 */

import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { EventDeduplicator } from './EventDeduplicator';
import { RoomManager } from './RoomManager';

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

export interface SocketConfig extends Partial<ManagerOptions & SocketOptions> {
  enableStateRecovery?: boolean;
  maxDisconnectionDuration?: number;
  skipMiddlewares?: boolean;
}

export interface NamespaceInfo {
  socket: Socket;
  roomManager: RoomManager;
  eventDeduplicator: EventDeduplicator;
  state: ConnectionState;
  connectedAt?: number;
  reconnectCount: number;
}

type ConnectionStateCallback = (state: ConnectionState, namespace: string) => void;
type RecoveryCallback = (recovered: boolean, namespace: string) => void;

export class SocketManager {
  private static instance: SocketManager;
  private namespaces: Map<string, NamespaceInfo> = new Map();
  private defaultConfig: SocketConfig;
  
  // Callbacks
  private stateChangeCallbacks: ConnectionStateCallback[] = [];
  private recoveryCallbacks: RecoveryCallback[] = [];
  
  // Health monitoring
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly healthCheckPeriod = 30000; // 30 seconds

  private constructor() {
    // Default configuration with connection state recovery
    this.defaultConfig = {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
      autoConnect: true,
      
      // Connection state recovery (Socket.IO v4.6+)
      enableStateRecovery: true,
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
      
      // Transport options
      transports: ['websocket', 'polling'],
      upgrade: true,
      
      // Path configuration for proxy
      path: '/socket.io/'
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SocketManager {
    if (!this.instance) {
      this.instance = new SocketManager();
    }
    return this.instance;
  }

  /**
   * Get or create a socket for a namespace
   */
  getSocket(namespace = '/', config?: SocketConfig): Socket {
    // Check if we already have this namespace
    const existing = this.namespaces.get(namespace);
    if (existing) {
      console.log(`[SocketManager] Returning existing socket for namespace: ${namespace}`);
      return existing.socket;
    }

    // Create new socket for namespace
    console.log(`[SocketManager] Creating new socket for namespace: ${namespace}`);
    const socket = this.createSocket(namespace, config);
    
    // Create associated managers
    const eventDeduplicator = new EventDeduplicator();
    const roomManager = new RoomManager(eventDeduplicator);
    roomManager.initialize(socket);
    
    // Store namespace info
    const info: NamespaceInfo = {
      socket,
      roomManager,
      eventDeduplicator,
      state: ConnectionState.DISCONNECTED,
      reconnectCount: 0
    };
    
    this.namespaces.set(namespace, info);
    
    // Setup listeners
    this.setupSocketListeners(socket, namespace);
    
    return socket;
  }

  /**
   * Get room manager for a namespace
   */
  getRoomManager(namespace = '/'): RoomManager | null {
    const info = this.namespaces.get(namespace);
    return info?.roomManager || null;
  }

  /**
   * Get event deduplicator for a namespace
   */
  getEventDeduplicator(namespace = '/'): EventDeduplicator | null {
    const info = this.namespaces.get(namespace);
    return info?.eventDeduplicator || null;
  }

  /**
   * Ensure a socket is connected
   */
  async ensureConnected(namespace = '/'): Promise<Socket> {
    const socket = this.getSocket(namespace);
    
    if (socket.connected) {
      return socket;
    }

    // Wait for connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for namespace: ${namespace}`));
      }, 30000);

      const handleConnect = () => {
        clearTimeout(timeout);
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleError);
        resolve(socket);
      };

      const handleError = (error: Error) => {
        clearTimeout(timeout);
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleError);
        reject(error);
      };

      socket.once('connect', handleConnect);
      socket.once('connect_error', handleError);
      
      // Trigger connection if not connecting
      if (!socket.connected && !(socket as any).connecting) {
        socket.connect();
      }
    });
  }

  /**
   * Get connection state for a namespace
   */
  getConnectionState(namespace = '/'): ConnectionState {
    const info = this.namespaces.get(namespace);
    return info?.state || ConnectionState.DISCONNECTED;
  }

  /**
   * Check if a namespace is connected
   */
  isConnected(namespace = '/'): boolean {
    const info = this.namespaces.get(namespace);
    return info?.socket.connected || false;
  }

  /**
   * Manually reconnect a namespace
   */
  reconnect(namespace = '/'): void {
    const info = this.namespaces.get(namespace);
    if (info && !info.socket.connected) {
      console.log(`[SocketManager] Manually reconnecting namespace: ${namespace}`);
      info.socket.connect();
    }
  }

  /**
   * Disconnect a namespace
   */
  disconnect(namespace = '/'): void {
    const info = this.namespaces.get(namespace);
    if (info) {
      console.log(`[SocketManager] Disconnecting namespace: ${namespace}`);
      info.socket.disconnect();
      info.roomManager.cleanup();
    }
  }

  /**
   * Destroy a namespace completely
   */
  destroyNamespace(namespace = '/'): void {
    const info = this.namespaces.get(namespace);
    if (info) {
      console.log(`[SocketManager] Destroying namespace: ${namespace}`);
      
      // Cleanup
      info.socket.removeAllListeners();
      info.socket.disconnect();
      info.roomManager.cleanup();
      info.eventDeduplicator.destroy();
      
      // Remove from map
      this.namespaces.delete(namespace);
    }
  }

  /**
   * Add connection state change listener
   */
  onStateChange(callback: ConnectionStateCallback): () => void {
    this.stateChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Add recovery listener
   */
  onRecovery(callback: RecoveryCallback): () => void {
    this.recoveryCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.recoveryCallbacks.indexOf(callback);
      if (index > -1) {
        this.recoveryCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get statistics for all namespaces
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    this.namespaces.forEach((info, namespace) => {
      stats[namespace] = {
        connected: info.socket.connected,
        state: info.state,
        connectedAt: info.connectedAt,
        reconnectCount: info.reconnectCount,
        currentRoom: info.roomManager.getCurrentRoom(),
        dedupStats: info.eventDeduplicator.getStats()
      };
    });
    
    return stats;
  }

  /**
   * Cleanup all connections
   */
  destroy(): void {
    console.log('[SocketManager] Destroying all connections');
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Destroy all namespaces
    this.namespaces.forEach((_, namespace) => {
      this.destroyNamespace(namespace);
    });
    
    // Clear callbacks
    this.stateChangeCallbacks = [];
    this.recoveryCallbacks = [];
  }

  // Private methods

  private createSocket(namespace: string, config?: SocketConfig): Socket {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Build connection URL
    const url = this.buildConnectionUrl(namespace);
    
    // Handle connection state recovery
    const socketConfig: any = { ...finalConfig };
    if (finalConfig.enableStateRecovery) {
      socketConfig.connectionStateRecovery = {
        maxDisconnectionDuration: finalConfig.maxDisconnectionDuration,
        skipMiddlewares: finalConfig.skipMiddlewares
      };
    }
    
    // Remove custom config fields
    delete socketConfig.enableStateRecovery;
    delete socketConfig.maxDisconnectionDuration;
    delete socketConfig.skipMiddlewares;
    
    // Create socket
    const socket = io(url, socketConfig);
    
    console.log(`[SocketManager] Created socket for ${namespace} with config:`, socketConfig);
    
    return socket;
  }

  private buildConnectionUrl(namespace: string): string {
    // Use relative URL to work with proxy
    const baseUrl = window.location.origin;
    
    // Handle namespace in URL
    if (namespace === '/') {
      return baseUrl;
    }
    
    // For named namespaces, append to URL
    return `${baseUrl}${namespace}`;
  }

  private setupSocketListeners(socket: Socket, namespace: string): void {
    const info = this.namespaces.get(namespace);
    if (!info) return;

    // Connection events
    socket.on('connect', () => {
      console.log(`[SocketManager] Connected to namespace: ${namespace}`);
      info.state = ConnectionState.CONNECTED;
      info.connectedAt = Date.now();
      
      // Check if this was a recovery
      const recovered = (socket as any).recovered || false;
      if (recovered) {
        console.log(`[SocketManager] Connection recovered for ${namespace}`);
        this.recoveryCallbacks.forEach(cb => cb(true, namespace));
      } else {
        console.log(`[SocketManager] Fresh connection for ${namespace}`);
        this.recoveryCallbacks.forEach(cb => cb(false, namespace));
      }
      
      this.notifyStateChange(ConnectionState.CONNECTED, namespace);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[SocketManager] Disconnected from namespace ${namespace}: ${reason}`);
      info.state = ConnectionState.DISCONNECTED;
      info.connectedAt = undefined;
      
      this.notifyStateChange(ConnectionState.DISCONNECTED, namespace);
    });

    socket.on('connect_error', (error) => {
      console.error(`[SocketManager] Connection error for namespace ${namespace}:`, error.message);
      info.state = ConnectionState.ERROR;
      
      this.notifyStateChange(ConnectionState.ERROR, namespace);
    });

    // Reconnection events
    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[SocketManager] Reconnection attempt ${attempt} for namespace: ${namespace}`);
      info.state = ConnectionState.RECONNECTING;
      info.reconnectCount = attempt;
      
      this.notifyStateChange(ConnectionState.RECONNECTING, namespace);
    });

    socket.io.on('reconnect', (attempt) => {
      console.log(`[SocketManager] Reconnected to namespace ${namespace} after ${attempt} attempts`);
      info.state = ConnectionState.CONNECTED;
      info.connectedAt = Date.now();
      info.reconnectCount = 0;
      
      this.notifyStateChange(ConnectionState.CONNECTED, namespace);
    });

    socket.io.on('reconnect_failed', () => {
      console.error(`[SocketManager] Reconnection failed for namespace: ${namespace}`);
      info.state = ConnectionState.ERROR;
      
      this.notifyStateChange(ConnectionState.ERROR, namespace);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`[SocketManager] Socket error for namespace ${namespace}:`, error);
      info.state = ConnectionState.ERROR;
      
      this.notifyStateChange(ConnectionState.ERROR, namespace);
    });
  }

  private notifyStateChange(state: ConnectionState, namespace: string): void {
    this.stateChangeCallbacks.forEach(cb => cb(state, namespace));
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.namespaces.forEach((info, namespace) => {
        const isConnected = info.socket.connected;
        const expectedState = isConnected ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED;
        
        if (info.state !== expectedState) {
          console.warn(`[SocketManager] State mismatch for ${namespace}: ${info.state} vs ${expectedState}`);
          info.state = expectedState;
          this.notifyStateChange(expectedState, namespace);
        }
        
        // Log health status
        if (!isConnected && info.state !== ConnectionState.RECONNECTING && info.state !== ConnectionState.CONNECTING) {
          console.log(`[SocketManager] Namespace ${namespace} is disconnected`);
        }
      });
    }, this.healthCheckPeriod);
  }
}

// Export singleton instance getter
export const getSocketManager = () => SocketManager.getInstance();