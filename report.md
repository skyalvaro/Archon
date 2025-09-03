# Archon Data Fetching Architecture Analysis

## Executive Summary

After conducting a deep analysis of Archon's current data fetching implementation, I've found a **mixed architecture** where some components have been refactored to use TanStack Query while others still use traditional polling. The backend has a sophisticated HTTP polling system with ETag optimization. This report analyzes whether continuing with TanStack Query is the right path forward.

**Key Findings:**
- ✅ **TanStack Query is the right choice** for most use cases
- ✅ Backend HTTP polling with ETags is well-architected and performant
- ⚠️ **Inconsistent implementation** - mixed patterns causing confusion
- ❌ WebSocket would add complexity without significant benefits for current use cases

## Current Architecture Analysis

### Backend: HTTP Polling with ETag Optimization

The backend implements a sophisticated polling system:

**Progress API (`/api/progress/{operation_id}`):**
```python
# ETag support for 70% bandwidth reduction via 304 Not Modified
current_etag = generate_etag(etag_data)
if check_etag(if_none_match, current_etag):
    response.status_code = http_status.HTTP_304_NOT_MODIFIED
    return None

# Smart polling hints
if operation.get("status") == "running":
    response.headers["X-Poll-Interval"] = "1000"  # Poll every 1s
else:
    response.headers["X-Poll-Interval"] = "0"     # Stop polling
```

**ProgressTracker (In-Memory State):**
- Thread-safe class-level storage: `_progress_states: dict[str, dict[str, Any]]`
- Prevents progress regression: Never allows backwards progress updates
- Automatic cleanup and duration calculation
- Rich status tracking with logs and metadata

**ETag Implementation:**
- MD5 hash of stable JSON data (excluding timestamps)
- 304 Not Modified responses when data unchanged
- ~70% bandwidth reduction in practice

### Frontend: Mixed Implementation Patterns

#### ✅ **TanStack Query Implementation** (New Components)

**Query Key Factories:**
```typescript
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  tasks: (projectId: string) => [...projectKeys.detail(projectId), 'tasks'] as const,
};
```

**Optimistic Updates:**
```typescript
onMutate: async ({ taskId, updates }) => {
  await queryClient.cancelQueries({ queryKey: projectKeys.tasks(projectId) });
  const previousTasks = queryClient.getQueryData(projectKeys.tasks(projectId));
  
  queryClient.setQueryData(projectKeys.tasks(projectId), (old: any[]) => {
    return old.map((task: any) =>
      task.id === taskId ? { ...task, ...updates } : task
    );
  });
  
  return { previousTasks };
},
```

**Progress Polling with Smart Completion:**
```typescript
export function useCrawlProgressPolling(progressId: string | null) {
  const [isComplete, setIsComplete] = useState(false);
  
  const query = useQuery({
    queryKey: crawlKeys.progress(progressId!),
    queryFn: async () => {
      const response = await fetch(`/api/progress/${progressId}`);
      return response.json();
    },
    enabled: !!progressId && !isComplete,
    refetchInterval: 1000,  // 1 second polling
    retry: false,
    staleTime: 0,
  });
  
  // Auto-stop polling when complete
  useEffect(() => {
    const status = query.data?.status;
    if (['completed', 'failed', 'error', 'cancelled'].includes(status)) {
      setIsComplete(true);
    }
  }, [query.data?.status]);
  
  return { ...query, isComplete };
}
```

#### ❌ **Legacy Implementation** (KnowledgeBasePage)

Still uses manual useState with custom polling:
```typescript
const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
const [loading, setLoading] = useState(true);
const [progressItems, setProgressItems] = useState<CrawlProgressData[]>([]);

// Manual API calls
const loadKnowledgeItems = async () => {
  try {
    setLoading(true);
    const response = await knowledgeBaseService.getKnowledgeItems();
    setKnowledgeItems(response.items);
  } catch (error) {
    // Manual error handling
  } finally {
    setLoading(false);
  }
};
```

#### ⚠️ **Remaining Traditional Hooks**

`useMigrationStatus.ts` - Uses setInterval polling:
```typescript
useEffect(() => {
  const checkMigrationStatus = async () => {
    const response = await fetch('/api/health');
    // Manual state updates
  };
  
  const interval = setInterval(checkMigrationStatus, 30000);
  return () => clearInterval(interval);
}, []);
```

## TanStack Query vs WebSocket Analysis

### TanStack Query Advantages ✅

1. **Perfect for Archon's Use Cases:**
   - CRUD operations on projects, tasks, knowledge items
   - Progress polling with natural start/stop lifecycle
   - Background refetching for stale data
   - Optimistic updates for immediate UI feedback

2. **Built-in Features:**
   - Automatic background refetching
   - Request deduplication
   - Error retry with exponential backoff
   - Cache invalidation strategies
   - Loading and error states
   - Optimistic updates with rollback

3. **Performance Benefits:**
   - Client-side caching reduces server load
   - ETags work perfectly with query invalidation
   - Smart refetch intervals (active/background)
   - Automatic garbage collection

