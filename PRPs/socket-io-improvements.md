name: "Socket.IO Real-time Updates Enhancement PRP v1"
description: |

---

## Goal

**Feature Goal**: Implement robust, performant Socket.IO management with proper room-based isolation, echo prevention, and optimized React state synchronization for drag-and-drop operations

**Deliverable**: Enhanced socket management system with proper room management, state reconciliation, and UI synchronization for Projects Page (docs/tasks tabs)

**Success Definition**: Zero duplicate events, instant UI updates, no echo issues, proper drag-and-drop reordering synchronization across all connected clients

## User Persona

**Target User**: Developers and team members using Archon UI

**Use Case**: Real-time collaboration on project tasks and documents with drag-and-drop reordering

**User Journey**: 
1. User opens project page → joins project-specific room
2. User performs drag-drop action → UI updates optimistically
3. Socket broadcasts change → all other clients update
4. Disconnection/reconnection → state recovery without duplicates

**Pain Points Addressed**: 
- Document deletion errors not reflecting in UI
- Task reordering not syncing properly
- Duplicate events causing UI inconsistencies
- Echo issues when user's own actions broadcast back

## Why

- Current implementation has race conditions between optimistic updates and socket events
- Multiple socket connections cause duplicate event handling
- No proper room isolation leading to cross-project event pollution
- Drag-and-drop operations don't sync properly due to improper state reconciliation

## What

Implement a centralized socket management system with:
- Singleton socket connection per namespace
- Room-based event isolation
- Event deduplication and echo prevention
- Optimistic update reconciliation
- Proper React memoization for drag-drop operations

### Success Criteria

- [ ] Single socket connection per namespace
- [ ] Events isolated to project rooms
- [ ] No duplicate events or echo issues
- [ ] Drag-drop operations sync in <100ms
- [ ] Connection recovery preserves state
- [ ] Document operations update UI immediately

## All Needed Context

### Context Completeness Check

_All Socket.IO v4 best practices, room management patterns, and React integration strategies are documented below_

### Documentation & References

```yaml
- url: https://socket.io/docs/v4/rooms#joining-and-leaving
  why: Core room management patterns - join(), leave(), to() methods
  critical: Rooms are server-side only, clients don't know their rooms

- url: https://socket.io/docs/v4/server-api#socket-to-room
  why: Broadcasting patterns excluding sender using socket.to()
  critical: socket.to() excludes sender, io.to() includes all

- url: https://socket.io/docs/v4/connection-state-recovery
  why: Automatic state recovery after disconnections
  critical: Enable connectionStateRecovery for seamless reconnections

- file: archon-ui-main/src/services/socketIOService.ts
  why: Current WebSocketService implementation with deduplication
  pattern: Singleton service pattern with message handlers map
  gotcha: Already has deduplication window but not properly utilized

- file: archon-ui-main/src/hooks/useTaskSocket.ts
  why: Task-specific socket hook with project room management
  pattern: Component-level handler registration pattern
  gotcha: Multiple components can register handlers causing duplicates

- file: archon-ui-main/src/components/project-tasks/TaskTableView.tsx
  why: Drag-drop implementation with react-dnd
  pattern: Optimistic updates followed by API calls
  gotcha: State updates during drag cause re-renders disrupting DnD

- docfile: PRPs/ai_docs/socketio-room-patterns.md
  why: Comprehensive Socket.IO v4 room management patterns
  section: Room Management Best Practices
```

### Current Codebase Tree

```bash
archon-ui-main/
├── src/
│   ├── services/
│   │   ├── socketIOService.ts       # Base WebSocket service
│   │   ├── taskSocketService.ts     # Task-specific socket service
│   │   └── projectService.ts        # API calls for projects/tasks
│   ├── hooks/
│   │   └── useTaskSocket.ts         # Task socket hook
│   ├── pages/
│   │   └── ProjectPage.tsx          # Main project page
│   └── components/
│       └── project-tasks/
│           ├── TasksTab.tsx          # Task management tab
│           ├── DocsTab.tsx           # Documents tab
│           └── TaskTableView.tsx     # Drag-drop task view
```

