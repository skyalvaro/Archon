# Socket.IO v4 Room Management Best Practices

## Critical Concepts

### Room Fundamentals
- **Rooms are server-side only** - Clients don't know what rooms they're in
- **Automatic cleanup** - Sockets leave all rooms on disconnect automatically
- **Default room** - Every socket joins a room with its socket.id by default
- **Multiple rooms** - A socket can be in multiple rooms simultaneously

### Broadcasting Patterns

```javascript
// EXCLUDE sender (most common for updates)
socket.to("room").emit("event", data);  // Others in room
socket.broadcast.to("room").emit();     // Same effect

// INCLUDE all (for system messages)
io.to("room").emit("event", data);      // Everyone in room
io.in("room").emit();                   // Alias for io.to()

// EXCLUDE specific rooms
socket.to("room1").except("room2").emit();
```

## React Integration Patterns

### 1. Singleton Socket Manager
```typescript
class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  
  static getInstance(): SocketManager {
    if (!this.instance) {
      this.instance = new SocketManager();
    }
    return this.instance;
  }
  
  connect(): Socket {
    if (!this.socket) {
      this.socket = io({
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }
    return this.socket;
  }
}
```

### 2. Room Lifecycle Hook
```typescript
function useSocketRoom(roomId: string, handlers: EventHandlers) {
  const socket = useSocket(); // From context
  
  useEffect(() => {
    if (!socket || !roomId) return;
    
    // Join room
    socket.emit('join_room', roomId);
    
    // Register handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });
    
    // Cleanup
    return () => {
      socket.emit('leave_room', roomId);
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [roomId, socket]); // Handlers excluded for stability
}
```

## Deduplication Strategies

### 1. Event ID Based
```typescript
class EventDeduplicator {
  private processedEvents = new Map<string, number>();
  private windowMs = 100; // Dedup window
  
  isDuplicate(eventId: string): boolean {
    const now = Date.now();
    const processed = this.processedEvents.get(eventId);
    
    if (processed && now - processed < this.windowMs) {
      return true;
    }
    
    this.processedEvents.set(eventId, now);
    this.cleanup();
    return false;
  }
  
  private cleanup() {
    const cutoff = Date.now() - this.windowMs;
    for (const [id, time] of this.processedEvents) {
      if (time < cutoff) {
        this.processedEvents.delete(id);
      }
    }
  }
}
```

### 2. Echo Prevention
```typescript
class EchoPrevention {
  private clientId = `client-${Date.now()}-${Math.random()}`;
  
  emit(socket: Socket, event: string, data: any) {
    const payload = {
      ...data,
      _meta: {
        sourceId: this.clientId,
        timestamp: Date.now(),
        eventId: `${this.clientId}-${Date.now()}`
      }
    };
    
    // Use socket.to() to exclude self
    socket.to(roomId).emit(event, payload);
    
    // Handle optimistic update locally
    this.handleOptimisticUpdate(data);
  }
  
  isEcho(event: any): boolean {
    return event._meta?.sourceId === this.clientId;
  }
}
```

## Drag & Drop Synchronization

### Problem Areas
1. **Re-renders during drag** - State updates break drag operation
2. **Race conditions** - Socket update vs optimistic update
3. **Order conflicts** - Multiple clients reordering simultaneously

### Solutions

```typescript
// 1. Stable references during drag
const DraggableTask = memo(({ task, index }) => {
  // Memoize drag spec to prevent recreation
  const dragSpec = useMemo(() => ({
    type: 'TASK',
    item: { id: task.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [task.id, index]); // Only depend on ID and index
  
  const [{ isDragging }, drag] = useDrag(dragSpec);
  
  return <div ref={drag}>...</div>;
});

// 2. Deferred socket updates
const useOptimisticDragDrop = () => {
  const [pendingUpdates, setPendingUpdates] = useState(new Set());
  
  const handleDrop = useCallback((item, newPosition) => {
    const updateId = `${item.id}-${Date.now()}`;
    
    // Mark as pending
    setPendingUpdates(prev => new Set(prev).add(updateId));
    
    // Optimistic update
    updateTasksOptimistically(item.id, newPosition);
    
    // Deferred socket emission
    requestIdleCallback(() => {
      socket.emit('task_reorder', {
        taskId: item.id,
        position: newPosition,
        updateId
      }, (ack) => {
        // Remove from pending
        setPendingUpdates(prev => {
          const next = new Set(prev);
          next.delete(updateId);
          return next;
        });
      });
    });
  }, []);
  
  // Ignore socket updates for pending items
  const handleSocketUpdate = useCallback((event) => {
    const isPending = Array.from(pendingUpdates).some(
      id => id.startsWith(event.taskId)
    );
    
    if (!isPending) {
      applyServerUpdate(event);
    }
  }, [pendingUpdates]);
};
```

