/**
 * Document Type Definitions
 *
 * Core types for document management within projects.
 */

export interface ProjectDocument {
  id: string;
  title: string;
  content?: any;
  document_type?: DocumentType | string;
  updated_at: string;
  created_at?: string;
}

export type DocumentType = 
  | 'prp' 
  | 'technical' 
  | 'business' 
  | 'meeting_notes' 
  | 'spec' 
  | 'design' 
  | 'note' 
  | 'api' 
  | 'guide';

export interface DocumentCardProps {
  document: ProjectDocument;
  isActive: boolean;
  onSelect: (doc: ProjectDocument) => void;
  onDelete: (doc: ProjectDocument) => void;
}

export interface DocumentCreateTriggerProps {
  onClick: () => void;
}