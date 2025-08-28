/**
 * Task Socket Hook - Enhanced with useSocketRoom for echo prevention
 * 
 * This hook provides real-time task synchronization using the centralized
 * socket management system with proper room isolation and echo prevention.
 * It leverages useSocketRoom internally for proper lifecycle management.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useSocketRoom } from './useSocketRoom';
import { ConnectionState } from '../services/socket/SocketManager';

// Task event types
export interface TaskEvents {
  task_created: { task: any };
  task_updated: { task: any; changes?: any };
  task_deleted: { task_id: string };
  task_archived: { task_id: string };
  tasks_reordered: { tasks: any[]; changes: any };
  initial_tasks: { tasks: any[] };
  join_project_success: { project_id: string };
  leave_project_success: { project_id: string };
}

export interface UseTaskSocketOptions {
  projectId: string;
  onTaskCreated?: (task: any) => void;
  onTaskUpdated?: (data: { task: any; changes?: any }) => void;
  onTaskDeleted?: (data: { task_id: string }) => void;
  onTaskArchived?: (data: { task_id: string }) => void;
  onTasksReordered?: (data: { tasks: any[]; changes: any }) => void;
  onInitialTasks?: (data: { tasks: any[] }) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  debugMode?: boolean;
}

export function useTaskSocket(options: UseTaskSocketOptions) {
  const {
    projectId,
    onTaskCreated,
    onTaskUpdated,
    onTaskDeleted,
    onTaskArchived,
    onTasksReordered,
    onInitialTasks,
    onConnectionStateChange,
    debugMode = false
  } = options;

  // Use room-based socket management
  const roomId = useMemo(() => projectId ? `project:${projectId}` : null, [projectId]);
  
  const {
    isInRoom,
    roomState,
    isConnected,
    emitToRoom,
    emitWithAck,
    subscribe,
    emitOptimistic,
    getStats
  } = useSocketRoom(roomId, {
    namespace: '/',
    autoJoin: true,
    autoReconnect: true,
    debugMode
  });

  // Subscribe to task events with echo prevention
  useEffect(() => {
    if (!isInRoom) return;

    const subscriptions: (() => void)[] = [];

    // Task created
    if (onTaskCreated) {
      subscriptions.push(
        subscribe('task_created', (data: TaskEvents['task_created']) => {
          if (debugMode) console.log('[useTaskSocket] Task created:', data);
          onTaskCreated(data.task);
        })
      );
    }

    // Task updated
    if (onTaskUpdated) {
      subscriptions.push(
        subscribe('task_updated', (data: TaskEvents['task_updated']) => {
          if (debugMode) console.log('[useTaskSocket] Task updated:', data);
          onTaskUpdated(data);
        })
      );
    }

    // Task deleted
    if (onTaskDeleted) {
      subscriptions.push(
        subscribe('task_deleted', (data: TaskEvents['task_deleted']) => {
          if (debugMode) console.log('[useTaskSocket] Task deleted:', data);
          onTaskDeleted(data);
        })
      );
    }

    // Task archived
    if (onTaskArchived) {
      subscriptions.push(
        subscribe('task_archived', (data: TaskEvents['task_archived']) => {
          if (debugMode) console.log('[useTaskSocket] Task archived:', data);
          onTaskArchived(data);
        })
      );
    }

    // Tasks reordered
    if (onTasksReordered) {
      subscriptions.push(
        subscribe('tasks_reordered', (data: TaskEvents['tasks_reordered']) => {
          if (debugMode) console.log('[useTaskSocket] Tasks reordered:', data);
          onTasksReordered(data);
        })
      );
    }

    // Initial tasks
    if (onInitialTasks) {
      subscriptions.push(
        subscribe('initial_tasks', (data: TaskEvents['initial_tasks']) => {
          if (debugMode) console.log('[useTaskSocket] Initial tasks:', data);
          onInitialTasks(data);
        })
      );
    }

    // Cleanup subscriptions
    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, [
    isInRoom,
    subscribe,
    onTaskCreated,
    onTaskUpdated,
    onTaskDeleted,
    onTaskArchived,
    onTasksReordered,
    onInitialTasks,
    debugMode
  ]);

  // Track connection state changes
  useEffect(() => {
    if (onConnectionStateChange) {
      // Map room states to connection states
      const mappedState = mapRoomStateToConnectionState(roomState);
      onConnectionStateChange(mappedState);
    }
  }, [roomState, onConnectionStateChange]);

  // Task operation methods with echo prevention
  const createTask = useCallback(async (task: any) => {
    if (!isInRoom) {
      console.warn('[useTaskSocket] Cannot create task: not in room');
      return null;
    }

    try {
      const response = await emitWithAck('create_task', { task }, 5000);
      if (debugMode) console.log('[useTaskSocket] Task created with ack:', response);
      return response;
    } catch (error) {
      console.error('[useTaskSocket] Failed to create task:', error);
      throw error;
    }
  }, [isInRoom, emitWithAck, debugMode]);

  const updateTask = useCallback(async (taskId: string, updates: any) => {
    if (!isInRoom) {
      console.warn('[useTaskSocket] Cannot update task: not in room');
      return null;
    }

    try {
      const response = await emitWithAck('update_task', { task_id: taskId, updates }, 5000);
      if (debugMode) console.log('[useTaskSocket] Task updated with ack:', response);
      return response;
    } catch (error) {
      console.error('[useTaskSocket] Failed to update task:', error);
      throw error;
    }
  }, [isInRoom, emitWithAck, debugMode]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!isInRoom) {
      console.warn('[useTaskSocket] Cannot delete task: not in room');
      return null;
    }

    try {
      const response = await emitWithAck('delete_task', { task_id: taskId }, 5000);
      if (debugMode) console.log('[useTaskSocket] Task deleted with ack:', response);
      return response;
    } catch (error) {
      console.error('[useTaskSocket] Failed to delete task:', error);
      throw error;
    }
  }, [isInRoom, emitWithAck, debugMode]);

  const reorderTasks = useCallback(async (taskOrders: Array<{ id: string; order: number }>) => {
    if (!isInRoom) {
      console.warn('[useTaskSocket] Cannot reorder tasks: not in room');
      return null;
    }

    try {
      const response = await emitWithAck('reorder_tasks', { task_orders: taskOrders }, 5000);
      if (debugMode) console.log('[useTaskSocket] Tasks reordered with ack:', response);
      return response;
    } catch (error) {
      console.error('[useTaskSocket] Failed to reorder tasks:', error);
      throw error;
    }
  }, [isInRoom, emitWithAck, debugMode]);

  // Optimistic task update
  const updateTaskOptimistic = useCallback(<T>(
    taskId: string,
    updates: any,
    optimisticUpdate: () => T,
    rollback: (prev: T) => void
  ) => {
    emitOptimistic(
      'update_task',
      { task_id: taskId, updates },
      optimisticUpdate,
      rollback
    );
  }, [emitOptimistic]);

  // Return enhanced API
  return {
    // Connection state
    isConnected,
    isInRoom,
    roomState,
    
    // Task operations (with echo prevention built-in)
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    updateTaskOptimistic,
    
    // Direct room emit for custom events
    emitToRoom,
    
    // Stats for debugging
    getStats,
    
    // Current project
    getCurrentProjectId: () => projectId
  };
}

// Helper to map room states to connection states
function mapRoomStateToConnectionState(roomState: any): ConnectionState {
  switch (roomState) {
    case 'IDLE':
      return ConnectionState.DISCONNECTED;
    case 'JOINING':
      return ConnectionState.CONNECTING;
    case 'JOINED':
      return ConnectionState.CONNECTED;
    case 'LEAVING':
      return ConnectionState.DISCONNECTED;
    case 'SWITCHING':
      return ConnectionState.RECONNECTING;
    default:
      return ConnectionState.DISCONNECTED;
  }
}