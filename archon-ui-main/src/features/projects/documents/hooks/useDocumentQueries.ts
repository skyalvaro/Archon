import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services';
import { useToast } from '../../../../contexts/ToastContext';
import type { ProjectDocument } from '../types';

// Query keys
const documentKeys = {
  all: (projectId: string) => ['projects', projectId, 'documents'] as const,
  detail: (projectId: string, docId: string) => ['projects', projectId, 'documents', docId] as const,
};

/**
 * Get documents from project's docs JSONB field
 */
export function useProjectDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: documentKeys.all(projectId!),
    queryFn: async () => {
      if (!projectId) return [];
      const project = await projectService.getProject(projectId);
      return (project.docs || []) as ProjectDocument[];
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new document in the project's docs array
 */
export function useCreateDocument(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (newDoc: ProjectDocument) => {
      // Get current project
      const project = await projectService.getProject(projectId);
      const currentDocs = (project.docs || []) as ProjectDocument[];
      
      // Add new document to array
      const updatedDocs = [...currentDocs, newDoc];
      
      // Update project with new docs array
      const updatedProject = await projectService.updateProject(projectId, {
        docs: updatedDocs
      });
      
      return updatedProject.docs;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      showToast('Document created successfully', 'success');
    },
    onError: (error, variables) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to create document:', error, { variables });
      showToast(`Failed to create document: ${errorMessage}`, 'error');
    },
  });
}

/**
 * Update a document in the project's docs array
 */
export function useUpdateDocument(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (updatedDoc: ProjectDocument) => {
      // Get current project
      const project = await projectService.getProject(projectId);
      const currentDocs = (project.docs || []) as ProjectDocument[];
      
      // Update the specific document in the array
      const updatedDocs = currentDocs.map(doc => 
        doc.id === updatedDoc.id ? updatedDoc : doc
      );
      
      // Update project with modified docs array
      const updatedProject = await projectService.updateProject(projectId, {
        docs: updatedDocs
      });
      
      return updatedProject.docs;
    },
    onMutate: async (updatedDoc) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: documentKeys.all(projectId) });

      // Snapshot the previous value
      const previousDocs = queryClient.getQueryData(documentKeys.all(projectId));

      // Optimistically update to the new value
      queryClient.setQueryData(documentKeys.all(projectId), (old: ProjectDocument[] | undefined) => {
        if (!old) return [updatedDoc];
        return old.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc);
      });

      return { previousDocs };
    },
    onError: (error, updatedDoc, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to update document:', error, { updatedDoc });
      
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousDocs) {
        queryClient.setQueryData(documentKeys.all(projectId), context.previousDocs);
      }
      
      showToast(`Failed to save document: ${errorMessage}`, 'error');
    },
    onSuccess: () => {
      // Don't refetch on success - trust optimistic update
      // Only invalidate project data if document count changed (unlikely)
      showToast('Document saved successfully', 'success');
    },
  });
}

/**
 * Delete a document from the project's docs array
 */
export function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (documentId: string) => {
      // Get current project
      const project = await projectService.getProject(projectId);
      const currentDocs = (project.docs || []) as ProjectDocument[];
      
      // Remove document from array
      const updatedDocs = currentDocs.filter(doc => doc.id !== documentId);
      
      // Update project with filtered docs array
      const updatedProject = await projectService.updateProject(projectId, {
        docs: updatedDocs
      });
      
      return updatedProject.docs;
    },
    onMutate: async (documentId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: documentKeys.all(projectId) });

      // Snapshot the previous value
      const previousDocs = queryClient.getQueryData(documentKeys.all(projectId));

      // Optimistically remove the document
      queryClient.setQueryData(documentKeys.all(projectId), (old: ProjectDocument[] | undefined) => {
        if (!old) return [];
        return old.filter(doc => doc.id !== documentId);
      });

      return { previousDocs };
    },
    onError: (error, documentId, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to delete document:', error, { documentId });
      
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousDocs) {
        queryClient.setQueryData(documentKeys.all(projectId), context.previousDocs);
      }
      
      showToast(`Failed to delete document: ${errorMessage}`, 'error');
    },
    onSuccess: () => {
      // Don't refetch on success - trust optimistic update
      // Only invalidate project data since document count changed
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      showToast('Document deleted successfully', 'success');
    },
  });
}