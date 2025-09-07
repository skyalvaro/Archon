import { useQuery } from "@tanstack/react-query";
import { knowledgeBaseService } from "../services/knowledgeBaseService";

interface TagSuggestionsResult {
  data?: string[];
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
}

/**
 * Hook to fetch and manage tag suggestions from knowledge base
 * Uses TanStack Query for caching and deduplication
 */
export const useTagSuggestions = (): TagSuggestionsResult => {
  const queryResult = useQuery({
    queryKey: ["knowledge-base", "tags", "suggestions"],
    queryFn: async (): Promise<string[]> => {
      try {
        // Get all knowledge items to extract tags
        const response = await knowledgeBaseService.getKnowledgeItems({ per_page: 1000 });
        
        // Extract all tags from all items
        const allTags: string[] = [];
        const tagFrequency: Record<string, number> = {};
        
        response.items.forEach(item => {
          if (item.metadata.tags && Array.isArray(item.metadata.tags)) {
            item.metadata.tags.forEach(tag => {
              if (typeof tag === 'string' && tag.trim()) {
                const cleanTag = tag.trim();
                allTags.push(cleanTag);
                tagFrequency[cleanTag] = (tagFrequency[cleanTag] || 0) + 1;
              }
            });
          }
        });
        
        // Deduplicate and sort by frequency (most used first)
        const uniqueTags = Array.from(new Set(allTags));
        const sortedTags = uniqueTags.sort((a, b) => {
          const freqA = tagFrequency[a] || 0;
          const freqB = tagFrequency[b] || 0;
          
          // Sort by frequency (descending), then alphabetically if same frequency
          if (freqA !== freqB) {
            return freqB - freqA;
          }
          return a.toLowerCase().localeCompare(b.toLowerCase());
        });
        
        // eslint-disable-next-line no-console
        console.log(`📋 [TagSuggestions] Found ${sortedTags.length} unique tags from ${response.items.length} items`);
        // eslint-disable-next-line no-console
        console.log(`📋 [TagSuggestions] Top tags:`, sortedTags.slice(0, 10));
        
        return sortedTags;
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? `Failed to fetch tag suggestions: ${error.message}` 
          : 'Failed to fetch tag suggestions: Unknown error occurred';
        
        console.error('❌ [TagSuggestions] Error details:', error);
        throw new Error(errorMessage); // Let TanStack Query handle the error state
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2, // Retry failed requests twice
    retryDelay: 1000, // Wait 1 second between retries
  });

  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    isError: queryResult.isError,
  };
};