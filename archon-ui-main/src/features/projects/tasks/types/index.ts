/**
 * Task Types
 *
 * All task-related types for the projects feature.
 */

// Re-export core task types from project types
export type { 
  Task, 
  Assignee, 
  TaskPriority,
  CreateTaskRequest,
  UpdateTaskRequest,
  DatabaseTaskStatus
} from "../../../../types/project";

// Hook return types
export type { UseTaskActionsReturn, UseTaskEditorReturn } from "./hooks";
