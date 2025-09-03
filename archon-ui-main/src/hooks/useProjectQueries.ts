import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '../types/project';
import type { Task } from '../features/projects/tasks/types';
import { useToast } from '../contexts/ToastContext';

// Query keys factory for better organization
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: any) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  tasks: (projectId: string) => [...projectKeys.detail(projectId), 'tasks'] as const,
  taskCounts: () => ['taskCounts'] as const,
  features: (projectId: string) => [...projectKeys.detail(projectId), 'features'] as const,
  documents: (projectId: string) => [...projectKeys.detail(projectId), 'documents'] as const,
};

// Fetch all projects
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: () => projectService.listProjects(),
    refetchInterval: 10000, // Poll every 10 seconds
    staleTime: 3000, // Consider data stale after 3 seconds
  });
}

// Fetch tasks for a specific project
export function useProjectTasks(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectKeys.tasks(projectId!),
    queryFn: () => projectService.getTasksByProject(projectId!),
    enabled: !!projectId && enabled,
    refetchInterval: 8000, // Poll every 8 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
  });
}

// Fetch task counts for all projects
export function useTaskCounts() {
  return useQuery({
    queryKey: projectKeys.taskCounts(),
    queryFn: () => projectService.getTaskCountsForAllProjects(),
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
    onError: (error) => {
      console.error('Failed to create project:', error);
      showToast('Failed to create project', 'error');
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

// Delete project mutation
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (projectId: string) => projectService.deleteProject(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      // Also invalidate the specific project's data
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
    },
    onError: (error) => {
      console.error('Failed to delete project:', error);
      showToast('Failed to delete project', 'error');
    },
  });
}

// Create task mutation
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (taskData: any) => projectService.createTask(taskData),
    onSuccess: (data, variables) => {
      // Invalidate tasks for the project
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(variables.project_id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.taskCounts() });
      showToast('Task created successfully', 'success');
    },
    onError: (error) => {
      console.error('Failed to create task:', error);
      showToast('Failed to create task', 'error');
    },
  });
}

// Update task mutation with optimistic updates
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: any }) =>
      projectService.updateTask(taskId, updates),
    onMutate: async ({ taskId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.tasks(projectId) });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData(projectKeys.tasks(projectId));

      // Optimistically update
      queryClient.setQueryData(projectKeys.tasks(projectId), (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((task: any) =>
          task.id === taskId ? { ...task, ...updates } : task
        );
      });

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(projectKeys.tasks(projectId), context.previousTasks);
      }
      showToast('Failed to update task', 'error');
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.taskCounts() });
    },
    onSuccess: () => {
      // Don't refetch on success for task_order updates - trust optimistic update
      // Only invalidate task counts
      queryClient.invalidateQueries({ queryKey: projectKeys.taskCounts() });
    },
  });
}

// Delete task mutation
export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (taskId: string) => projectService.deleteTask(taskId),
    onMutate: async (taskId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.tasks(projectId) });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData(projectKeys.tasks(projectId));

      // Optimistically remove the task
      queryClient.setQueryData(projectKeys.tasks(projectId), (old: any[] | undefined) => {
        if (!old) return old;
        return old.filter((task: any) => task.id !== taskId);
      });

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(projectKeys.tasks(projectId), context.previousTasks);
      }
      showToast('Failed to delete task', 'error');
    },
    onSuccess: () => {
      showToast('Task deleted successfully', 'success');
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.taskCounts() });
    },
  });
}

// Document hooks moved to features/projects/documents/hooks/useDocumentQueries.ts
// Documents are stored as JSONB array in project.docs field