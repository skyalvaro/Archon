/**
 * Project Services
 * 
 * All API communication and business logic for the projects feature.
 * Will replace/consolidate:
 * - src/services/projectService.ts (614 lines -> split into focused services)
 * 
 * Services:
 * - projectService: Project CRUD operations
 * - taskService: Task management operations  
 * - documentService: Document operations
 * - versionService: Document versioning
 */

// Services will be exported here as they're migrated