import React from "react";
import { Edit, Trash2, Clipboard } from "lucide-react";
import { useToast } from "../../../../contexts/ToastContext";

interface TaskCardActionsProps {
  taskId: string;
  taskTitle: string;
  onEdit: () => void;
  onDelete: () => void;
  showDescription?: boolean;
  onToggleDescription?: () => void;
}

export const TaskCardActions: React.FC<TaskCardActionsProps> = ({
  taskId,
  taskTitle,
  onEdit,
  onDelete,
}) => {
  const { showToast } = useToast();

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(taskId);
      } else {
        // Fallback for older browsers
        const ta = document.createElement("textarea");
        ta.value = taskId;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showToast("Task ID copied to clipboard", "success");
    } catch (error) {
      showToast("Failed to copy Task ID", "error");
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="w-5 h-5 rounded-full flex items-center justify-center bg-red-100/80 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-all duration-300"
        title="Delete task"
        aria-label={`Delete ${taskTitle}`}
      >
        <Trash2 className="w-3 h-3" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="w-5 h-5 rounded-full flex items-center justify-center bg-cyan-100/80 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-500/30 hover:shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all duration-300"
        title="Edit task"
        aria-label={`Edit ${taskTitle}`}
      >
        <Edit className="w-3 h-3" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={handleCopyId}
        className="w-5 h-5 rounded-full flex items-center justify-center bg-gray-100/80 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-500/30 hover:shadow-[0_0_10px_rgba(107,114,128,0.3)] transition-all duration-300"
        title="Copy Task ID"
        aria-label="Copy Task ID"
      >
        <Clipboard className="w-3 h-3" aria-hidden="true" />
      </button>
    </div>
  );
};
