import React from "react";
import { Pin, Trash2, Clipboard } from "lucide-react";
import { SimpleTooltip } from "../../ui/primitives/tooltip";
import { cn } from "../../ui/primitives/styles";

interface ProjectCardActionsProps {
  projectId: string;
  projectTitle: string;
  isPinned: boolean;
  onPin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onCopyId: (e: React.MouseEvent) => void;
  isDeleting?: boolean;
}

export const ProjectCardActions: React.FC<ProjectCardActionsProps> = ({
  projectId,
  projectTitle,
  isPinned,
  onPin,
  onDelete,
  onCopyId,
  isDeleting = false,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      {/* Pin Button */}
      <SimpleTooltip content={isPinned ? "Unpin project" : "Pin as default"}>
        <button
          type="button"
          onClick={onPin}
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center",
            "transition-all duration-300",
            isPinned
              ? "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30 hover:shadow-[0_0_10px_rgba(168,85,247,0.3)]"
              : "bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50"
          )}
          aria-label={isPinned ? "Unpin project" : "Pin as default"}
        >
          <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
        </button>
      </SimpleTooltip>

      {/* Delete Button */}
      <SimpleTooltip content={isDeleting ? "Deleting..." : "Delete project"}>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center",
            "transition-all duration-300",
            "bg-red-100/80 dark:bg-red-500/20",
            "text-red-600 dark:text-red-400",
            "hover:bg-red-200 dark:hover:bg-red-500/30",
            "hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]",
            isDeleting && "opacity-50 cursor-not-allowed"
          )}
          aria-label={isDeleting ? "Deleting project..." : `Delete ${projectTitle}`}
        >
          <Trash2 className={cn("w-3.5 h-3.5", isDeleting && "animate-pulse")} />
        </button>
      </SimpleTooltip>

      {/* Copy Project ID Button */}
      <SimpleTooltip content="Copy project ID">
        <button
          type="button"
          onClick={onCopyId}
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center",
            "transition-all duration-300",
            "bg-blue-100/80 dark:bg-blue-500/20",
            "text-blue-600 dark:text-blue-400",
            "hover:bg-blue-200 dark:hover:bg-blue-500/30",
            "hover:shadow-[0_0_10px_rgba(59,130,246,0.3)]"
          )}
          aria-label="Copy project ID"
        >
          <Clipboard className="w-3.5 h-3.5" />
        </button>
      </SimpleTooltip>
    </div>
  );
};