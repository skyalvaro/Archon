/**
 * Project Feature Types
 *
 * Central barrel export for all project-related types.
 * Following vertical slice architecture - types are co-located with features.
 */

// Core project types (vertical slice architecture)
export type {
  Project,
  ProjectPRD,
  ProjectDocs,
  ProjectFeatures,
  ProjectData,
  ProjectCreationProgress,
  CreateProjectRequest,
  UpdateProjectRequest,
  TaskCounts,
  MCPToolResponse,
  PaginatedResponse
} from "./project";

// Task-related types from tasks feature
export type * from "../tasks/types";

// Document-related types from documents feature  
export type * from "../documents/types";
