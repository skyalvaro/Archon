import { useCallback, useState } from "react";
import {
  useUpdateTask,
  useDeleteTask,
} from "../../../../hooks/useProjectQueries";
import { useToast } from "../../../../contexts/ToastContext";
import type { Task } from "../../../../types/project";
import type { UseTaskActionsReturn } from "../types";

export const useTaskActions = (projectId: string): UseTaskActionsReturn => {
  const { showToast } = useToast();
  const updateTaskMutation = useUpdateTask(projectId);
  const deleteTaskMutation = useDeleteTask(projectId);

  // Delete confirmation state - store full task object for proper modal display
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Assignee change handler
  const changeAssignee = useCallback(
    (taskId: string, newAssignee: string) => {
      updateTaskMutation.mutate({
        taskId,
        updates: { assignee: newAssignee },
      });
    },
    [updateTaskMutation],
  );

  // Delete task handler with confirmation flow - now accepts full task object
  const initiateDelete = useCallback((task: Task) => {
    setTaskToDelete(task);
    setShowDeleteConfirm(true);
  }, []);

  // Confirm and execute deletion
  const confirmDelete = useCallback(() => {
    if (!taskToDelete) return;

    deleteTaskMutation.mutate(taskToDelete.id, {
      onSuccess: () => {
        showToast(
          `Task "${taskToDelete.title}" deleted successfully`,
          "success",
        );
        setShowDeleteConfirm(false);
        setTaskToDelete(null);
      },
      onError: (error) => {
        console.error("Failed to delete task:", error);
        showToast(`Failed to delete task "${taskToDelete.title}"`, "error");
        // Modal stays open on error so user can retry
      },
    });
  }, [deleteTaskMutation, taskToDelete, showToast]);

  // Cancel deletion
  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setTaskToDelete(null);
  }, []);

  return {
    // Actions
    changeAssignee,
    initiateDelete,
    confirmDelete,
    cancelDelete,

    // State
    showDeleteConfirm,
    taskToDelete,

    // Loading states
    isUpdating: updateTaskMutation.isPending,
    isDeleting: deleteTaskMutation.isPending,
  };
};
