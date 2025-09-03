import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService, taskService } from '../services';
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '../types';
import { useToast } from '../../../contexts/ToastContext';
import { useSmartPolling } from '../../ui/hooks';

// Query keys factory for better organization
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: unknown) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  tasks: (projectId: string) => [...projectKeys.detail(projectId), 'tasks'] as const,
  taskCounts: () => ['taskCounts'] as const,
  features: (projectId: string) => [...projectKeys.detail(projectId), 'features'] as const,
  documents: (projectId: string) => [...projectKeys.detail(projectId), 'documents'] as const,
};

// Fetch all projects with smart polling
export function useProjects() {
  const { refetchInterval } = useSmartPolling(10000); // 10 second base interval
  
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: () => projectService.listProjects(),
    refetchInterval, // Smart interval based on page visibility/focus
    staleTime: 3000, // Consider data stale after 3 seconds
  });
}

// Fetch task counts for all projects
export function useTaskCounts() {
  return useQuery({
    queryKey: projectKeys.taskCounts(),
    queryFn: () => taskService.getTaskCountsForAllProjects(),
    refetchInterval: false, // Don't poll, only refetch manually
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Fetch project features
export function useProjectFeatures(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.features(projectId!),
    queryFn: () => projectService.getProjectFeatures(projectId!),
    enabled: !!projectId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Create project mutation
export function useCreateProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (projectData: CreateProjectRequest) => 
      projectService.createProject(projectData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      showToast('Project created successfully!', 'success');
    },
    onError: (error, variables) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to create project:', error, { variables });
      showToast(`Failed to create project: ${errorMessage}`, 'error');
    },
  });
}

// Update project mutation (for pinning, etc.)
export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, updates }: { projectId: string; updates: UpdateProjectRequest }) =>
      projectService.updateProject(projectId, updates),
    onMutate: async ({ projectId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });

      // Snapshot the previous value
      const previousProjects = queryClient.getQueryData(projectKeys.lists());

      // Optimistically update
      queryClient.setQueryData(projectKeys.lists(), (old: Project[] | undefined) => {
        if (!old) return old;
        
        // If pinning a project, unpin all others first
        if (updates.pinned === true) {
          return old.map(p => ({
            ...p,
            pinned: p.id === projectId ? true : false
          }));
        }
        
        return old.map(p => 
          p.id === projectId ? { ...p, ...updates } : p
        );
      });

      return { previousProjects };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.lists(), context.previousProjects);
      }
      showToast('Failed to update project', 'error');
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      
      if (variables.updates.pinned !== undefined) {
        const message = variables.updates.pinned
          ? `Pinned "${data.title}" as default project`
          : `Removed "${data.title}" from default selection`;
        showToast(message, 'info');
      }
    },
  });
}

// Delete project mutation with optimistic updates
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (projectId: string) => projectService.deleteProject(projectId),
    onMutate: async (projectId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });

      // Snapshot the previous value
      const previousProjects = queryClient.getQueryData(projectKeys.lists());

      // Optimistically remove the project
      queryClient.setQueryData(projectKeys.lists(), (old: Project[] | undefined) => {
        if (!old) return old;
        return old.filter(project => project.id !== projectId);
      });

      return { previousProjects };
    },
    onError: (error, projectId, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to delete project:', error, { projectId });
      
      // Rollback on error
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.lists(), context.previousProjects);
      }
      
      showToast(`Failed to delete project: ${errorMessage}`, 'error');
    },
    onSuccess: (_, projectId) => {
      // Don't refetch on success - trust optimistic update
      // Only remove the specific project's detail data
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      showToast('Project deleted successfully', 'success');
    },
  });
}