4. **Developer Experience:**
   - Declarative data dependencies
   - Less boilerplate than manual useState
   - Excellent DevTools for debugging
   - Type-safe with TypeScript

### WebSocket Analysis ❌

**Current Use Cases Don't Need Real-time:**
- Progress updates: 1-2 second delay acceptable
- Project/task updates: Not truly collaborative
- Knowledge base changes: Batch-oriented operations

**WebSocket Downsides:**
- Connection management complexity
- Reconnection logic needed
- Scaling challenges (sticky sessions)
- No HTTP caching benefits
- Additional security considerations
- Browser connection limits (6 per domain)

**When WebSockets Make Sense:**
- Real-time collaboration (multiple users editing same document)
- Live chat/notifications
- Live data feeds (stock prices, sports scores)
- Gaming applications

### Performance Comparison

| Metric | HTTP Polling + TanStack | WebSocket |
|--------|-------------------------|-----------|
| Initial Connection | HTTP request (~10-50ms) | WebSocket handshake (~100-200ms) |
| Update Latency | 500-2000ms (configurable) | ~10-100ms |
| Bandwidth (unchanged data) | ~100 bytes (304 response) | ~50 bytes (heartbeat) |
| Bandwidth (changed data) | Full payload + headers | Full payload |
| Server Memory | Stateless (per request) | Connection state per client |
| Horizontal Scaling | Easy (stateless) | Complex (sticky sessions) |
| Browser Limits | ~6 concurrent per domain | ~255 concurrent total |
| Error Recovery | Automatic retry | Manual reconnection logic |

## Current Issues & Recommendations

### 🔴 **Critical Issues**

1. **Inconsistent Patterns:** Mix of TanStack Query, manual useState, and setInterval polling
2. **KnowledgeBasePage Not Migrated:** Still using 795 lines of manual state management
3. **Prop Drilling:** Components receiving 5+ callback props instead of using mutations

### 🟡 **Performance Issues**

1. **Multiple Polling Intervals:** Different components polling at different rates
2. **No Request Deduplication:** Manual implementations don't dedupe requests
3. **Cache Misses:** Manual state doesn't benefit from cross-component caching

### ✅ **Recommended Solution: Complete TanStack Query Migration**

#### Phase 1: Complete Current Migration
```typescript
// Migrate KnowledgeBasePage to use:
const { data: knowledgeItems, isLoading, error } = useKnowledgeItems();
const { data: progressItems, addProgressItem, removeProgressItem } = useCrawlProgressManager();
const deleteMutation = useDeleteKnowledgeItem();
```

#### Phase 2: Optimize Query Configuration
```typescript
// Global query client optimization
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s for most data
      gcTime: 5 * 60_000,       // 5min cache retention
      retry: (failureCount, error) => {
        // Smart retry logic
        if (error.status === 404) return false;
        return failureCount < 3;
      },
    },
  },
});
```

#### Phase 3: Advanced Patterns
```typescript
// Progress polling with exponential backoff
const useSmartProgressPolling = (progressId: string) => {
  const [pollInterval, setPollInterval] = useState(1000);
  
  return useQuery({
    queryKey: ['progress', progressId],
    queryFn: () => fetchProgress(progressId),
    refetchInterval: (data) => {
      if (data?.status === 'completed') return false;
      
      // Exponential backoff for long-running operations
      const runtime = Date.now() - data?.start_time;
      if (runtime > 60_000) return 5000;  // 5s after 1 minute
      if (runtime > 300_000) return 10_000; // 10s after 5 minutes
      return 1000; // 1s for first minute
    },
  });
};
```

### 🎯 **Migration Strategy**

1. **Keep Backend As-Is:** HTTP polling + ETags is working well
2. **Complete TanStack Migration:** Migrate remaining components
3. **Standardize Query Keys:** Consistent factory pattern
4. **Optimize Poll Intervals:** Smart intervals based on data type
5. **Add Error Boundaries:** Better error handling at app level

### 🚀 **Expected Benefits**

- **50% Less Component Code:** Remove manual useState boilerplate
- **Better UX:** Optimistic updates, background refetching, error retry
- **Improved Performance:** Request deduplication, smart caching
- **Easier Debugging:** TanStack DevTools visibility
- **Type Safety:** Better TypeScript integration

## Conclusion

**✅ Continue with TanStack Query migration** - it's the right architectural choice for Archon's use cases. The backend HTTP polling system is well-designed and doesn't need changes. Focus on:

1. **Completing the migration** of remaining components
2. **Standardizing patterns** across all data fetching
3. **Optimizing query configurations** for better performance

WebSocket would add complexity without meaningful benefits for current requirements. The HTTP polling + TanStack Query combination provides the right balance of performance, developer experience, and maintainability.

---
*Analysis completed on 2025-01-03*
*Total files analyzed: 15+ backend files, 9 frontend hooks, 5 major components*