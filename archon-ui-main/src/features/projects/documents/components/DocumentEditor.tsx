import { useState, useEffect } from 'react';
import { 
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  tablePlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  ListsToggle,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  InsertCodeBlock,
  DiffSourceToggleWrapper,
  BlockTypeSelect,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { Button } from '../../../ui/primitives';
import { Save, Eye, Edit3, Code } from 'lucide-react';
import { cn } from '../../../ui/primitives/styles';
import type { ProjectDocument } from '../types';

interface DocumentEditorProps {
  document: ProjectDocument;
  onSave: (document: ProjectDocument) => Promise<void>;
  isDarkMode?: boolean;
  className?: string;
}

export const DocumentEditor = ({
  document,
  onSave,
  isDarkMode = false,
  className
}: DocumentEditorProps) => {
  const [content, setContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'source' | 'rich'>('rich');

  // Convert document content to markdown string
  const getMarkdownContent = () => {
    if (typeof document.content === 'string') {
      return document.content;
    }
    
    if (document.content && typeof document.content === 'object') {
      // If content has a markdown field, use it
      if (document.content.markdown) {
        return document.content.markdown;
      }
      
      // Otherwise, convert the content object to a readable markdown format
      let markdown = `# ${document.title}\n\n`;
      
      Object.entries(document.content).forEach(([key, value]) => {
        const sectionTitle = key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1);
        markdown += `## ${sectionTitle}\n\n`;
        
        if (Array.isArray(value)) {
          value.forEach(item => {
            markdown += `- ${item}\n`;
          });
          markdown += '\n';
        } else if (typeof value === 'object' && value !== null) {
          Object.entries(value as any).forEach(([subKey, subValue]) => {
            markdown += `**${subKey}:** ${subValue}\n\n`;
          });
        } else {
          markdown += `${value}\n\n`;
        }
      });
      
      return markdown;
    }
    
    return `# ${document.title}\n\nStart writing...`;
  };

  useEffect(() => {
    setContent(getMarkdownContent());
    setHasChanges(false);
  }, [document.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...document,
        content: { markdown: content }
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  return (
    <div className={cn(
      "flex flex-col h-full",
      className
    )}>
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            {document.title}
          </h2>
          {hasChanges && (
            <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded">
              Unsaved changes
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setViewMode(viewMode === 'source' ? 'rich' : 'source')}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {viewMode === 'source' ? (
              <>
                <Eye className="w-4 h-4" />
                Rich View
              </>
            ) : (
              <>
                <Code className="w-4 h-4" />
                Source
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

      {/* MDXEditor */}
      <div className={cn(
        "flex-1 overflow-auto",
        isDarkMode ? "mdxeditor-dark" : "mdxeditor-light"
      )}>
        <MDXEditor
          className={cn(
            "h-full",
            isDarkMode && "[&_.cm-editor]:bg-gray-900 [&_.cm-editor]:text-gray-100"
          )}
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
            codeBlockPlugin({ defaultCodeBlockLanguage: 'js' }),
            codeMirrorPlugin({ 
              codeBlockLanguages: {
                js: 'JavaScript',
                ts: 'TypeScript',
                tsx: 'TypeScript JSX',
                jsx: 'JavaScript JSX',
                css: 'CSS',
                html: 'HTML',
                python: 'Python',
                bash: 'Bash',
                json: 'JSON',
                markdown: 'Markdown'
              }
            }),
            
            // Source/preview toggle
            diffSourcePlugin({ 
              viewMode: viewMode as any,
              diffMarkdown: content
            }),
            
            // Frontmatter support
            frontmatterPlugin(),
            
            // Toolbar
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <DiffSourceToggleWrapper>
                    <UndoRedo />
                    <BoldItalicUnderlineToggles />
                    <ListsToggle />
                    <BlockTypeSelect />
                    <CreateLink />
                    <InsertTable />
                    <InsertThematicBreak />
                    <InsertCodeBlock />
                  </DiffSourceToggleWrapper>
                </>
              )
            })
          ]}
        />
      </div>

      {/* Custom styles for dark mode */}
      <style jsx global>{`
        .mdxeditor-dark {
          --accentColor: #06b6d4;
          --background-color: #111827;
          --foreground-color: #f3f4f6;
          --border-color: #374151;
        }
        
        .mdxeditor-dark .mdxeditor {
          background-color: var(--background-color);
          color: var(--foreground-color);
        }
        
        .mdxeditor-dark .mdxeditor-toolbar {
          background-color: #1f2937;
          border-color: var(--border-color);
        }
        
        .mdxeditor-dark .mdxeditor-toolbar button {
          color: var(--foreground-color);
        }
        
        .mdxeditor-dark .mdxeditor-toolbar button:hover {
          background-color: #374151;
        }
        
        .mdxeditor-dark .mdxeditor-toolbar button[data-state="on"] {
          background-color: #06b6d4;
          color: white;
        }
      `}</style>
    </div>
  );
};