### Desired Codebase Tree with Files

```bash
archon-ui-main/
├── src/
│   ├── services/
│   │   ├── socket/
│   │   │   ├── SocketManager.ts        # Centralized socket manager
│   │   │   ├── RoomManager.ts          # Room join/leave logic
│   │   │   ├── EventDeduplicator.ts    # Dedup & echo prevention
│   │   │   └── index.ts                # Exports
│   │   ├── socketIOService.ts          # Enhanced base service
│   │   └── taskSocketService.ts        # Enhanced task service
│   ├── hooks/
│   │   ├── useSocketRoom.ts            # Generic room management hook
│   │   └── useTaskSocket.ts            # Enhanced task socket hook
│   └── contexts/
│       └── SocketContext.tsx           # Socket provider for app
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Socket.IO v4 rooms are server-side only
// Clients don't track their room membership

// GOTCHA: socket.to() vs io.to() behavior
socket.to("room").emit() // Excludes sender
io.to("room").emit()     // Includes all in room

// GOTCHA: React re-renders during drag operations
// Must memoize drag handlers and use stable references

// CRITICAL: Socket.IO auto-reconnect can cause duplicate handlers
// Must cleanup and re-register on reconnection
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// Event tracking for deduplication
interface SocketEvent {
  id: string;          // Unique event ID
  type: string;        // Event type
  projectId: string;   // Room identifier
  timestamp: number;   // For ordering
  sourceId: string;    // Client that initiated
  data: any;          // Event payload
}

// Room state management
interface RoomState {
  projectId: string;
  joinedAt: number;
  lastEventId: string;
  pendingAcks: Set<string>;
}

// Connection state
interface SocketState {
  connected: boolean;
  currentRoom: string | null;
  reconnectCount: number;
  lastActivity: number;
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE src/services/socket/EventDeduplicator.ts
  - IMPLEMENT: EventDeduplicator class with sliding window dedup
  - FOLLOW pattern: Map-based deduplication with TTL
  - NAMING: isEcho(), isDuplicate(), trackEvent() methods
  - PLACEMENT: Utility class used by socket services

Task 2: CREATE src/services/socket/RoomManager.ts
  - IMPLEMENT: RoomManager class for join/leave/switch operations
  - FOLLOW pattern: State machine for room transitions
  - NAMING: joinRoom(), leaveRoom(), switchRoom() methods
  - DEPENDENCIES: EventDeduplicator for tracking room events
  - PLACEMENT: Service layer for room management

Task 3: CREATE src/services/socket/SocketManager.ts
  - IMPLEMENT: Singleton SocketManager with namespace support
  - FOLLOW pattern: Singleton with lazy initialization
  - NAMING: getInstance(), getSocket(), ensureConnected() methods
  - DEPENDENCIES: RoomManager, EventDeduplicator
  - PLACEMENT: Core socket management layer

Task 4: MODIFY src/services/socketIOService.ts
  - INTEGRATE: Use SocketManager for connection management
  - ENHANCE: Add event metadata (eventId, sourceId, timestamp)
  - ADD: Echo prevention using socket.to() instead of io.emit()
  - PRESERVE: Existing WebSocketService interface

Task 5: CREATE src/contexts/SocketContext.tsx
  - IMPLEMENT: React context for socket state and operations
  - FOLLOW pattern: Provider with useSocket hook
  - NAMING: SocketProvider, useSocket, useSocketRoom hooks
  - DEPENDENCIES: SocketManager instance
  - PLACEMENT: Context wrapper at app level

Task 6: CREATE src/hooks/useSocketRoom.ts
  - IMPLEMENT: Generic room management hook
  - FOLLOW pattern: Effect-based room lifecycle
  - NAMING: useSocketRoom(roomId, handlers) signature
  - DEPENDENCIES: SocketContext
  - PLACEMENT: Reusable hook for any room-based feature

Task 7: MODIFY src/hooks/useTaskSocket.ts
  - REFACTOR: Use useSocketRoom internally
  - ENHANCE: Add optimistic update reconciliation
  - ADD: Event source tracking for echo prevention
  - PRESERVE: Existing hook interface

Task 8: MODIFY src/components/project-tasks/TaskTableView.tsx
  - FIX: Memoize drag handlers with useCallback
  - ADD: Stable task order during drag operations
  - IMPLEMENT: Reconciliation for socket updates during drag
  - PRESERVE: Existing drag-drop functionality

Task 9: MODIFY src/components/project-tasks/DocsTab.tsx
  - INTEGRATE: Use useSocketRoom for document updates
  - FIX: Document deletion UI updates
  - ADD: Optimistic updates with rollback
  - PRESERVE: Existing document operations

Task 10: CREATE src/services/socket/__tests__/
  - IMPLEMENT: Unit tests for deduplication logic
  - TEST: Room switching scenarios
  - MOCK: Socket.IO client for testing
  - COVERAGE: Echo prevention and state recovery
```

