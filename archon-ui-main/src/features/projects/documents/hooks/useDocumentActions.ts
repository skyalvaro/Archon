import { useCallback, useState } from "react";
import { useDeleteDocument } from "../../../../hooks/useProjectQueries";
import { useToast } from "../../../../contexts/ToastContext";
import type { ProjectDocument } from "../types";
import type { UseDocumentActionsReturn } from "../types";

export const useDocumentActions = (projectId: string): UseDocumentActionsReturn => {
  const { showToast } = useToast();
  const deleteDocumentMutation = useDeleteDocument(projectId);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ProjectDocument | null>(null);

  // Initiate delete flow
  const initiateDelete = useCallback((document: ProjectDocument) => {
    setDocumentToDelete(document);
    setShowDeleteConfirm(true);
  }, []);

  // Confirm and execute deletion
  const confirmDelete = useCallback(() => {
    if (!documentToDelete) return;

    deleteDocumentMutation.mutate(documentToDelete.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        setDocumentToDelete(null);
      },
      onError: (error) => {
        console.error("Failed to delete document:", error);
      },
    });
  }, [documentToDelete, deleteDocumentMutation]);

  // Cancel deletion
  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setDocumentToDelete(null);
  }, []);

  // Copy document ID to clipboard
  const copyDocumentId = useCallback((documentId: string) => {
    navigator.clipboard.writeText(documentId).then(() => {
      showToast('Document ID copied to clipboard', 'success');
    }).catch((error) => {
      console.error('Failed to copy to clipboard:', error);
      showToast('Failed to copy ID', 'error');
    });
  }, [showToast]);

  return {
    // Delete operations
    showDeleteConfirm,
    documentToDelete,
    initiateDelete,
    confirmDelete,
    cancelDelete,
    isDeleting: deleteDocumentMutation.isPending,
    
    // Clipboard operations
    copyDocumentId,
  };
};