## Connection State Recovery

### Built-in Recovery (Socket.IO v4.6+)
```typescript
const socket = io({
  connectionStateRecovery: {
    // How long to store state after disconnect
    maxDisconnectionDuration: 2 * 60 * 1000,
    // Skip auth middleware on recovery
    skipMiddlewares: true,
  }
});

socket.on('connect', () => {
  if (socket.recovered) {
    console.log('State recovered, missed events replayed');
  } else {
    console.log('New connection, fetch full state');
    fetchInitialState();
  }
});
```

### Manual Recovery Pattern
```typescript
class StateRecovery {
  private lastEventId: string | null = null;
  private missedEvents: any[] = [];
  
  onConnect(socket: Socket) {
    if (this.lastEventId) {
      // Request missed events
      socket.emit('get_missed_events', {
        since: this.lastEventId,
        room: this.currentRoom
      }, (events) => {
        this.replayEvents(events);
      });
    } else {
      // Fresh start
      socket.emit('get_initial_state', this.currentRoom);
    }
  }
  
  onEvent(event: any) {
    this.lastEventId = event.id;
    this.processEvent(event);
  }
  
  private replayEvents(events: any[]) {
    // Apply in order without triggering UI updates
    events.forEach(event => {
      this.processEvent(event, { silent: true });
    });
    // Single UI update at end
    this.triggerUIRefresh();
  }
}
```

## Performance Optimizations

### 1. Event Batching
```typescript
class EventBatcher {
  private queue: any[] = [];
  private timer: number | null = null;
  private batchMs = 50;
  
  add(event: any) {
    this.queue.push(event);
    
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.batchMs);
    }
  }
  
  private flush() {
    if (this.queue.length === 0) return;
    
    const batch = [...this.queue];
    this.queue = [];
    this.timer = null;
    
    // Process as single update
    processBatch(batch);
  }
}
```

### 2. Selective Updates
```typescript
// Only subscribe to relevant events
socket.on('task_updated', (event) => {
  // Check if task is visible
  if (!isTaskVisible(event.taskId)) {
    return; // Skip UI update
  }
  
  updateTask(event);
});

// Unsubscribe from invisible content
const visibleProjects = getVisibleProjects();
socket.emit('subscribe', { projects: visibleProjects });
```

## Common Pitfalls & Solutions

### Pitfall 1: Multiple Socket Instances
```typescript
// ❌ BAD: Creates new socket each render
function Component() {
  const socket = io(); // New instance!
  // ...
}

// ✅ GOOD: Singleton pattern
function Component() {
  const socket = useSocket(); // From context
  // ...
}
```

### Pitfall 2: Event Handler Memory Leaks
```typescript
// ❌ BAD: Creates new handler each render
useEffect(() => {
  socket.on('event', (data) => { // New function!
    setState(data);
  });
}, [state]); // Re-runs on state change!

// ✅ GOOD: Stable handler reference
const handleEvent = useCallback((data) => {
  setState(data);
}, []);

useEffect(() => {
  socket.on('event', handleEvent);
  return () => socket.off('event', handleEvent);
}, [handleEvent]);
```

### Pitfall 3: Race Conditions
```typescript
// ❌ BAD: Optimistic update races with socket
const updateTask = (task) => {
  setTasks(prev => updateArray(prev, task));
  socket.emit('update_task', task);
};

socket.on('task_updated', (task) => {
  setTasks(prev => updateArray(prev, task)); // Conflict!
});

// ✅ GOOD: Track pending updates
const updateTask = (task) => {
  const updateId = generateId();
  setPending(prev => new Set(prev).add(updateId));
  
  setTasks(prev => updateArray(prev, task));
  
  socket.emit('update_task', { ...task, updateId }, () => {
    setPending(prev => {
      const next = new Set(prev);
      next.delete(updateId);
      return next;
    });
  });
};

socket.on('task_updated', (event) => {
  if (!pending.has(event.updateId)) {
    setTasks(prev => updateArray(prev, event.task));
  }
});
```