/**
 * Document Types
 *
 * New types are created in their respective files and exported here.
 * All document-related types for the projects feature.
 */

// Document types
export type {
  DocumentCardProps,
  DocumentCreateTriggerProps,
  DocumentType,
  ProjectDocument,
} from "./document";

// Hook return types
export type {
  UseDocumentActionsReturn,
  UseDocumentEditorReturn,
} from "./hooks";

// Version types
export type {
  RestoreVersionResponse,
  Version,
  VersionContentResponse,
  VersionResponse,
} from "./version";
