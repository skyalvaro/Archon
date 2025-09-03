/**
 * Document Management Service
 * Focused service for document and versioning operations
 */

import { callAPI } from '../../shared/api';

export const documentService = {
  /**
   * Get version history for project documents
   */
  async getDocumentVersionHistory(projectId: string, fieldName: string = 'docs'): Promise<any[]> {
    try {
      const response = await callAPI<{versions: any[]}>(`/api/projects/${projectId}/versions?field_name=${fieldName}`);
      return response.versions || [];
    } catch (error) {
      console.error(`Failed to get document version history for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Get content of a specific document version for preview
   */
  async getVersionContent(projectId: string, versionNumber: number, fieldName: string = 'docs'): Promise<any> {
    try {
      const response = await callAPI<{content: any, version: any}>(`/api/projects/${projectId}/versions/${fieldName}/${versionNumber}`);
      return response;
    } catch (error) {
      console.error(`Failed to get version ${versionNumber} content for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Restore a project document field to a specific version
   */
  async restoreDocumentVersion(projectId: string, versionNumber: number, fieldName: string = 'docs'): Promise<any> {
    try {
      const response = await callAPI<any>(`/api/projects/${projectId}/versions/${fieldName}/${versionNumber}/restore`, {
        method: 'POST'
      });
      
      return response;
    } catch (error) {
      console.error(`Failed to restore version ${versionNumber} for project ${projectId}:`, error);
      throw error;
    }
  },
};