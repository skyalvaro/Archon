import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  imagePlugin,
  ListsToggle,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  MDXEditor,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";
import { useCallback, useEffect, useState } from "react";
import "@mdxeditor/editor/style.css";
import { Edit3, Eye, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "../../../../contexts/ToastContext";
import { Button } from "../../../ui/primitives";
import { cn, glassmorphism } from "../../../ui/primitives/styles";
import type { ProjectDocument } from "../types";

interface DocumentEditorProps {
  document: ProjectDocument;
  onSave: (document: ProjectDocument) => Promise<void>;
  isDarkMode?: boolean;
  className?: string;
}

export const DocumentEditor = ({ document, onSave, isDarkMode = false, className }: DocumentEditorProps) => {
  const { showToast } = useToast();
  const [content, setContent] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  // Convert document content to markdown string with proper type checking
  const getMarkdownContent = useCallback(() => {
    // If content is already a string, return it
    if (typeof document.content === "string") {
      return document.content;
    }

    // If content has a markdown field, use it
    if (document.content && typeof document.content === "object" && "markdown" in document.content) {
      return (document.content as { markdown: string }).markdown;
    }

    // If content has a text field, use it
    if (document.content && typeof document.content === "object" && "text" in document.content) {
      return (document.content as { text: string }).text;
    }

    // Otherwise, convert the content object to a readable markdown format
    if (document.content && typeof document.content === "object") {
      let markdown = "";

      Object.entries(document.content).forEach(([key, value]) => {
        // Skip markdown field as we already handled it
        if (key === "markdown" || key === "text") return;

        const sectionTitle = key.replace(/_/g, " ").charAt(0).toUpperCase() + key.replace(/_/g, " ").slice(1);
        markdown += `## ${sectionTitle}\n\n`;

        if (Array.isArray(value)) {
          value.forEach((item) => {
            markdown += `- ${item}\n`;
          });
          markdown += "\n";
        } else if (typeof value === "object" && value !== null) {
          Object.entries(value as Record<string, unknown>).forEach(([subKey, subValue]) => {
            markdown += `**${subKey}:** ${subValue}\n\n`;
          });
        } else {
          markdown += `${value}\n\n`;
        }
      });

      return markdown;
    }

    // Fallback: create a new document
    return `# ${document.title}\n\nStart writing your document here...`;
  }, [document]);

  // Initialize content when document changes
  useEffect(() => {
    const initialContent = getMarkdownContent();
    setContent(initialContent);
    setHasChanges(false);
  }, [getMarkdownContent]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...document,
        content: { markdown: content },
        updated_at: new Date().toISOString(),
      });
      setHasChanges(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to save document:", error, {
        documentId: document.id,
      });
      showToast(`Failed to save document: ${errorMessage}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Editor Toolbar */}
      <div
        className={cn(
          "flex items-center justify-between p-4",
          "border-b border-gray-200 dark:border-gray-700",
          glassmorphism.background.subtle,
        )}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{document.title}</h2>
          {hasChanges && (
            <span
              className={cn(
                "px-2 py-1 text-xs rounded",
                "bg-yellow-100 dark:bg-yellow-900/30",
                "text-yellow-800 dark:text-yellow-400",
                "border border-yellow-300 dark:border-yellow-700",
              )}
            >
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {viewMode === "edit" ? (
              <>
                <Eye className="w-4 h-4" />
                Preview
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                Edit
              </>
            )}
          </Button>

          <Button
            onClick={handleSave}
            variant="cyan"
            size="sm"
            disabled={!hasChanges || isSaving}
            loading={isSaving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Editor or Preview */}
      <div className="flex-1 overflow-auto">
        {viewMode === "edit" ? (
          <div
            className={cn(
              "h-full",
              // Just make text white in dark mode
              "dark:[&_.mdxeditor]:text-white",
              "dark:[&_.mdxeditor-root-contenteditable]:text-white",
            )}
          >
            <MDXEditor
              className="h-full"
              markdown={content}
              onChange={handleChange}
              plugins={[
                // Core editing plugins
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                thematicBreakPlugin(),
                markdownShortcutPlugin(),

                // Table support
                tablePlugin(),

                // Links and images
                linkPlugin(),
                linkDialogPlugin(),
                imagePlugin(),

                // Code blocks with syntax highlighting
                codeBlockPlugin({ defaultCodeBlockLanguage: "js" }),
                codeMirrorPlugin({
                  codeBlockLanguages: {
                    js: "JavaScript",
                    ts: "TypeScript",
                    tsx: "TypeScript JSX",
                    jsx: "JavaScript JSX",
                    css: "CSS",
                    html: "HTML",
                    python: "Python",
                    bash: "Bash",
                    json: "JSON",
                    markdown: "Markdown",
                  },
                }),

                // Toolbar
                toolbarPlugin({
                  toolbarContents: () => (
                    <>
                      <UndoRedo />
                      <BoldItalicUnderlineToggles />
                      <BlockTypeSelect />
                      <ListsToggle />
                      <CreateLink />
                      <InsertTable />
                      <InsertThematicBreak />
                      <InsertCodeBlock />
                    </>
                  ),
                }),
              ]}
            />
          </div>
        ) : (
          <div className={cn("p-6", glassmorphism.background.subtle)}>
            <div
              className={cn(
                "prose prose-sm max-w-none",
                isDarkMode && "prose-invert",
                "prose-headings:text-gray-800 dark:prose-headings:text-gray-100",
                "prose-p:text-gray-700 dark:prose-p:text-gray-300",
                "prose-a:text-cyan-600 dark:prose-a:text-cyan-400",
                "prose-strong:text-gray-800 dark:prose-strong:text-gray-100",
                "prose-code:text-purple-600 dark:prose-code:text-purple-400",
                "prose-code:bg-gray-100 dark:prose-code:bg-gray-800",
                "prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
                "prose-pre:bg-gray-900 dark:prose-pre:bg-black",
                "prose-pre:border prose-pre:border-gray-700",
                "prose-blockquote:border-cyan-500",
                "prose-blockquote:bg-cyan-50 dark:prose-blockquote:bg-cyan-900/20",
                "prose-li:text-gray-700 dark:prose-li:text-gray-300",
                "[&_table]:border-collapse",
                "[&_th]:border [&_th]:border-gray-300 dark:[&_th]:border-gray-600",
                "[&_th]:bg-gray-100 dark:[&_th]:bg-gray-800",
                "[&_th]:px-4 [&_th]:py-2",
                "[&_td]:border [&_td]:border-gray-300 dark:[&_td]:border-gray-600",
                "[&_td]:px-4 [&_td]:py-2",
              )}
            >
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