### Implementation Patterns & Key Details

```typescript
// Singleton Socket Manager Pattern
class SocketManager {
  private static instance: SocketManager;
  private sockets: Map<string, Socket> = new Map();
  
  static getInstance(): SocketManager {
    if (!this.instance) {
      this.instance = new SocketManager();
    }
    return this.instance;
  }
  
  getSocket(namespace = '/'): Socket {
    if (!this.sockets.has(namespace)) {
      const socket = io(namespace, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        // CRITICAL: Enable connection state recovery
        connectionStateRecovery: {
          maxDisconnectionDuration: 2 * 60 * 1000,
          skipMiddlewares: true,
        }
      });
      this.sockets.set(namespace, socket);
    }
    return this.sockets.get(namespace)!;
  }
}

// Echo Prevention Pattern
class TaskSocketService {
  private clientId = `client-${Date.now()}-${Math.random()}`;
  
  broadcastTaskUpdate(task: Task) {
    const event = {
      id: `${this.clientId}-${Date.now()}`,
      sourceId: this.clientId,
      type: 'task_updated',
      data: task,
      timestamp: Date.now()
    };
    
    // PATTERN: Track our own events to ignore echo
    this.eventDeduplicator.trackEvent(event.id, event.sourceId);
    
    // CRITICAL: Use socket.to() to exclude sender
    this.socket.to(`project:${task.projectId}`).emit('task_updated', event);
  }
  
  handleTaskUpdate(event: SocketEvent) {
    // PATTERN: Ignore our own events (echo prevention)
    if (this.eventDeduplicator.isEcho(event.sourceId)) {
      return;
    }
    
    // PATTERN: Ignore duplicate events
    if (this.eventDeduplicator.isDuplicate(event.id)) {
      return;
    }
    
    // Process the update
    this.updateTaskInUI(event.data);
  }
}

// Optimistic Update Reconciliation
const useTaskDragDrop = () => {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Task>>();
  
  // PATTERN: Stable drag handler with optimistic update
  const handleDrop = useCallback((draggedTask: Task, newStatus: string) => {
    const optimisticId = `opt-${Date.now()}`;
    
    // Optimistic update
    setTasks(prev => updateTaskStatus(prev, draggedTask.id, newStatus));
    setOptimisticUpdates(prev => new Map(prev).set(draggedTask.id, { 
      ...draggedTask, 
      status: newStatus,
      optimisticId 
    }));
    
    // Server update with reconciliation
    socket.emit('task_reorder', { 
      taskId: draggedTask.id, 
      newStatus,
      optimisticId 
    }, (ack) => {
      // PATTERN: Remove optimistic update after server confirms
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.delete(draggedTask.id);
        return next;
      });
    });
  }, [socket]);
  
  // PATTERN: Reconcile socket updates with optimistic updates
  const handleSocketTaskUpdate = useCallback((event: SocketEvent) => {
    const task = event.data;
    
    // Skip if we have an optimistic update for this task
    if (optimisticUpdates.has(task.id)) {
      return; // Let the optimistic update resolve first
    }
    
    // Apply the server update
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
  }, [optimisticUpdates]);
  
  return { handleDrop, handleSocketTaskUpdate };
};
```

