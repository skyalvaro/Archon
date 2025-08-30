import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, FileText, Globe, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';

interface DocumentChunk {
  id: string;
  source_id: string;
  content: string;
  metadata?: any;
  url?: string;
}

interface DocumentBrowserProps {
  sourceId: string;
  isOpen: boolean;
  onClose: () => void;
}

const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Remove 'www.' prefix if present
    const withoutWww = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    
    // For domains with subdomains, extract the main domain (last 2 parts)
    const parts = withoutWww.split('.');
    if (parts.length > 2) {
      // Return the main domain (last 2 parts: domain.tld)
      return parts.slice(-2).join('.');
    }
    
    return withoutWww;
  } catch {
    return url; // Return original if URL parsing fails
  }
};

export const DocumentBrowser: React.FC<DocumentBrowserProps> = ({
  sourceId,
  isOpen,
  onClose,
}) => {
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract unique domains from chunks
  const domains = useMemo(() => {
    const domainSet = new Set<string>();
    chunks.forEach(chunk => {
      if (chunk.url) {
        domainSet.add(extractDomain(chunk.url));
      }
    });
    return Array.from(domainSet).sort();
  }, [chunks]);

  // Filter chunks based on search and domain
  const filteredChunks = useMemo(() => {
    return chunks.filter(chunk => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const searchMatch = !searchQuery || 
        chunk.content.toLowerCase().includes(searchLower) ||
        chunk.url?.toLowerCase().includes(searchLower);
      
      // Domain filter
      const domainMatch = selectedDomain === 'all' || 
        (chunk.url && extractDomain(chunk.url) === selectedDomain);
      
      return searchMatch && domainMatch;
    });
  }, [chunks, searchQuery, selectedDomain]);

  // Get selected chunk
  const selectedChunk = useMemo(() => {
    return filteredChunks.find(chunk => chunk.id === selectedChunkId) || filteredChunks[0];
  }, [filteredChunks, selectedChunkId]);

  // Load chunks when component opens
  useEffect(() => {
    if (isOpen && sourceId) {
      loadChunks();
    }
  }, [isOpen, sourceId]);

  const loadChunks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await knowledgeBaseService.getKnowledgeItemChunks(sourceId);
      
      if (response.success) {
        setChunks(response.chunks);
        // Auto-select first chunk if none selected
        if (response.chunks.length > 0 && !selectedChunkId) {
          setSelectedChunkId(response.chunks[0].id);
        }
      } else {
        setError('Failed to load document chunks');
      }
    } catch (error) {
      console.error('Failed to load chunks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load document chunks');
    } finally {
      setLoading(false);
    }
  };

  const loadChunksWithDomainFilter = async (domain: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const domainFilter = domain === 'all' ? undefined : domain;
      const response = await knowledgeBaseService.getKnowledgeItemChunks(sourceId, domainFilter);
      
      if (response.success) {
        setChunks(response.chunks);
      } else {
        setError('Failed to load document chunks');
      }
    } catch (error) {
      console.error('Failed to load chunks with domain filter:', error);
      setError(error instanceof Error ? error.message : 'Failed to load document chunks');
    } finally {
      setLoading(false);
    }
  };

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain);
    // Note: We could reload with server-side filtering, but for now we'll do client-side filtering
    // loadChunksWithDomainFilter(domain);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-7xl h-[90vh] relative before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-[1px] before:bg-blue-500 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Document Browser ({(filteredChunks || []).length})
            </h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Document List */}
          <div className="w-80 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
            {/* Search and Filter */}
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 space-y-3">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                icon={<Search className="w-4 h-4" />}
                accentColor="blue"
              />
              
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-500" />
                <Select
                  value={selectedDomain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                  className="flex-1"
                  options={[
                    { value: 'all', label: 'All Domains' },
                    ...(domains?.map(domain => ({ value: domain, label: domain })) || [])
                  ]}
                />
              </div>
            </div>

            {/* Document List */}
            <div 
              className="flex-1 overflow-y-scroll"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgb(59 130 246) rgb(229 231 235)'
              }}
            >
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-500">
                  <p className="mb-2 text-sm">Error: {error}</p>
                  <Button onClick={loadChunks} variant="secondary" size="sm">
                    Retry
                  </Button>
                </div>
              ) : (filteredChunks || []).length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-zinc-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No document chunks found</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {(filteredChunks || []).map((chunk, index) => (
                    <div
                      key={chunk.id}
                      onClick={() => setSelectedChunkId(chunk.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedChunk?.id === chunk.id
                          ? 'bg-blue-500/20 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                          : 'hover:bg-gray-100 dark:hover:bg-zinc-800/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge color="blue" size="sm">
                          {index + 1}
                        </Badge>
                        {chunk.url && (
                          <Badge color="gray" size="sm" className="flex items-center gap-1">
                            <Globe className="w-2 h-2" />
                            {extractDomain(chunk.url)}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-700 dark:text-gray-300 overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {chunk.content?.substring(0, 100) || 'No content'}...
                      </div>
                      
                      {chunk.url && (
                        <div className="text-xs text-blue-500 dark:text-blue-400 mt-1 truncate">
                          {chunk.url}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedChunk ? (
              <>
                {/* Content Header */}
                <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Document Chunk
                    </h3>
                    {selectedChunk.url && (
                      <Badge color="blue" className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {extractDomain(selectedChunk.url)}
                      </Badge>
                    )}
                  </div>
                  
                  {selectedChunk.url && (
                    <div className="text-sm text-blue-500 dark:text-blue-400 truncate">
                      {selectedChunk.url}
                    </div>
                  )}
                </div>

                {/* Content Body */}
                <div 
                  className="flex-1 overflow-y-scroll p-6"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgb(59 130 246) rgb(229 231 235)'
                  }}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {selectedChunk.content || 'No content available'}
                    </div>
                  </div>
                  
                  {selectedChunk.metadata && (
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-zinc-800">
                      <details className="text-sm text-gray-500 dark:text-zinc-500">
                        <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300 font-medium">
                          View Metadata
                        </summary>
                        <pre className="mt-3 bg-gray-50 dark:bg-zinc-900 p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedChunk.metadata, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-zinc-400">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a document chunk to view its content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};