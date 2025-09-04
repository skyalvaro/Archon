import { FileText, History, Plus, Search, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DeleteConfirmModal } from "../../ui/components/DeleteConfirmModal";
import { useToast } from "../../ui/hooks/useToast";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from "../../ui/primitives";
import { cn, glassmorphism } from "../../ui/primitives/styles";
import { DocumentCard } from "./components";
import { DocumentEditor } from "./components/DocumentEditor";
import { VersionHistoryModal } from "./components/VersionHistoryModal";
import { useCreateDocument, useDocumentActions, useProjectDocuments, useUpdateDocument } from "./hooks";
import type { ProjectDocument } from "./types";

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
  const projectId = project?.id || "";

  // TanStack Query hooks
  const { data: documents = [], isLoading } = useProjectDocuments(projectId);
  const createDocumentMutation = useCreateDocument(projectId);
  const updateDocumentMutation = useUpdateDocument(projectId);

  // Document state
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Dark mode detection
  const isDarkMode = document.documentElement.classList.contains("dark");

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document actions hook
  const { showDeleteConfirm, documentToDelete, initiateDelete, confirmDelete, cancelDelete } =
    useDocumentActions(projectId);

  // Auto-select first document when documents load
  useEffect(() => {
    if (documents.length > 0 && !selectedDocument) {
      setSelectedDocument(documents[0]);
    }
  }, [documents, selectedDocument]);

  // Update selected document if it was updated
  useEffect(() => {
    if (selectedDocument && documents.length > 0) {
      const updated = documents.find((d) => d.id === selectedDocument.id);
      if (updated && updated !== selectedDocument) {
        setSelectedDocument(updated);
      }
    }
  }, [documents, selectedDocument]);

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
    const allowedTypes = [".md", ".txt", ".pdf"];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!allowedTypes.includes(fileExt)) {
      showToast("Please upload a .md, .txt, or .pdf file", "error");
      return;
    }

    try {
      // Read file content
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;

        if (fileExt === ".pdf") {
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
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        content: { markdown: content },
        document_type: fileExt === ".pdf" ? "pdf" : "markdown",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to project using mutation
      createDocumentMutation.mutate(newDoc, {
        onSuccess: () => {
          setSelectedDocument(newDoc);
          setShowUploadModal(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to upload file:", error, { file: file.name });
      showToast(`Failed to upload file: ${errorMessage}`, "error");
    }
  };

  // Filter documents based on search
  const filteredDocuments = documents.filter((doc) => doc.title.toLowerCase().includes(searchQuery.toLowerCase()));

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
      <div
        className={cn(
          "w-80 flex flex-col",
          "border-r border-gray-200 dark:border-gray-700",
          glassmorphism.background.subtle,
          "backdrop-blur-sm",
        )}
      >
        {/* Header */}
        <div className={cn("p-4 border-b border-gray-200 dark:border-gray-700", glassmorphism.background.subtle)}>
          <h2
            className={cn("text-lg font-semibold mb-3", "text-gray-800 dark:text-cyan-300", "flex items-center gap-2")}
          >
            <FileText className="w-5 h-5" />
            Documents
          </h2>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-9",
                "bg-gray-50 dark:bg-gray-900/50",
                "border-gray-300 dark:border-gray-600",
                "focus:border-cyan-500 dark:focus:border-cyan-400",
                "focus:ring-cyan-500/20 dark:focus:ring-cyan-400/20",
              )}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowTemplateModal(true)}
              variant="cyan"
              size="sm"
              className={cn("flex-1", "shadow-lg shadow-cyan-500/20 dark:shadow-cyan-400/20")}
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
            <Button
              onClick={() => setShowUploadModal(true)}
              variant="outline"
              size="sm"
              className={cn(
                "flex-1",
                "hover:border-purple-500 dark:hover:border-purple-400",
                "hover:text-purple-600 dark:hover:text-purple-400",
              )}
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
          </div>
        </div>

        {/* Document List */}
        <div
          className={cn(
            "flex-1 overflow-y-auto p-4 space-y-2",
            "scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600",
            "scrollbar-track-transparent",
          )}
        >
          {filteredDocuments.length === 0 ? (
            <div className={cn("text-center py-8", "text-gray-500 dark:text-gray-400")}>
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{searchQuery ? "No documents found" : "No documents yet"}</p>
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
              <Button onClick={() => setShowVersionHistory(true)} variant="outline" size="sm">
                <History className="w-4 h-4 mr-1" />
                Version History
              </Button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <DocumentEditor document={selectedDocument} onSave={saveDocument} isDarkMode={isDarkMode} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">No document selected</p>
              <Button onClick={() => setShowTemplateModal(true)} variant="cyan">
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
                type="button"
                key={key}
                onClick={() => createDocumentFromTemplate(key)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  "hover:border-cyan-500 hover:shadow-lg",
                  "border-gray-200 dark:border-gray-700",
                  glassmorphism.background.subtle,
                )}
              >
                <div className="text-2xl mb-2">{template.icon}</div>
                <div className="font-medium text-gray-800 dark:text-white">{template.name}</div>
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
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center",
                "border-gray-300 dark:border-gray-700",
              )}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">Upload a document file</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Supported formats: .md, .txt, .pdf</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} variant="cyan">
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
          onRestore={() => {
            // Version restore handled internally by VersionHistoryModal
            // Refresh will happen via query invalidation
          }}
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
