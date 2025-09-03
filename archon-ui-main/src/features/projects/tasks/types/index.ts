/**
 * Task Types
 *
 * All task-related types for the projects feature.
 */

// Core task types (vertical slice architecture)
export type { 
  Task, 
  Assignee, 
  TaskPriority,
  TaskSource,
  TaskCodeExample,
  CreateTaskRequest,
  UpdateTaskRequest,
  DatabaseTaskStatus
} from "./task";

// Hook return types
export type { UseTaskActionsReturn, UseTaskEditorReturn } from "./hooks";
