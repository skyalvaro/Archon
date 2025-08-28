/**
 * RoomManager - Manages Socket.IO room membership with state machine pattern
 * 
 * Features:
 * - State machine for room transitions
 * - Automatic cleanup of previous rooms
 * - Room event tracking
 * - Pending acknowledgments management
 * - Room history for debugging
 */

import { Socket } from 'socket.io-client';
import { EventDeduplicator } from './EventDeduplicator';

export enum RoomState {
  IDLE = 'IDLE',
  JOINING = 'JOINING',
  JOINED = 'JOINED',
  LEAVING = 'LEAVING',
  SWITCHING = 'SWITCHING'
}

export interface RoomInfo {
  roomId: string;
  joinedAt: number;
  lastEventId: string | null;
  pendingAcks: Set<string>;
  state: RoomState;
}

export interface RoomTransition {
  from: string | null;
  to: string | null;
  timestamp: number;
  reason: string;
}

type RoomEventCallback = (roomId: string, event: any) => void;
type RoomStateCallback = (state: RoomState, roomId: string | null) => void;

export class RoomManager {
  private socket: Socket | null = null;
  private currentRoom: RoomInfo | null = null;
  private roomHistory: RoomTransition[] = [];
  private eventDeduplicator: EventDeduplicator;
  
  // Callbacks
  private roomEventCallbacks = new Map<string, RoomEventCallback[]>();
  private stateChangeCallbacks: RoomStateCallback[] = [];
  
  // State management
  private state: RoomState = RoomState.IDLE;
  private transitionPromise: Promise<void> | null = null;
  
  // Configuration
  private readonly maxHistorySize = 50;
  private readonly joinTimeout = 5000;
  private readonly leaveTimeout = 3000;

  constructor(eventDeduplicator?: EventDeduplicator) {
    this.eventDeduplicator = eventDeduplicator || new EventDeduplicator();
  }

  /**
   * Initialize with a socket instance
   */
  initialize(socket: Socket): void {
    if (this.socket) {
      this.cleanup();
    }
    
    this.socket = socket;
    this.setupSocketListeners();
  }

  /**
   * Get current room state
   */
  getState(): RoomState {
    return this.state;
  }

  /**
   * Get current room ID
   */
  getCurrentRoom(): string | null {
    return this.currentRoom?.roomId || null;
  }

  /**
   * Get room information
   */
  getRoomInfo(): RoomInfo | null {
    return this.currentRoom ? { ...this.currentRoom } : null;
  }

  /**
   * Join a room with state machine validation
   */
  async joinRoom(roomId: string): Promise<void> {
    // Validate state transition
    if (!this.canTransition(RoomState.JOINING)) {
      if (this.currentRoom?.roomId === roomId && this.state === RoomState.JOINED) {
        console.log(`[RoomManager] Already in room: ${roomId}`);
        return;
      }
      
      // If we're in another room, switch instead
      if (this.state === RoomState.JOINED && this.currentRoom?.roomId !== roomId) {
        return this.switchRoom(roomId);
      }
      
      throw new Error(`Cannot join room in state: ${this.state}`);
    }

    // Wait for any ongoing transition
    if (this.transitionPromise) {
      await this.transitionPromise;
    }

    this.transitionPromise = this.performJoin(roomId);
    
    try {
      await this.transitionPromise;
    } finally {
      this.transitionPromise = null;
    }
  }

  /**
   * Leave current room
   */
  async leaveRoom(): Promise<void> {
    if (!this.currentRoom) {
      console.log('[RoomManager] No room to leave');
      return;
    }

    // Validate state transition
    if (!this.canTransition(RoomState.LEAVING)) {
      throw new Error(`Cannot leave room in state: ${this.state}`);
    }

    // Wait for any ongoing transition
    if (this.transitionPromise) {
      await this.transitionPromise;
    }

    this.transitionPromise = this.performLeave();
    
    try {
      await this.transitionPromise;
    } finally {
      this.transitionPromise = null;
    }
  }

