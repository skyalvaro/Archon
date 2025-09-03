/**
 * Hook Return Type Definitions
 *
 * Return types for document-related hooks.
 */

import type { ProjectDocument } from "./document";

export interface UseDocumentActionsReturn {
  // Delete operations
  showDeleteConfirm: boolean;
  documentToDelete: ProjectDocument | null;
  initiateDelete: (document: ProjectDocument) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  isDeleting: boolean;
  
  // Clipboard operations
  copyDocumentId: (documentId: string) => void;
}

export interface UseDocumentEditorReturn {
  // Document creation/editing
  saveDocument: (document: Partial<ProjectDocument>) => void;
  isSaving: boolean;
  
  // Document types
  availableDocumentTypes: string[];
}