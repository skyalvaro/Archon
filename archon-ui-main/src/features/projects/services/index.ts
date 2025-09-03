/**
 * Project Services
 * 
 * All API communication and business logic for the projects feature.
 * Replaces the monolithic src/services/projectService.ts with focused services.
 */

// Export project-specific services
export { projectService } from './projectService';

// Re-export other services for convenience
export { taskService } from '../tasks/services/taskService';
export { documentService } from '../documents/services/documentService';

// Export shared utilities
export * from '../shared/api';