  /**
   * Switch to a different room (leave current, join new)
   */
  async switchRoom(newRoomId: string): Promise<void> {
    if (this.currentRoom?.roomId === newRoomId) {
      console.log(`[RoomManager] Already in room: ${newRoomId}`);
      return;
    }

    // Validate state transition
    if (this.state !== RoomState.JOINED && this.state !== RoomState.IDLE) {
      throw new Error(`Cannot switch rooms in state: ${this.state}`);
    }

    // Wait for any ongoing transition
    if (this.transitionPromise) {
      await this.transitionPromise;
    }

    this.transitionPromise = this.performSwitch(newRoomId);
    
    try {
      await this.transitionPromise;
    } finally {
      this.transitionPromise = null;
    }
  }

  /**
   * Add event listener for room events
   */
  onRoomEvent(eventType: string, callback: RoomEventCallback): () => void {
    const callbacks = this.roomEventCallbacks.get(eventType) || [];
    callbacks.push(callback);
    this.roomEventCallbacks.set(eventType, callbacks);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.roomEventCallbacks.get(eventType) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Add state change listener
   */
  onStateChange(callback: RoomStateCallback): () => void {
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
   * Emit an event to the current room (server will broadcast to others)
   */
  emitToRoom(eventType: string, data: any): void {
    if (!this.socket || !this.currentRoom) {
      console.warn('[RoomManager] Cannot emit: no socket or room');
      return;
    }

    const eventData = this.eventDeduplicator.createEventMetadata(eventType, data);
    
    // Extract project ID from room ID (remove "project:" prefix)
    const projectId = this.currentRoom.roomId.startsWith('project:') 
      ? this.currentRoom.roomId.substring(8) 
      : this.currentRoom.roomId;
    
    // Add project_id to the event data for server-side room broadcasting
    const roomEvent = {
      ...eventData,
      project_id: projectId
    };
    
    // Emit event to server, which will broadcast to the room
    this.socket.emit(eventType, roomEvent);
    
    // Track the event
    if (eventData._meta) {
      this.currentRoom.lastEventId = eventData._meta.id;
    }
  }

  /**
   * Get room transition history
   */
  getHistory(): RoomTransition[] {
    return [...this.roomHistory];
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.currentRoom) {
      await this.leaveRoom();
    }
    
    this.socket = null;
    this.roomEventCallbacks.clear();
    this.stateChangeCallbacks = [];
    this.roomHistory = [];
    this.state = RoomState.IDLE;
  }

  // Private methods

  private async performJoin(roomId: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }

    this.setState(RoomState.JOINING);
    
    const roomInfo: RoomInfo = {
      roomId,
      joinedAt: Date.now(),
      lastEventId: null,
      pendingAcks: new Set(),
      state: RoomState.JOINING
    };

    try {
      // Strip project: prefix if present for server compatibility
      const serverRoomId = roomId.startsWith('project:') ? roomId.substring(8) : roomId;
      
      // Use join_project event for server compatibility
      await this.emitWithTimeout('join_project', { project_id: serverRoomId }, this.joinTimeout);
      
      // Update state
      roomInfo.state = RoomState.JOINED;
      this.currentRoom = roomInfo;
      this.setState(RoomState.JOINED);
      
      // Record transition
      this.recordTransition(null, roomId, 'join');
      
      console.log(`[RoomManager] Joined room: ${roomId}`);
      
    } catch (error) {
      // Reset state to IDLE on timeout to allow retry
      this.setState(RoomState.IDLE);
      this.currentRoom = null;
      console.error(`[RoomManager] Failed to join room ${roomId}:`, error);
      throw new Error(`Failed to join room ${roomId}: ${error}`);
    }
  }

  private async performLeave(): Promise<void> {
    if (!this.socket || !this.currentRoom) {
      return;
    }

    const roomId = this.currentRoom.roomId;
    this.setState(RoomState.LEAVING);

    try {
      // Strip project: prefix if present for server compatibility
      const serverRoomId = roomId.startsWith('project:') ? roomId.substring(8) : roomId;
      
      // Use leave_project event for server compatibility
      await this.emitWithTimeout('leave_project', { project_id: serverRoomId }, this.leaveTimeout);
      
      // Update state
      this.currentRoom = null;
      this.setState(RoomState.IDLE);
      
      // Record transition
      this.recordTransition(roomId, null, 'leave');
      
      console.log(`[RoomManager] Left room: ${roomId}`);
      
    } catch (error) {
      // Even if leave fails, clear local state
      this.currentRoom = null;
      this.setState(RoomState.IDLE);
      console.warn(`[RoomManager] Failed to leave room ${roomId}:`, error);
    }
  }

