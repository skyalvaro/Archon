import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Minus, Replace, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { KnowledgeItem, knowledgeBaseService } from '../../services/knowledgeBaseService';
import { TagSuggestions } from './TagSuggestions';
import { EditableTags } from './EditableTags';
import { useTagSuggestions } from '../../hooks/useTagSuggestions';

interface BulkTagEditorProps {
  selectedItems: KnowledgeItem[];
  onClose: () => void;
  onUpdate: () => void;
}

interface BulkOperationResult {
  sourceId: string;
  title: string;
  success: boolean;
  error?: string;
}

export const BulkTagEditor: React.FC<BulkTagEditorProps> = ({
  selectedItems,
  onClose,
  onUpdate,
}) => {
  const [selectedTag, setSelectedTag] = useState('');
  const [replaceTags, setReplaceTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BulkOperationResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { data: tagSuggestions = [], isLoading: isLoadingSuggestions, error: suggestionsError } = useTagSuggestions();

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isProcessing]);

  const performBulkOperation = async (
    operation: 'add' | 'remove' | 'replace',
    tagsToProcess: string[]
  ) => {
    if (tagsToProcess.length === 0) return;

    setIsProcessing(true);
    setResults([]);
    setShowResults(true);

    // Process items in batches of 5 for better performance
    const batchSize = 5;
    const batches: KnowledgeItem[][] = [];
    for (let i = 0; i < selectedItems.length; i += batchSize) {
      batches.push(selectedItems.slice(i, i + batchSize));
    }

    const allResults: BulkOperationResult[] = [];

    try {
      for (const batch of batches) {
        const batchPromises = batch.map(async (item): Promise<BulkOperationResult> => {
          try {
            const currentTags = item.metadata.tags || [];
            let newTags: string[] = [];

            switch (operation) {
              case 'add':
                // Add tags that don't already exist
                newTags = [...new Set([...currentTags, ...tagsToProcess])];
                break;
              case 'remove':
                // Remove specified tags
                newTags = currentTags.filter(tag => !tagsToProcess.includes(tag));
                break;
              case 'replace':
                // Replace all tags with new ones
                newTags = [...tagsToProcess];
                break;
            }

            await knowledgeBaseService.updateKnowledgeItemTags(item.source_id, newTags);

            return {
              sourceId: item.source_id,
              title: item.title,
              success: true,
            };
          } catch (error) {
            return {
              sourceId: item.source_id,
              title: item.title,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        setResults([...allResults]); // Update results incrementally
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
    } finally {
      setIsProcessing(false);
      onUpdate(); // Refresh the parent component
    }
  };

  const handleAddTags = () => {
    if (selectedTag.trim()) {
      performBulkOperation('add', [selectedTag.trim()]);
      setSelectedTag('');
    }
  };

  const handleRemoveTags = () => {
    if (selectedTag.trim()) {
      performBulkOperation('remove', [selectedTag.trim()]);
      setSelectedTag('');
    }
  };

  const handleReplaceTags = async () => {
    performBulkOperation('replace', replaceTags);
  };

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm"
      onClick={!isProcessing ? onClose : undefined}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Purple accent line at the top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_20px_5px_rgba(168,85,247,0.5)] z-10 rounded-t-xl"></div>
        
        <Card className="relative overflow-hidden h-full">
          <div className="flex flex-col h-full max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Bulk Tag Editor
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Editing tags for {selectedItems.length} items
                </p>
              </div>
              <button
                onClick={!isProcessing ? onClose : undefined}
                disabled={isProcessing}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Tag Operations */}
              {!showResults && (
                <div className="space-y-6">
                  {/* Add/Remove Tags Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                      Add or Remove Tags
                    </h3>
                    
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <TagSuggestions
                          suggestions={tagSuggestions || []}
                          onSelect={setSelectedTag}
                          placeholder="Select or type a tag..."
                          isLoading={isLoadingSuggestions}
                          allowCustomValue={true}
                        />
                      </div>
                      <Button
                        onClick={handleAddTags}
                        disabled={!selectedTag.trim() || isProcessing}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="w-4 h-4" />
                        Add to All
                      </Button>
                      <Button
                        onClick={handleRemoveTags}
                        disabled={!selectedTag.trim() || isProcessing}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Minus className="w-4 h-4" />
                        Remove from All
                      </Button>
                    </div>
                  </div>

                  {/* Replace All Tags Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                      Replace All Tags
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This will replace all existing tags with the tags you specify below.
                    </p>
                    
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <EditableTags
                        tags={replaceTags}
                        onTagsUpdate={async (tags) => {
                          setReplaceTags(tags);
                        }}
                        maxVisibleTags={10}
                        isUpdating={false}
                      />
                    </div>
                    
                    <Button
                      onClick={handleReplaceTags}
                      disabled={isProcessing}
                      className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      <Replace className="w-4 h-4" />
                      Replace All Tags
                    </Button>
                  </div>
                </div>
              )}

              {/* Results Section */}
              {showResults && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                      Operation Results
                    </h3>
                    <div className="flex gap-4 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        {successCount} Success
                      </span>
                      {errorCount > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          {errorCount} Failed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {results.map((result) => (
                      <div
                        key={result.sourceId}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          result.success
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="font-medium text-sm">
                            {result.title}
                          </span>
                        </div>
                        {result.error && (
                          <span className="text-xs text-red-600">
                            {result.error}
                          </span>
                        )}
                      </div>
                    ))}
                    
                    {isProcessing && results.length < selectedItems.length && (
                      <div className="flex items-center justify-center p-3">
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Processing... ({results.length}/{selectedItems.length})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              {showResults ? (
                <Button
                  onClick={onClose}
                  disabled={isProcessing}
                  accentColor="purple"
                >
                  Done
                </Button>
              ) : (
                <Button
                  onClick={onClose}
                  variant="outline"
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>,
    document.body
  );
};