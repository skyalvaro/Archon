import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Table, LayoutGrid } from 'lucide-react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { debounce } from 'lodash';
import { useToast } from '../../contexts/ToastContext';
import { 
  useProjectTasks,
  useProjectFeatures,
  useCreateTask, 
  useUpdateTask, 
  useDeleteTask 
} from '../../hooks/useProjectQueries';

import type { CreateTaskRequest, UpdateTaskRequest } from '../../types/project';
import { TaskTableView, Task } from './TaskTableView';
import { TaskBoardView } from './TaskBoardView';
import { EditTaskModal } from './EditTaskModal';

export const TasksTab = ({ projectId }: { projectId: string }) => {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'table' | 'board'>('board');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState<boolean>(false);
  
  // Fetch tasks and features using TanStack Query
  const { data: tasks = [], isLoading: isLoadingTasks } = useProjectTasks(projectId);
  const { data: featuresData, isLoading: isLoadingFeatures } = useProjectFeatures(projectId);
  
  // Mutations
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask(projectId);
  const deleteTaskMutation = useDeleteTask(projectId);

  // Transform features data
  const projectFeatures = useMemo(() => {
    return featuresData?.features || [];
  }, [featuresData]);

  // Modal management functions
  const openEditModal = async (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingTask(null);
    setIsModalOpen(false);
  };

  // Get default order for new tasks in a status
  const getDefaultTaskOrder = (statusTasks: Task[], status: Task['status']) => {
    if (statusTasks.length === 0) return 100;
    const maxOrder = Math.max(...statusTasks.map(t => t.task_order));
    return maxOrder + 100;
  };

  // Calculate position between two tasks for reordering
  const calculateReorderPosition = (statusTasks: Task[], fromIndex: number, toIndex: number) => {
    // Moving to the beginning
    if (toIndex === 0) {
      return Math.max(1, Math.floor(statusTasks[0].task_order / 2));
    }
    
    // Moving to the end
    if (toIndex >= statusTasks.length) {
      return statusTasks[statusTasks.length - 1].task_order + 100;
    }
    
    // Moving between two tasks
    // When moving down (fromIndex < toIndex), insert after toIndex
    // When moving up (fromIndex > toIndex), insert before toIndex
    if (fromIndex < toIndex) {
      // Moving down - insert after toIndex
      const afterTask = statusTasks[toIndex];
      const nextTask = statusTasks[toIndex + 1];
      if (nextTask) {
        return Math.floor((afterTask.task_order + nextTask.task_order) / 2);
      } else {
        return afterTask.task_order + 100;
      }
    } else {
      // Moving up - insert before toIndex
      const beforeTask = toIndex > 0 ? statusTasks[toIndex - 1] : null;
      const targetTask = statusTasks[toIndex];
      if (beforeTask) {
        return Math.floor((beforeTask.task_order + targetTask.task_order) / 2);
      } else {
        return Math.max(1, Math.floor(targetTask.task_order / 2));
      }
    }
  };

  // Save task (create or update)
  const saveTask = async (taskData: Partial<Task>) => {
    setIsSavingTask(true);
    try {
      if (editingTask) {
        // Update existing task - build updates object with only changed values
        const updates: any = {};
        
        // Only include fields that are defined (not null or undefined)
        if (taskData.title !== undefined) updates.title = taskData.title;
        if (taskData.description !== undefined) updates.description = taskData.description;
        if (taskData.status !== undefined) updates.status = taskData.status;
        if (taskData.assignee !== undefined) updates.assignee = taskData.assignee || 'User';
        if (taskData.task_order !== undefined) updates.task_order = taskData.task_order;
        
        // Feature can be empty string but not null/undefined
        if (taskData.feature !== undefined && taskData.feature !== null) {
          updates.feature = taskData.feature || '';  // Convert empty/null to empty string
        }
        
        await updateTaskMutation.mutateAsync({
          taskId: editingTask.id,
          updates
        });
        closeModal();
      } else {
        // Create new task
        const statusTasks = tasks.filter(t => t.status === (taskData.status || 'todo'));
        const newTaskData: CreateTaskRequest = {
          project_id: projectId,
          title: taskData.title || '',
          description: taskData.description || '',
          status: taskData.status || 'todo',
          assignee: taskData.assignee || 'User',
          feature: taskData.feature || '',
          task_order: taskData.task_order || getDefaultTaskOrder(statusTasks, taskData.status || 'todo')
        };
        
        await createTaskMutation.mutateAsync(newTaskData);
        closeModal();
      }
    } catch (error) {
      console.error('Failed to save task:', error);
      showToast('Failed to save task', 'error');
    } finally {
      setIsSavingTask(false);
    }
  };

  // Task reordering - immediate update
  const handleTaskReorder = useCallback(async (taskId: string, targetIndex: number, status: Task['status']) => {
    // Get all tasks in the target status, sorted by current order
    const statusTasks = tasks
      .filter(task => task.status === status)
      .sort((a, b) => a.task_order - b.task_order);
    
    const movingTaskIndex = statusTasks.findIndex(task => task.id === taskId);
    if (movingTaskIndex === -1 || targetIndex < 0 || targetIndex >= statusTasks.length) return;
    if (movingTaskIndex === targetIndex) return;
    
    // Calculate new position
    const newPosition = calculateReorderPosition(statusTasks, movingTaskIndex, targetIndex);
    
    // Update immediately with optimistic updates
    try {
      await updateTaskMutation.mutateAsync({
        taskId,
        updates: { 
          task_order: newPosition
        }
      });
    } catch (error) {
      console.error('Failed to reorder task:', error);
      showToast('Failed to reorder task', 'error');
    }
  }, [tasks, updateTaskMutation, showToast]);

  // Move task to different status
  const moveTask = async (taskId: string, newStatus: Task['status']) => {
    const movingTask = tasks.find(task => task.id === taskId);
    if (!movingTask || movingTask.status === newStatus) return;

    try {
      // Calculate position for new status
      const tasksInNewStatus = tasks.filter(t => t.status === newStatus);
      const newOrder = getDefaultTaskOrder(tasksInNewStatus, newStatus);
      
      // Update via mutation (handles optimistic updates)
      await updateTaskMutation.mutateAsync({
        taskId,
        updates: {
          status: newStatus,
          task_order: newOrder
        }
      });
      
      showToast(`Task moved to ${newStatus}`, 'success');
    } catch (error) {
      console.error('Failed to move task:', error);
      showToast('Failed to move task', 'error');
    }
  };

  const completeTask = useCallback((taskId: string) => {
    moveTask(taskId, 'done');
  }, []);

  const deleteTask = async (task: Task) => {
    try {
      await deleteTaskMutation.mutateAsync(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      // Error handled by mutation
    }
  };

  // Get task priority selection options
  const getTasksForPrioritySelection = useCallback((status: Task['status']) => {
    const tasksInStatus = tasks
      .filter(task => task.status === status && task.id !== editingTask?.id)
      .sort((a, b) => a.task_order - b.task_order);
    
    const options: Array<{value: number, label: string}> = [];
    
    if (tasksInStatus.length === 0) {
      // No tasks in this status
      options.push({ value: 100, label: "First task in this status" });
    } else {
      // Add option to be first
      options.push({ 
        value: Math.max(1, Math.floor(tasksInStatus[0].task_order / 2)), 
        label: `Before "${tasksInStatus[0].title.substring(0, 30)}${tasksInStatus[0].title.length > 30 ? '...' : ''}"` 
      });
      
      // Add options between existing tasks
      for (let i = 0; i < tasksInStatus.length - 1; i++) {
        const currentTask = tasksInStatus[i];
        const nextTask = tasksInStatus[i + 1];
        const midPoint = Math.floor((currentTask.task_order + nextTask.task_order) / 2);
        options.push({ 
          value: midPoint, 
          label: `Between "${currentTask.title.substring(0, 20)}${currentTask.title.length > 20 ? '...' : ''}" and "${nextTask.title.substring(0, 20)}${nextTask.title.length > 20 ? '...' : ''}"` 
        });
      }
      
      // Add option to be last
      const lastTask = tasksInStatus[tasksInStatus.length - 1];
      options.push({ 
        value: lastTask.task_order + 100, 
        label: `After "${lastTask.title.substring(0, 30)}${lastTask.title.length > 30 ? '...' : ''}"` 
      });
    }
    
    return options;
  }, [tasks, editingTask?.id]);

  // Inline update for task fields
  const updateTaskInline = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Ensure task_order is an integer if present
      const processedUpdates: any = { ...updates };
      if (processedUpdates.task_order !== undefined) {
        processedUpdates.task_order = Math.round(processedUpdates.task_order);
      }
      // Assignee is already a string, no conversion needed
      
      await updateTaskMutation.mutateAsync({
        taskId,
        updates: processedUpdates
      });
    } catch (error) {
      console.error('Failed to update task:', error);
      showToast('Failed to update task', 'error');
    }
  };

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-[70vh] relative">
        {/* Main content - Table or Board view */}
        <div className="relative h-[calc(100vh-220px)] overflow-auto">
          {viewMode === 'table' ? (
            <TaskTableView
              tasks={tasks}
              onTaskView={openEditModal}
              onTaskComplete={completeTask}
              onTaskDelete={deleteTask}
              onTaskReorder={handleTaskReorder}
              onTaskCreate={async (task) => {
                await createTaskMutation.mutateAsync({
                  ...task,
                  project_id: projectId,
                  assignee: task.assignee || 'User',  // Already a string
                  task_order: Math.round(task.task_order)  // Ensure integer
                });
              }}
              onTaskUpdate={updateTaskInline}
            />
          ) : (
            <TaskBoardView
              tasks={tasks}
              onTaskView={openEditModal}
              onTaskMove={moveTask}
              onTaskComplete={completeTask}
              onTaskDelete={deleteTask}
              onTaskReorder={handleTaskReorder}
            />
          )}
        </div>

        {/* Fixed View Controls */}
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="flex items-center gap-4">
            
            {/* Add Task Button with Luminous Style */}
            <button 
              onClick={() => {
                const statusTasks = tasks.filter(t => t.status === 'todo');
                const defaultOrder = getDefaultTaskOrder(statusTasks, 'todo');
                setEditingTask(null);
                setIsModalOpen(true);
              }}
              className="relative px-5 py-2.5 flex items-center gap-2 bg-white/80 dark:bg-black/90 border border-gray-200 dark:border-gray-800 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md pointer-events-auto text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>Add Task</span>
              <span className="absolute bottom-0 left-[0%] right-[0%] w-[95%] mx-auto h-[2px] bg-cyan-500 shadow-[0_0_10px_2px_rgba(34,211,238,0.4)] dark:shadow-[0_0_20px_5px_rgba(34,211,238,0.7)]"></span>
            </button>
          
            {/* View Toggle Controls */}
            <div className="flex items-center bg-white/80 dark:bg-black/90 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md pointer-events-auto">
              <button 
                onClick={() => setViewMode('table')} 
                className={`px-5 py-2.5 flex items-center gap-2 relative transition-all duration-300 ${viewMode === 'table' ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}
              >
                <Table className="w-4 h-4" />
                <span>Table</span>
                {viewMode === 'table' && <span className="absolute bottom-0 left-[15%] right-[15%] w-[70%] mx-auto h-[2px] bg-cyan-500 shadow-[0_0_10px_2px_rgba(34,211,238,0.4)] dark:shadow-[0_0_20px_5px_rgba(34,211,238,0.7)]"></span>}
              </button>
              <button 
                onClick={() => setViewMode('board')} 
                className={`px-5 py-2.5 flex items-center gap-2 relative transition-all duration-300 ${viewMode === 'board' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Board</span>
                {viewMode === 'board' && <span className="absolute bottom-0 left-[15%] right-[15%] w-[70%] mx-auto h-[2px] bg-purple-500 shadow-[0_0_10px_2px_rgba(168,85,247,0.4)] dark:shadow-[0_0_20px_5px_rgba(168,85,247,0.7)]"></span>}
              </button>
            </div>
          </div>
        </div>

        {/* Edit/Create Task Modal */}
        <EditTaskModal
          isModalOpen={isModalOpen}
          editingTask={editingTask}
          projectFeatures={projectFeatures}
          isLoadingFeatures={isLoadingFeatures}
          isSavingTask={isSavingTask}
          onClose={closeModal}
          onSave={saveTask}
          getTasksForPrioritySelection={getTasksForPrioritySelection}
        />
      </div>
    </DndProvider>
  );
};