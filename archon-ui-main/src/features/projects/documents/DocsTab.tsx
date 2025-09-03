import { useState, useRef, useEffect } from 'react';
import { Plus, Upload, FileText, History, Search } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/primitives';
import { cn, glassmorphism } from '../../ui/primitives/styles';
import { DocumentCard } from './components';
import { DocumentEditor } from './components/DocumentEditor';
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { 
  useDocumentActions,
  useProjectDocuments,
  useCreateDocument,
  useUpdateDocument
} from './hooks';
import { DeleteConfirmModal } from '../../ui/components/DeleteConfirmModal';
import type { ProjectDocument } from './types';

interface DocsTabProps {
  project?: {
    id: string;
    title: string;
    created_at?: string;
    updated_at?: string;
  } | null;
}

// Document templates
const DOCUMENT_TEMPLATES = {
  markdown_doc: {
    name: "Markdown Document",
    icon: "📝",
    document_type: "markdown",
    content: {
      markdown: `# Document Title

## Overview

Provide a brief overview of this document...

## Content

Add your content here...

## Next Steps

- [ ] Action item 1
- [ ] Action item 2`,
    },
  },
  meeting_notes: {
    name: "Meeting Notes",
    icon: "📋",
    document_type: "meeting_notes",
    content: {
      meeting_date: new Date().toISOString().split("T")[0],
      attendees: ["Person 1", "Person 2"],
      agenda: ["Agenda item 1", "Agenda item 2"],
      notes: "Meeting discussion notes...",
      action_items: [
        {
          item: "Action item 1",
          owner: "Person Name",
          due_date: "YYYY-MM-DD",
        },
      ],
      next_meeting: "YYYY-MM-DD",
    },
  },
  technical_spec: {
    name: "Technical Spec",
    icon: "🔧",
    document_type: "spec",
    content: {
      markdown: `# Technical Specification

## Overview
Brief description of the feature/system...

## Requirements
- Requirement 1
- Requirement 2

## Architecture
Describe the technical architecture...

## Implementation Plan
1. Phase 1: ...
2. Phase 2: ...

## Testing Strategy
- Unit tests
- Integration tests
- E2E tests`,
    },
  },
};

export const DocsTab = ({ project }: DocsTabProps) => {
  const { showToast } = useToast();
  const projectId = project?.id || '';
  
  // TanStack Query hooks
  const { data: documents = [], isLoading } = useProjectDocuments(projectId);
  const createDocumentMutation = useCreateDocument(projectId);
  const updateDocumentMutation = useUpdateDocument(projectId);
  
  // Document state
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Dark mode detection
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Document actions hook
  const {
    showDeleteConfirm,
    documentToDelete,
    initiateDelete,
    confirmDelete,
    cancelDelete
  } = useDocumentActions(projectId);

  // Auto-select first document when documents load
  useEffect(() => {
    if (documents.length > 0 && !selectedDocument) {
      setSelectedDocument(documents[0]);
    }
  }, [documents, selectedDocument]);
  
  // Update selected document if it was updated
  useEffect(() => {
    if (selectedDocument && documents.length > 0) {
      const updated = documents.find(d => d.id === selectedDocument.id);
      if (updated && updated !== selectedDocument) {
        setSelectedDocument(updated);
      }
    }
  }, [documents]);

  // Save document using TanStack mutation
  const saveDocument = async (doc: ProjectDocument): Promise<void> => {
    if (!projectId) return;
    
    await updateDocumentMutation.mutateAsync(doc);
  };

  // Create new document from template
  const createDocumentFromTemplate = async (templateKey: string) => {
    if (!projectId) return;
    
    const template = DOCUMENT_TEMPLATES[templateKey as keyof typeof DOCUMENT_TEMPLATES];
    if (!template) return;
    
    const newDoc: ProjectDocument = {
      id: `doc-${Date.now()}`,
      title: `${template.name} - ${new Date().toLocaleDateString()}`,
      content: template.content,
      document_type: template.document_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    createDocumentMutation.mutate(newDoc, {
      onSuccess: () => {
        setSelectedDocument(newDoc);
        setShowTemplateModal(false);
      },
    });
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectId) return;

    // Validate file type
    const allowedTypes = ['.md', '.txt', '.pdf'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExt)) {
      showToast('Please upload a .md, .txt, or .pdf file', 'error');
      return;
    }

    try {
      // Read file content
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        
        if (fileExt === '.pdf') {
          // For PDF files, we'd need a PDF parser library
          // For now, just store the file name and type
          resolve(`PDF Document: ${file.name}\n\nPDF content parsing not yet implemented.`);
        } else {
          reader.readAsText(file);
        }
      });

      // Create new document
      const newDoc: ProjectDocument = {
        id: `doc-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        content: { markdown: content },
        document_type: fileExt === '.pdf' ? 'pdf' : 'markdown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to project using mutation
      createDocumentMutation.mutate(newDoc, {
        onSuccess: () => {
          setSelectedDocument(newDoc);
          setShowUploadModal(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        },
      });
    } catch (error) {
      console.error('Failed to upload file:', error);
      showToast('Failed to upload file', 'error');
    }
  };

  // Filter documents based on search
  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Left Sidebar - Document List */}
      <div className={cn(
        "w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col",
        glassmorphism.background.subtle
      )}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
            Documents
          </h2>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowTemplateModal(true)}
              variant="cyan"
              size="sm"
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
            <Button
              onClick={() => setShowUploadModal(true)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
          </div>
        </div>
        
        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No documents found' : 'No documents yet'}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                isActive={selectedDocument?.id === doc.id}
                onSelect={setSelectedDocument}
                onDelete={initiateDelete}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Right Content - Document Editor */}
      <div className="flex-1 flex flex-col">
        {selectedDocument ? (
          <>
            {/* Document Actions */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Last updated: {new Date(selectedDocument.updated_at).toLocaleDateString()}
                </span>
              </div>
              <Button
                onClick={() => setShowVersionHistory(true)}
                variant="outline"
                size="sm"
              >
                <History className="w-4 h-4 mr-1" />
                Version History
              </Button>
            </div>
            
            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <DocumentEditor
                document={selectedDocument}
                onSave={saveDocument}
                isDarkMode={isDarkMode}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No document selected
              </p>
              <Button
                onClick={() => setShowTemplateModal(true)}
                variant="cyan"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Document
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Template Selection Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {Object.entries(DOCUMENT_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() => createDocumentFromTemplate(key)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  "hover:border-cyan-500 hover:shadow-lg",
                  "border-gray-200 dark:border-gray-700",
                  glassmorphism.background.subtle
                )}
              >
                <div className="text-2xl mb-2">{template.icon}</div>
                <div className="font-medium text-gray-800 dark:text-white">
                  {template.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Create a new {template.name.toLowerCase()}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center",
              "border-gray-300 dark:border-gray-700"
            )}>
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Upload a document file
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                Supported formats: .md, .txt, .pdf
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="cyan"
              >
                Choose File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Version History Modal */}
      {selectedDocument && (
        <VersionHistoryModal
          isOpen={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          projectId={projectId}
          documentId={selectedDocument.id}
          fieldName="docs"
          onRestore={() => {}}
        />
      )}
      
      {/* Delete Confirmation */}
      <DeleteConfirmModal
        open={showDeleteConfirm}
        itemName={documentToDelete?.title || ""}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        type="document"
        size="compact"
      />
    </div>
  );
};