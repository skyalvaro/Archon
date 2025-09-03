/**
 * Project Management Service
 * Focused service for project CRUD operations only
 */

import type { 
  Project, 
  CreateProjectRequest, 
  UpdateProjectRequest
} from '../types';

import { 
  validateCreateProject, 
  validateUpdateProject,
} from '../schemas';

import { 
  callAPI, 
  formatValidationErrors, 
  ValidationError,
  formatRelativeTime 
} from '../shared/api';

export const projectService = {
  /**
   * Get all projects
   */
  async listProjects(): Promise<Project[]> {
    try {
      console.log('[PROJECT SERVICE] Fetching projects from API');
      const response = await callAPI<{ projects: Project[] }>('/api/projects');
      console.log('[PROJECT SERVICE] Raw API response:', response);
      
      const projects = response.projects || [];
      console.log('[PROJECT SERVICE] Projects array length:', projects.length);
      
      // Debug raw pinned values
      projects.forEach((p: any) => {
        console.log(`[PROJECT SERVICE] Raw project: ${p.title}, pinned=${p.pinned} (type: ${typeof p.pinned})`);
      });
      
      // Add computed UI properties
      const processedProjects = projects.map((project: Project) => {
        // Debug the raw pinned value
        console.log(`[PROJECT SERVICE] Processing ${project.title}: raw pinned=${project.pinned} (type: ${typeof project.pinned})`);
        
        const processed = {
          ...project,
          // Ensure pinned is properly handled as boolean
          pinned: project.pinned === true || project.pinned === 'true',
          progress: project.progress || 0,
          updated: project.updated || formatRelativeTime(project.updated_at)
        };
        console.log(`[PROJECT SERVICE] Processed project ${project.id} (${project.title}), pinned=${processed.pinned} (type: ${typeof processed.pinned})`);
        return processed;
      });
      
      console.log('[PROJECT SERVICE] All processed projects:', processedProjects.map(p => ({id: p.id, title: p.title, pinned: p.pinned})));
      return processedProjects;
    } catch (error) {
      console.error('Failed to list projects:', error);
      throw error;
    }
  },

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    try {
      const project = await callAPI<Project>(`/api/projects/${projectId}`);
      
      return {
        ...project,
        progress: project.progress || 0,
        updated: project.updated || formatRelativeTime(project.updated_at)
      };
    } catch (error) {
      console.error(`Failed to get project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Create a new project
   */
  async createProject(projectData: CreateProjectRequest): Promise<{ project_id: string; project: any; status: string; message: string }> {
    // Validate input
    console.log('[PROJECT SERVICE] Validating project data:', projectData);
    const validation = validateCreateProject(projectData);
    if (!validation.success) {
      console.error('[PROJECT SERVICE] Validation failed:', validation.error);
      throw new ValidationError(formatValidationErrors(validation.error));
    }
    console.log('[PROJECT SERVICE] Validation passed:', validation.data);

    try {
      console.log('[PROJECT SERVICE] Sending project creation request:', validation.data);
      const response = await callAPI<{ project_id: string; project: any; status: string; message: string }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(validation.data)
      });
      
      console.log('[PROJECT SERVICE] Project creation response:', response);
      return response;
    } catch (error) {
      console.error('[PROJECT SERVICE] Failed to initiate project creation:', error);
      if (error instanceof Error) {
        console.error('[PROJECT SERVICE] Error details:', {
          message: error.message,
          name: error.name
        });
      }
      throw error;
    }
  },

  /**
   * Update an existing project
   */
  async updateProject(projectId: string, updates: UpdateProjectRequest): Promise<Project> {
    // Validate input
    console.log(`[PROJECT SERVICE] Updating project ${projectId} with data:`, updates);
    const validation = validateUpdateProject(updates);
    if (!validation.success) {
      console.error(`[PROJECT SERVICE] Validation failed:`, validation.error);
      throw new ValidationError(formatValidationErrors(validation.error));
    }

    try {
      console.log(`[PROJECT SERVICE] Sending API request to update project ${projectId}`, validation.data);
      const project = await callAPI<Project>(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(validation.data)
      });
      
      console.log(`[PROJECT SERVICE] API update response:`, project);
      
      // Ensure pinned property is properly handled as boolean
      const processedProject = {
        ...project,
        pinned: project.pinned === true,
        progress: project.progress || 0,
        updated: formatRelativeTime(project.updated_at)
      };
      
      console.log(`[PROJECT SERVICE] Final processed project:`, {
        id: processedProject.id,
        title: processedProject.title,
        pinned: processedProject.pinned
      });
      
      return processedProject;
    } catch (error) {
      console.error(`Failed to update project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      await callAPI(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      
    } catch (error) {
      console.error(`Failed to delete project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Get features from a project's features JSONB field
   */
  async getProjectFeatures(projectId: string): Promise<{ features: any[]; count: number }> {
    try {
      const response = await callAPI<{ features: any[]; count: number }>(`/api/projects/${projectId}/features`);
      return response;
    } catch (error) {
      console.error(`Failed to get features for project ${projectId}:`, error);
      throw error;
    }
  },
};