import { Task } from '../types/project';

export interface TaskOrderingOptions {
  position: 'first' | 'last' | 'between';
  existingTasks: Task[];
  beforeTaskOrder?: number;
  afterTaskOrder?: number;
}

/**
 * Calculate the optimal task_order value for positioning a task
 * Uses fractional ordering system for flexibility in drag-and-drop operations
 */
export function calculateTaskOrder(options: TaskOrderingOptions): number {
  const { position, existingTasks, beforeTaskOrder, afterTaskOrder } = options;
  
  // Sort tasks by order for consistent calculations
  const sortedTasks = existingTasks.sort((a, b) => a.task_order - b.task_order);
  
  switch (position) {
    case 'first':
      if (sortedTasks.length === 0) {
        return 1024; // Seed value for first task
      }
      return sortedTasks[0].task_order / 2;
      
    case 'last':
      if (sortedTasks.length === 0) {
        return 1024; // Seed value for first task
      }
      return sortedTasks[sortedTasks.length - 1].task_order + 1024;
      
    case 'between':
      if (beforeTaskOrder !== undefined && afterTaskOrder !== undefined) {
        return (beforeTaskOrder + afterTaskOrder) / 2;
      }
      if (beforeTaskOrder !== undefined) {
        return beforeTaskOrder + 1024;
      }
      if (afterTaskOrder !== undefined) {
        return afterTaskOrder / 2;
      }
      // Fallback
      return 1024;
      
    default:
      return 1024;
  }
}

/**
 * Calculate task order for drag-and-drop reordering
 */
export function calculateReorderPosition(
  statusTasks: Task[],
  movingTaskIndex: number,
  targetIndex: number
): number {
  if (targetIndex === 0) {
    // Moving to first position
    return calculateTaskOrder({
      position: 'first',
      existingTasks: statusTasks.filter((_, i) => i !== movingTaskIndex)
    });
  }
  
  if (targetIndex === statusTasks.length - 1) {
    // Moving to last position
    return calculateTaskOrder({
      position: 'last',
      existingTasks: statusTasks.filter((_, i) => i !== movingTaskIndex)
    });
  }
  
  // Moving between two items
  let prevTask, nextTask;
  
  if (targetIndex > movingTaskIndex) {
    // Moving down
    prevTask = statusTasks[targetIndex];
    nextTask = statusTasks[targetIndex + 1];
  } else {
    // Moving up
    prevTask = statusTasks[targetIndex - 1];
    nextTask = statusTasks[targetIndex];
  }
  
  return calculateTaskOrder({
    position: 'between',
    existingTasks: statusTasks,
    beforeTaskOrder: prevTask?.task_order,
    afterTaskOrder: nextTask?.task_order
  });
}

/**
 * Get default task order for new tasks (always first position)
 */
export function getDefaultTaskOrder(existingTasks: Task[]): number {
  return calculateTaskOrder({
    position: 'first',
    existingTasks
  });
}