  private async performSwitch(newRoomId: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }

    const oldRoomId = this.currentRoom?.roomId || null;
    this.setState(RoomState.SWITCHING);

    try {
      // Leave old room if exists
      if (oldRoomId) {
        const serverOldRoomId = oldRoomId.startsWith('project:') ? oldRoomId.substring(8) : oldRoomId;
        await this.emitWithTimeout('leave_project', { project_id: serverOldRoomId }, this.leaveTimeout);
      }
      
      // Join new room
      const serverNewRoomId = newRoomId.startsWith('project:') ? newRoomId.substring(8) : newRoomId;
      await this.emitWithTimeout('join_project', { project_id: serverNewRoomId }, this.joinTimeout);
      
      // Update state
      this.currentRoom = {
        roomId: newRoomId,
        joinedAt: Date.now(),
        lastEventId: null,
        pendingAcks: new Set(),
        state: RoomState.JOINED
      };
      
      this.setState(RoomState.JOINED);
      
      // Record transition
      this.recordTransition(oldRoomId, newRoomId, 'switch');
      
      console.log(`[RoomManager] Switched from ${oldRoomId} to ${newRoomId}`);
      
    } catch (error) {
      // Reset state on failure to allow retry
      this.setState(RoomState.IDLE);
      this.currentRoom = null;
      console.error(`[RoomManager] Failed to switch to room ${newRoomId}:`, error);
      throw new Error(`Failed to switch to room ${newRoomId}: ${error}`);
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Listen for room-specific events
    this.socket.onAny((eventType: string, ...args: any[]) => {
      // Only process events when we're in a room
      if (this.state !== RoomState.JOINED || !this.currentRoom) {
        return;
      }

      // Check if this is a room event
      const event = args[0];
      if (event && this.eventDeduplicator.shouldProcessEvent(event)) {
        // Notify callbacks
        const callbacks = this.roomEventCallbacks.get(eventType) || [];
        callbacks.forEach(cb => cb(this.currentRoom!.roomId, event));
        
        // Update last event ID
        const metadata = this.eventDeduplicator.extractMetadata(event);
        if (metadata) {
          this.currentRoom.lastEventId = metadata.id;
        }
      }
    });
  }

  private setState(newState: RoomState): void {
    if (this.state !== newState) {
      console.log(`[RoomManager] State transition: ${this.state} -> ${newState}`);
      this.state = newState;
      
      // Notify listeners
      this.stateChangeCallbacks.forEach(cb => 
        cb(newState, this.currentRoom?.roomId || null)
      );
    }
  }

  private canTransition(targetState: RoomState): boolean {
    const transitions: Record<RoomState, RoomState[]> = {
      [RoomState.IDLE]: [RoomState.JOINING],
      [RoomState.JOINING]: [RoomState.JOINED, RoomState.IDLE],
      [RoomState.JOINED]: [RoomState.LEAVING, RoomState.SWITCHING],
      [RoomState.LEAVING]: [RoomState.IDLE],
      [RoomState.SWITCHING]: [RoomState.JOINED, RoomState.IDLE]
    };

    return transitions[this.state]?.includes(targetState) || false;
  }

  private recordTransition(from: string | null, to: string | null, reason: string): void {
    this.roomHistory.push({
      from,
      to,
      timestamp: Date.now(),
      reason
    });

    // Limit history size
    if (this.roomHistory.length > this.maxHistorySize) {
      this.roomHistory.shift();
    }
  }

  private emitWithTimeout(event: string, data: any, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event} acknowledgment`));
      }, timeout);

      this.socket.emit(event, data, () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

// Export a default instance
export const defaultRoomManager = new RoomManager();