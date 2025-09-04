/**
 * Document Management Service
 * Focused service for document and versioning operations
 */

import { callAPI } from "../../shared/api";
import type { RestoreVersionResponse, Version, VersionContentResponse, VersionResponse } from "../types";

export const documentService = {
  /**
   * Get version history for project documents
   */
  async getDocumentVersionHistory(projectId: string, fieldName: string = "docs"): Promise<Version[]> {
    try {
      const response = await callAPI<VersionResponse>(`/api/projects/${projectId}/versions?field_name=${fieldName}`);
      return response.versions || [];
    } catch (error) {
      console.error(`Failed to get document version history for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Get content of a specific document version for preview
   */
  async getVersionContent(
    projectId: string,
    versionNumber: number,
    fieldName: string = "docs",
  ): Promise<VersionContentResponse> {
    try {
      const response = await callAPI<VersionContentResponse>(
        `/api/projects/${projectId}/versions/${fieldName}/${versionNumber}`,
      );
      return response;
    } catch (error) {
      console.error(`Failed to get version ${versionNumber} content for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Restore a project document field to a specific version
   */
  async restoreDocumentVersion(
    projectId: string,
    versionNumber: number,
    fieldName: string = "docs",
  ): Promise<RestoreVersionResponse> {
    try {
      const response = await callAPI<RestoreVersionResponse>(
        `/api/projects/${projectId}/versions/${fieldName}/${versionNumber}/restore`,
        {
          method: "POST",
        },
      );

      return response;
    } catch (error) {
      console.error(`Failed to restore version ${versionNumber} for project ${projectId}:`, error);
      throw error;
    }
  },
};