### Integration Points

```yaml
SOCKET_SERVER:
  - enhancement: "Add event metadata to all emissions"
  - pattern: "{ id, sourceId, timestamp, type, data }"

REACT_APP:
  - add to: src/App.tsx
  - pattern: "<SocketProvider><App /></SocketProvider>"

VITE_PROXY:
  - verify: vite.config.ts
  - pattern: "'/socket.io': { target: 'http://localhost:8181', ws: true }"

DRAG_DROP:
  - enhance: TaskTableView.tsx
  - pattern: "useMemo for DragSource/DropTarget specs"
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# TypeScript and linting checks
npm run lint --workspace=archon-ui-main
npm run type-check --workspace=archon-ui-main

# Expected: Zero errors, all files properly typed
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test deduplication logic
npm run test --workspace=archon-ui-main -- EventDeduplicator

# Test room management
npm run test --workspace=archon-ui-main -- RoomManager

# Test socket hooks
npm run test --workspace=archon-ui-main -- useSocketRoom

# Expected: 100% pass rate, >80% coverage on socket logic
```

### Level 3: Integration Testing (System Validation)

```bash
# Start dev server
npm run dev --workspace=archon-ui-main

# Test socket connection
# 1. Open browser DevTools
# 2. Check Network > WS tab for socket.io connection
# 3. Verify single connection per namespace

# Test room isolation
# 1. Open two browser tabs
# 2. Navigate to different projects
# 3. Verify events don't cross projects

# Test drag-drop sync
# 1. Open same project in two tabs
# 2. Drag task in tab 1
# 3. Verify immediate update in tab 2 (<100ms)

# Test echo prevention
# 1. Monitor console for duplicate events
# 2. Perform any action
# 3. Verify no "echo" of own events

# Expected: All scenarios pass without errors
```

### Level 4: Performance & Edge Cases

```bash
# Connection recovery test
# 1. Open project page
# 2. Disable network in DevTools
# 3. Make changes (drag tasks)
# 4. Re-enable network
# 5. Verify state recovers properly

# Rapid action test
# 1. Rapidly drag multiple tasks
# 2. Verify no UI glitches
# 3. Check final state consistency

# Load test
# 1. Open 5+ tabs on same project
# 2. Perform simultaneous actions
# 3. Verify all tabs stay in sync

# Memory leak test
# 1. Navigate between projects 20+ times
# 2. Check DevTools Memory profiler
# 3. Verify no growing heap/listeners

# Expected: Graceful handling, no memory leaks, consistent state
```

## Final Validation Checklist

### Technical Validation

- [ ] Single socket connection per namespace verified
- [ ] No duplicate event handlers in DevTools
- [ ] Echo prevention working (no self-events)
- [ ] Drag-drop syncs in <100ms
- [ ] Connection recovery maintains state
- [ ] No memory leaks after extended use

### Feature Validation

- [ ] Document deletion updates UI immediately
- [ ] Task reordering syncs across all clients
- [ ] Project room isolation verified
- [ ] Optimistic updates feel instant
- [ ] No UI glitches during rapid actions

### Code Quality Validation

- [ ] All TypeScript strict mode passes
- [ ] Socket handlers properly memoized
- [ ] Event listeners cleaned up on unmount
- [ ] Proper error boundaries around socket code
- [ ] Comprehensive logging for debugging

### Documentation & Deployment

- [ ] Socket event types documented
- [ ] Room naming conventions documented
- [ ] Debug instructions in README
- [ ] Performance metrics logged

---

## Anti-Patterns to Avoid

- ❌ Don't create multiple socket connections for same namespace
- ❌ Don't use io.emit() when sender should be excluded
- ❌ Don't forget to cleanup listeners on unmount
- ❌ Don't update state during drag operations
- ❌ Don't trust client-sent event IDs for dedup
- ❌ Don't block UI on socket acknowledgments
- ❌ Don't store socket instances in React state