/**
 * Version Type Definitions
 *
 * Types for document versioning and history management.
 */

export interface Version {
  id: string;
  version_number: number;
  change_summary: string;
  change_type: string;
  created_by: string;
  created_at: string;
  content: unknown;
  document_id?: string;
}

export interface VersionResponse {
  versions: Version[];
}

export interface VersionContentResponse {
  content: unknown;
  version: Version;
}

export interface RestoreVersionResponse {
  success: boolean;
  message?: string;
  restoredVersion?: Version;
}
