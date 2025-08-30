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
      <Card className="w-full max-w-6xl h-[90vh] relative before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-[1px] before:bg-blue-500 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Document Browser
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
          
          {/* Search and Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search document content..."
                icon={<Search className="w-4 h-4" />}
                accentColor="blue"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-500" />
              <Select
                value={selectedDomain}
                onChange={(e) => handleDomainChange(e.target.value)}
                className="min-w-48"
              >
                <option value="all">All Domains</option>
                {domains?.map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                )) || []}
              </Select>
            </div>
            
            <div className="flex items-center text-sm text-gray-500 dark:text-zinc-400">
              <Filter className="w-4 h-4 mr-1" />
              {(filteredChunks || []).length} / {(chunks || []).length} chunks
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-zinc-400">Loading document chunks...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-500">
                <p className="mb-2">Error: {error}</p>
                <Button onClick={loadChunks} variant="secondary" size="sm">
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6">
              <AnimatePresence>
                {(filteredChunks || []).length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 text-gray-500 dark:text-zinc-400"
                  >
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No document chunks found for the current filter.</p>
                    {searchQuery && (
                      <p className="mt-2 text-sm">
                        Try adjusting your search terms or domain filter.
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {(filteredChunks || []).map((chunk, index) => (
                      <motion.div
                        key={chunk.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Badge color="blue" size="sm">
                                Chunk {index + 1}
                              </Badge>
                              {chunk.url && (
                                <Badge color="gray" size="sm" className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {extractDomain(chunk.url)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {chunk.url && (
                            <div className="text-xs text-blue-500 dark:text-blue-400 mb-2 truncate">
                              {chunk.url}
                            </div>
                          )}
                          
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {chunk.content || 'No content available'}
                            </div>
                          </div>
                          
                          {chunk.metadata && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-800">
                              <details className="text-xs text-gray-500 dark:text-zinc-500">
                                <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300">
                                  View Metadata
                                </summary>
                                <pre className="mt-2 bg-gray-50 dark:bg-zinc-900 p-2 rounded text-xs overflow-x-auto">
                                  {JSON.stringify(chunk.metadata, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};