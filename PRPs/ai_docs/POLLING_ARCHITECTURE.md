# Polling Architecture Documentation

## Overview
Archon V2 uses HTTP polling instead of WebSockets for real-time updates. This simplifies the architecture, reduces complexity, and improves maintainability while providing adequate responsiveness for project management tasks.

## Core Components

### 1. usePolling Hook (`archon-ui-main/src/hooks/usePolling.ts`)
Generic polling hook that manages periodic data fetching with smart optimizations.

**Key Features:**
- Configurable polling intervals (default: 5 seconds)
- Automatic pause during browser tab inactivity
- ETag-based caching to reduce bandwidth
- Error retry with exponential backoff
- Manual refresh capability

**Usage:**
```typescript
const { data, isLoading, error, refetch } = usePolling({
  queryKey: ['projects'],
  queryFn: () => projectService.getProjects(),
  interval: 5000,
  enabled: true
});
```

### 2. Polling Service (`archon-ui-main/src/services/pollingService.ts`)
Centralized service managing all polling operations across the application.

**Responsibilities:**
- Coordinates multiple polling endpoints
- Prevents duplicate requests
- Manages polling lifecycle (start/stop/pause)
- Implements request deduplication via cache keys

**Polling Endpoints:**
- `/api/projects` - Project list updates
- `/api/projects/{id}/tasks` - Task list for active project
- `/api/progress/crawl` - Website crawling progress
- `/api/progress/project-creation` - Project creation progress
- `/api/agent-chat/sessions/{id}/messages` - Chat messages

### 3. Progress Service (`archon-ui-main/src/services/progressService.ts`)
Specialized service for tracking long-running operations.

**Features:**
- Separate polling for progress tracking
- Higher frequency updates during active operations (1-2 seconds)
- Automatic cleanup on completion
- Progress percentage calculation

## Backend Support

### ETag Implementation (`python/src/server/utils/etag_utils.py`)
Server-side optimization to reduce unnecessary data transfer.

**How it works:**
1. Server generates ETag hash from response data
2. Client sends `If-None-Match` header with cached ETag
3. Server returns 304 Not Modified if data unchanged
4. Client uses cached data, reducing bandwidth by ~70%

### Progress API (`python/src/server/api_routes/progress_api.py`)
Dedicated endpoints for progress tracking:
- `GET /api/progress/crawl` - Returns crawling status and logs
- `GET /api/progress/project-creation` - Returns project creation status
- Includes completion percentage, current step, and error details

## State Management

### Optimistic Updates
For better UX, UI updates optimistically before server confirmation:

```typescript
// 1. Update UI immediately
setTasks(prev => prev.map(task => 
  task.id === taskId ? { ...task, status: newStatus } : task
));

// 2. Send to server
await projectService.updateTask(taskId, { status: newStatus });

// 3. Refresh to ensure consistency
await onRefresh();
```

### Loading States
Visual feedback during operations:
- `movingTaskIds: Set<string>` - Tracks tasks being moved
- `isSwitchingProject: boolean` - Project transition state
- Loading overlays prevent concurrent operations

## Error Handling

### Retry Strategy
```typescript
retryCount: 3
retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000)
```
- Exponential backoff: 1s, 2s, 4s...
- Maximum retry delay: 30 seconds
- Automatic recovery after network issues

### User Feedback
- Toast notifications for errors
- Loading spinners during operations
- Clear error messages with recovery actions

## Performance Optimizations

### 1. Request Deduplication
Prevents multiple components from making identical requests:
```typescript
const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
if (pendingRequests.has(cacheKey)) {
  return pendingRequests.get(cacheKey);
}
```

### 2. Smart Polling Intervals
- Active operations: 1-2 second intervals
- Background data: 5-10 second intervals
- Paused when tab inactive (visibility API)

### 3. Selective Updates
Only polls active/relevant data:
- Tasks poll only for selected project
- Progress polls only during active operations
- Chat polls only for open sessions

## Migration from Socket.IO

### What Changed
- **Removed:** `socketIOService.ts`, `socketService.ts`, `taskSocketService.ts`
- **Removed:** Socket event handlers (`handleTaskUpdated`, `handleTaskCreated`, etc.)
- **Added:** Polling hooks and services
- **Added:** ETag caching and progress endpoints

### Benefits
- **Simpler architecture** - No persistent connections to manage
- **Better error recovery** - HTTP requests auto-retry
- **Reduced complexity** - ~2,700 lines of code removed
- **Easier debugging** - Standard HTTP requests in DevTools
- **Better scaling** - No WebSocket connection limits

### Trade-offs
- **Latency:** 1-5 second delay vs instant updates
- **Bandwidth:** More requests, but mitigated by ETags
- **Battery:** Slightly higher mobile battery usage

## Developer Guidelines

### Adding New Polling Endpoint

1. **Frontend - Add to polling service:**
```typescript
// In pollingService.ts
export const pollNewData = (params) => {
  return pollEndpoint('/api/new-endpoint', params, {
    interval: 5000,
    enabled: true
  });
};
```

2. **Backend - Add ETag support:**
```python
from ..utils.etag_utils import generate_etag, check_etag

@router.get("/api/new-endpoint")
async def get_data(request: Request):
    data = fetch_data()
    etag = generate_etag(data)
    
    if check_etag(request, etag):
        return Response(status_code=304)
    
    return JSONResponse(
        content=data,
        headers={"ETag": etag}
    )
```

3. **Use in component:**
```typescript
const { data, refetch } = usePolling({
  queryKey: ['new-data'],
  queryFn: () => pollNewData(params),
  interval: 5000
});
```

### Best Practices

1. **Always provide loading states** - Users should know when data is updating
2. **Use optimistic updates** - Update UI immediately, sync with server after
3. **Handle errors gracefully** - Show toast, offer retry, fall back to cached data
4. **Respect polling intervals** - Don't poll faster than necessary
5. **Clean up on unmount** - Cancel pending requests when components unmount

## Testing Polling Behavior

### Manual Testing
1. Open Network tab in DevTools
2. Look for requests with 304 status (cache hits)
3. Verify polling stops when switching tabs
4. Test error recovery by stopping backend

### Debugging Tips
- Check `localStorage` for cached ETags
- Monitor `console.log` for polling lifecycle events
- Use React DevTools to inspect hook states
- Watch for memory leaks in long-running sessions

## Future Improvements

### Planned Enhancements
- WebSocket fallback for critical updates
- Configurable per-user polling rates
- Smart polling based on user activity patterns
- GraphQL subscriptions for selective field updates

### Considered Alternatives
- Server-Sent Events (SSE) - One-way real-time updates
- Long polling - Reduced request frequency
- WebRTC data channels - P2P updates between clients