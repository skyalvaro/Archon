import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import React from "react";
import { Button } from "../../ui/primitives";
import type { Project } from "../types";
import { ProjectCard } from "./ProjectCard";

interface ProjectListProps {
  projects: Project[];
  selectedProject: Project | null;
  taskCounts: Record<string, { todo: number; doing: number; done: number }>;
  isLoading: boolean;
  error: Error | null;
  onProjectSelect: (project: Project) => void;
  onPinProject: (e: React.MouseEvent, projectId: string) => void;
  onDeleteProject: (e: React.MouseEvent, projectId: string, title: string) => void;
  onRetry: () => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
  },
};

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  selectedProject,
  taskCounts,
  isLoading,
  error,
  onProjectSelect,
  onPinProject,
  onDeleteProject,
  onRetry,
}) => {
  // Sort projects - pinned first, then alphabetically
  const sortedProjects = React.useMemo(() => {
    return [...projects].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [projects]);

  if (isLoading) {
    return (
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-purple-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">Loading your projects...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">{error.message || "Failed to load projects"}</p>
            <Button onClick={onRetry} variant="default">
              Try Again
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (sortedProjects.length === 0) {
    return (
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No projects yet. Create your first project to get started!
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="relative mb-10" variants={itemVariants}>
      <div className="overflow-x-auto overflow-y-visible pb-4 pt-2 scrollbar-thin">
        <div className="flex gap-4 min-w-max">
          {sortedProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isSelected={selectedProject?.id === project.id}
              taskCounts={taskCounts[project.id] || { todo: 0, doing: 0, done: 0 }}
              onSelect={onProjectSelect}
              onPin={onPinProject}
              onDelete={onDeleteProject}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};
