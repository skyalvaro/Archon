import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../contexts/ToastContext";
import { motion } from "framer-motion";
import { useStaggeredEntrance } from "../hooks/useStaggeredEntrance";
import {
  useProjects,
  useTaskCounts,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  projectKeys,
} from "../hooks/useProjectQueries";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../features/ui/primitives";
import { DocsTab } from "../components/project-tasks/DocsTab";
import { TasksTab } from "../features/projects/tasks/TasksTab";
import { Button } from "../components/ui/Button";
import {
  Plus,
  X,
  AlertCircle,
  Loader2,
  Trash2,
  Pin,
  ListTodo,
  Activity,
  CheckCircle2,
  Clipboard,
} from "lucide-react";

import type { Project, CreateProjectRequest } from "../types/project";
import { DeleteConfirmModal } from "../components/common/DeleteConfirmModal";

interface ProjectPageProps {
  className?: string;
  "data-id"?: string;
}

function ProjectPage({
  className = "",
  "data-id": dataId,
}: ProjectPageProps) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State management for selected project and UI
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    title: "",
    description: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(null);

  const { showToast } = useToast();

  // React Query hooks
  const { data: projects = [], isLoading: isLoadingProjects, error: projectsError } = useProjects();
  const { data: taskCounts = {}, refetch: refetchTaskCounts } = useTaskCounts();

  // Mutations
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();


  // Sort projects - pinned first, then alphabetically
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (a.pinned) return -1;
      if (b.pinned) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [projects]);

  // Handle project selection
  const handleProjectSelect = useCallback((project: Project) => {
    if (selectedProject?.id === project.id) return;
    
    setSelectedProject(project);
    setActiveTab("tasks");
    navigate(`/projects/${project.id}`, { replace: true });
  }, [selectedProject?.id, navigate]);

  // Auto-select project based on URL or default to leftmost
  useEffect(() => {
    if (!sortedProjects.length) return;

    // If we have a projectId in the URL, try to select that project
    if (projectId) {
      const urlProject = sortedProjects.find(p => p.id === projectId);
      if (urlProject && selectedProject?.id !== urlProject.id) {
        handleProjectSelect(urlProject);
        return;
      }
    }

    // Select the leftmost (first) project if none is selected
    if (!selectedProject && sortedProjects.length > 0) {
      handleProjectSelect(sortedProjects[0]);
    }
  }, [sortedProjects, projectId, selectedProject, handleProjectSelect]);

  // Refetch task counts when project changes
  useEffect(() => {
    if (selectedProject) {
      refetchTaskCounts();
    }
  }, [selectedProject?.id, refetchTaskCounts]);

  // Handle project operations
  const handleDeleteProject = useCallback(
    async (e: React.MouseEvent, projectId: string, projectTitle: string) => {
      e.stopPropagation();
      setProjectToDelete({ id: projectId, title: projectTitle });
      setShowDeleteConfirm(true);
    },
    [],
  );

  const confirmDeleteProject = useCallback(async () => {
    if (!projectToDelete) return;

    try {
      await deleteProjectMutation.mutateAsync(projectToDelete.id);
      
      if (selectedProject?.id === projectToDelete.id) {
        setSelectedProject(null);
        navigate('/projects', { replace: true });
      }
      
      showToast(`Project "${projectToDelete.title}" deleted successfully`, 'success');
    } catch (error) {
      // Error handled by mutation
    } finally {
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
    }
  }, [projectToDelete, deleteProjectMutation, selectedProject?.id, navigate, showToast]);

  const cancelDeleteProject = useCallback(() => {
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  }, []);

  const handleTogglePin = useCallback(
    async (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      
      try {
        await updateProjectMutation.mutateAsync({
          projectId: project.id,
          updates: { pinned: !project.pinned },
        });
      } catch (error) {
        // Error handled by mutation
      }
    },
    [updateProjectMutation],
  );

  const handleCreateProject = async () => {
    if (!newProjectForm.title.trim()) {
      return;
    }

    const projectData: CreateProjectRequest = {
      title: newProjectForm.title,
      description: newProjectForm.description,
      docs: [],
      features: [],
      data: [],
    };

    try {
      await createProjectMutation.mutateAsync(projectData);
      setNewProjectForm({ title: "", description: "" });
      setIsNewProjectModalOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };


  // Add staggered entrance animations
  const { isVisible, containerVariants, itemVariants, titleVariants } =
    useStaggeredEntrance([1, 2, 3], 0.15);

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={containerVariants}
      className={`max-w-full mx-auto ${className}`}
      data-id={dataId}
    >
      {/* Page Header with New Project Button */}
      <motion.div
        className="flex items-center justify-between mb-8"
        variants={itemVariants}
      >
        <motion.h1
          className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3"
          variants={titleVariants}
        >
          <img
            src="/logo-neon.png"
            alt="Projects"
            className="w-7 h-7 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
          />
          Projects
        </motion.h1>
        <Button
          onClick={() => setIsNewProjectModalOpen(true)}
          variant="primary"
          accentColor="purple"
          className="shadow-lg shadow-purple-500/20"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          <span>New Project</span>
        </Button>
      </motion.div>

      {/* Projects Loading/Error States */}
      {isLoadingProjects && (
        <motion.div variants={itemVariants} className="mb-10">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-purple-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">
                Loading your projects...
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {projectsError && (
        <motion.div variants={itemVariants} className="mb-10">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400 mb-4">
                {(projectsError as Error).message || "Failed to load projects"}
              </p>
              <Button
                onClick={() => queryClient.invalidateQueries({ queryKey: projectKeys.lists() })}
                variant="primary"
                accentColor="purple"
              >
                Try Again
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Project Cards - Horizontally Scrollable */}
      {!isLoadingProjects && !projectsError && (
        <motion.div className="relative mb-10" variants={itemVariants}>
          <div className="overflow-x-auto pb-4 scrollbar-thin">
            <div className="flex gap-4 min-w-max">
              {sortedProjects.map((project) => (
                <motion.div
                  key={project.id}
                  variants={itemVariants}
                  onClick={() => handleProjectSelect(project)}
                  className={`
                    relative p-4 rounded-xl backdrop-blur-md w-72 cursor-pointer overflow-hidden
                    ${
                      project.pinned
                        ? "bg-gradient-to-b from-purple-100/80 via-purple-50/30 to-purple-100/50 dark:from-purple-900/30 dark:via-purple-900/20 dark:to-purple-900/10"
                        : selectedProject?.id === project.id
                          ? "bg-gradient-to-b from-white/70 via-purple-50/20 to-white/50 dark:from-white/5 dark:via-purple-900/5 dark:to-black/20"
                          : "bg-gradient-to-b from-white/80 to-white/60 dark:from-white/10 dark:to-black/30"
                    }
                    border ${
                      project.pinned
                        ? "border-purple-500/80 dark:border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                        : selectedProject?.id === project.id
                          ? "border-purple-400/60 dark:border-purple-500/60"
                          : "border-gray-200 dark:border-zinc-800/50"
                    }
                    ${
                      selectedProject?.id === project.id
                        ? "shadow-[0_0_15px_rgba(168,85,247,0.4),0_0_10px_rgba(147,51,234,0.3)] dark:shadow-[0_0_20px_rgba(168,85,247,0.5),0_0_15px_rgba(147,51,234,0.4)]"
                        : "shadow-[0_10px_30px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.7)]"
                    }
                    hover:shadow-[0_15px_40px_-15px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_15px_40px_-15px_rgba(0,0,0,0.9)]
                    transition-all duration-300
                    ${selectedProject?.id === project.id ? "translate-y-[-2px]" : "hover:translate-y-[-2px]"}
                  `}
                >
                  {/* Subtle aurora glow effect for selected card */}
                  {selectedProject?.id === project.id && (
                    <div className="absolute inset-0 rounded-xl overflow-hidden opacity-30 dark:opacity-40">
                      <div className="absolute -inset-[100px] bg-[radial-gradient(circle,rgba(168,85,247,0.8)_0%,rgba(147,51,234,0.6)_40%,transparent_70%)] blur-3xl animate-[pulse_8s_ease-in-out_infinite]"></div>
                    </div>
                  )}

                  <div className="relative z-10">
                    <div className="flex items-center justify-center mb-4 px-2">
                      <h3
                        className={`font-medium text-center leading-tight line-clamp-2 transition-all duration-300 ${
                          selectedProject?.id === project.id
                            ? "text-gray-900 dark:text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {project.title}
                      </h3>
                    </div>
                    <div className="flex items-stretch gap-2 w-full">
                      {/* Task count pills */}
                      {/* Todo pill */}
                      <div className="relative flex-1">
                        <div
                          className={`absolute inset-0 bg-pink-600 rounded-full blur-md ${selectedProject?.id === project.id ? "opacity-30 dark:opacity-75" : "opacity-0"}`}
                        ></div>
                        <div
                          className={`relative flex items-center h-12 backdrop-blur-sm rounded-full border shadow-sm transition-all duration-300 ${
                            selectedProject?.id === project.id
                              ? "bg-white/70 dark:bg-zinc-900/90 border-pink-300 dark:border-pink-500/50 dark:shadow-[0_0_10px_rgba(236,72,153,0.5)] hover:shadow-md dark:hover:shadow-[0_0_15px_rgba(236,72,153,0.7)]"
                              : "bg-white/30 dark:bg-zinc-900/30 border-gray-300/50 dark:border-gray-700/50"
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center px-2 min-w-[40px]">
                            <ListTodo
                              className={`w-4 h-4 ${selectedProject?.id === project.id ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-600"}`}
                            />
                            <span
                              className={`text-[8px] font-medium ${selectedProject?.id === project.id ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-600"}`}
                            >
                              ToDo
                            </span>
                          </div>
                          <div
                            className={`flex-1 flex items-center justify-center border-l ${selectedProject?.id === project.id ? "border-pink-300 dark:border-pink-500/30" : "border-gray-300/50 dark:border-gray-700/50"}`}
                          >
                            <span
                              className={`text-lg font-bold ${selectedProject?.id === project.id ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-600"}`}
                            >
                              {taskCounts[project.id]?.todo || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Doing pill */}
                      <div className="relative flex-1">
                        <div
                          className={`absolute inset-0 bg-blue-600 rounded-full blur-md ${selectedProject?.id === project.id ? "opacity-30 dark:opacity-75" : "opacity-0"}`}
                        ></div>
                        <div
                          className={`relative flex items-center h-12 backdrop-blur-sm rounded-full border shadow-sm transition-all duration-300 ${
                            selectedProject?.id === project.id
                              ? "bg-white/70 dark:bg-zinc-900/90 border-blue-300 dark:border-blue-500/50 dark:shadow-[0_0_10px_rgba(59,130,246,0.5)] hover:shadow-md dark:hover:shadow-[0_0_15px_rgba(59,130,246,0.7)]"
                              : "bg-white/30 dark:bg-zinc-900/30 border-gray-300/50 dark:border-gray-700/50"
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center px-2 min-w-[40px]">
                            <Activity
                              className={`w-4 h-4 ${selectedProject?.id === project.id ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-600"}`}
                            />
                            <span
                              className={`text-[8px] font-medium ${selectedProject?.id === project.id ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-600"}`}
                            >
                              Doing
                            </span>
                          </div>
                          <div
                            className={`flex-1 flex items-center justify-center border-l ${selectedProject?.id === project.id ? "border-blue-300 dark:border-blue-500/30" : "border-gray-300/50 dark:border-gray-700/50"}`}
                          >
                            <span
                              className={`text-lg font-bold ${selectedProject?.id === project.id ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-600"}`}
                            >
                              {taskCounts[project.id]?.doing || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Done pill */}
                      <div className="relative flex-1">
                        <div
                          className={`absolute inset-0 bg-green-600 rounded-full blur-md ${selectedProject?.id === project.id ? "opacity-30 dark:opacity-75" : "opacity-0"}`}
                        ></div>
                        <div
                          className={`relative flex items-center h-12 backdrop-blur-sm rounded-full border shadow-sm transition-all duration-300 ${
                            selectedProject?.id === project.id
                              ? "bg-white/70 dark:bg-zinc-900/90 border-green-300 dark:border-green-500/50 dark:shadow-[0_0_10px_rgba(34,197,94,0.5)] hover:shadow-md dark:hover:shadow-[0_0_15px_rgba(34,197,94,0.7)]"
                              : "bg-white/30 dark:bg-zinc-900/30 border-gray-300/50 dark:border-gray-700/50"
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center px-2 min-w-[40px]">
                            <CheckCircle2
                              className={`w-4 h-4 ${selectedProject?.id === project.id ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-600"}`}
                            />
                            <span
                              className={`text-[8px] font-medium ${selectedProject?.id === project.id ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-600"}`}
                            >
                              Done
                            </span>
                          </div>
                          <div
                            className={`flex-1 flex items-center justify-center border-l ${selectedProject?.id === project.id ? "border-green-300 dark:border-green-500/30" : "border-gray-300/50 dark:border-gray-700/50"}`}
                          >
                            <span
                              className={`text-lg font-bold ${selectedProject?.id === project.id ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-600"}`}
                            >
                              {taskCounts[project.id]?.done || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/30 flex items-center justify-between gap-2">
                      {/* Pin button */}
                      <button
                        onClick={(e) => handleTogglePin(e, project)}
                        disabled={updateProjectMutation.isPending}
                        className={`p-1.5 rounded-full ${
                          updateProjectMutation.isPending
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800/50 dark:text-gray-500"
                            : project.pinned === true 
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-700/30 dark:text-purple-400 hover:bg-purple-200 hover:text-purple-800 dark:hover:bg-purple-800/50 dark:hover:text-purple-300" 
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800/70 dark:text-gray-400 hover:bg-purple-200 hover:text-purple-800 dark:hover:bg-purple-800/50 dark:hover:text-purple-300"
                        } transition-colors`}
                        title={
                          updateProjectMutation.isPending
                            ? "Updating pin status..."
                            : project.pinned === true
                              ? "Unpin project"
                              : "Pin project"
                        }
                        aria-label={
                          updateProjectMutation.isPending
                            ? "Updating pin status..."
                            : project.pinned === true
                              ? "Unpin project"
                              : "Pin project"
                        }
                        data-pinned={project.pinned}
                      >
                        <Pin
                          className="w-3.5 h-3.5"
                          fill={
                            project.pinned === true ? "currentColor" : "none"
                          }
                        />
                      </button>

                      {/* Copy Project ID Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(project.id);
                          showToast(
                            "Project ID copied to clipboard",
                            "success",
                          );
                          setCopiedProjectId(project.id);
                          setTimeout(() => {
                            setCopiedProjectId(null);
                          }, 2000);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors py-1"
                        title="Copy Project ID to clipboard"
                      >
                        {copiedProjectId === project.id ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3 h-3" />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={(e) =>
                          handleDeleteProject(e, project.id, project.title)
                        }
                        className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-800/70 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                        title="Delete project"
                        aria-label="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Project Details Section */}
      {selectedProject && (
        <motion.div variants={itemVariants} className="relative">
          <Tabs
            defaultValue="tasks"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger
                value="docs"
                className="py-3 font-mono transition-all duration-300"
                color="blue"
              >
                Docs
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="py-3 font-mono transition-all duration-300"
                color="orange"
              >
                Tasks
              </TabsTrigger>
            </TabsList>

            {/* Tab content */}
            <div>
              {activeTab === "docs" && (
                <TabsContent value="docs" className="mt-0">
                  <DocsTab project={selectedProject} />
                </TabsContent>
              )}
              {activeTab === "tasks" && (
                <TabsContent value="tasks" className="mt-0">
                  <TasksTab projectId={selectedProject.id} />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </motion.div>
      )}

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div
            className="relative p-6 rounded-md backdrop-blur-md w-full max-w-md
              bg-gradient-to-b from-white/80 to-white/60 dark:from-white/10 dark:to-black/30
              border border-gray-200 dark:border-zinc-800/50
              shadow-[0_10px_30px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.7)]
              before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] 
              before:rounded-t-[4px] before:bg-purple-500 
              before:shadow-[0_0_10px_2px_rgba(168,85,247,0.4)] dark:before:shadow-[0_0_20px_5px_rgba(168,85,247,0.7)]
              after:content-[''] after:absolute after:top-0 after:left-0 after:right-0 after:h-16
              after:bg-gradient-to-b after:from-purple-100 after:to-white dark:after:from-purple-500/20 dark:after:to-purple-500/5
              after:rounded-t-md after:pointer-events-none"
          >
            <div className="relative z-10">
              {/* Project Creation Form */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-fuchsia-500 text-transparent bg-clip-text">
                  Create New Project
                </h3>
                <button
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter project name..."
                    value={newProjectForm.title}
                    onChange={(e) =>
                      setNewProjectForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="w-full bg-white/50 dark:bg-black/70 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-md py-2 px-3 focus:outline-none focus:border-purple-400 focus:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all duration-300"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    placeholder="Enter project description..."
                    rows={4}
                    value={newProjectForm.description}
                    onChange={(e) =>
                      setNewProjectForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full bg-white/50 dark:bg-black/70 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-md py-2 px-3 focus:outline-none focus:border-purple-400 focus:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all duration-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  onClick={() => setIsNewProjectModalOpen(false)}
                  variant="ghost"
                  disabled={createProjectMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProject}
                  variant="primary"
                  accentColor="purple"
                  className="shadow-lg shadow-purple-500/20"
                  disabled={
                    createProjectMutation.isPending ||
                    !newProjectForm.title.trim()
                  }
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && projectToDelete && (
        <DeleteConfirmModal
          itemName={projectToDelete.title}
          onConfirm={confirmDeleteProject}
          onCancel={cancelDeleteProject}
          type="project"
        />
      )}
    </motion.div>
  );
}

export { ProjectPage };