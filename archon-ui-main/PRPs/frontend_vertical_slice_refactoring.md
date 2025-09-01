# Frontend Vertical Slice Refactoring Plan

## Overview

This document outlines a comprehensive refactoring plan to transform the current monolithic project management frontend into a vertical slice architecture, following the backend's modular approach.

## Current State Analysis

### Complexity Issues
- **ProjectPage.tsx**: 1,053 lines - massive monolithic component
- **projectService.ts**: 614 lines - large service file handling everything
- **project-tasks components**: 7,300+ lines across 14 components
- **Total project-related code**: ~8,300+ lines scattered across multiple locations

### Current Structure Problems
- Monolithic ProjectPage handling all project concerns
- Large service layer mixing different responsibilities
- Components scattered in `project-tasks/` directory
- No clear feature boundaries
- Difficult to maintain and test individual features

## Proposed Vertical Slice Architecture

Following the backend architecture pattern defined in `PRPs/ai_docs/ARCHITECTURE.md`, we propose creating a `features/projects/` structure:

```
src/
├── features/
│   └── projects/                          # Project Management Feature Module
│       ├── index.ts                       # Feature exports
│       ├── shared/                        # Shared within projects context
│       │   ├── types/                     # Project-specific types
│       │   │   ├── project.ts
│       │   │   ├── task.ts
│       │   │   └── document.ts
│       │   ├── services/                  # Base project services
│       │   │   ├── api.ts                 # Base API client
│       │   │   └── validation.ts          # Shared validation
│       │   ├── hooks/                     # Project-specific hooks
│       │   │   ├── useProjectPolling.ts
│       │   │   └── useTaskPolling.ts
│       │   └── utils/                     # Project utilities
│       │       └── constants.ts
│       │
│       └── features/                      # Individual feature slices
│           ├── project-management/        # Project CRUD
│           │   ├── components/
│           │   │   ├── ProjectList.tsx
│           │   │   ├── ProjectCard.tsx
│           │   │   ├── CreateProjectModal.tsx
│           │   │   └── DeleteProjectModal.tsx
│           │   ├── hooks/
│           │   │   ├── useProjects.tsx
│           │   │   ├── useCreateProject.tsx
│           │   │   └── useDeleteProject.tsx
│           │   ├── services/
│           │   │   └── projectService.ts  # Project-specific operations
│           │   └── index.ts
│           │
│           ├── task-management/           # Task CRUD & Status
│           │   ├── components/
│           │   │   ├── TaskList.tsx
│           │   │   ├── TaskCard.tsx
│           │   │   ├── EditTaskModal.tsx
│           │   │   └── TaskStatusBadge.tsx
│           │   ├── hooks/
│           │   │   ├── useTasks.tsx
│           │   │   ├── useCreateTask.tsx
│           │   │   └── useUpdateTask.tsx
│           │   ├── services/
│           │   │   └── taskService.ts
│           │   └── index.ts
│           │
│           ├── task-board/               # Kanban Board & Drag-Drop
│           │   ├── components/
│           │   │   ├── TaskBoard.tsx
│           │   │   ├── TaskColumn.tsx
│           │   │   ├── DraggableTaskCard.tsx
│           │   │   └── TaskBoardView.tsx (refactored)
│           │   ├── hooks/
│           │   │   ├── useTaskDragDrop.tsx
│           │   │   └── useTaskReordering.tsx
│           │   ├── services/
│           │   │   └── taskOrderingService.ts
│           │   └── utils/
│           │       └── dragDropUtils.ts
│           │
│           ├── task-table/               # Table View
│           │   ├── components/
│           │   │   ├── TaskTable.tsx
│           │   │   ├── TaskTableRow.tsx
│           │   │   └── TaskTableFilters.tsx
│           │   ├── hooks/
│           │   │   └── useTaskTable.tsx
│           │   └── services/
│           │       └── taskTableService.ts
│           │
│           ├── document-management/       # Project Documents
│           │   ├── components/
│           │   │   ├── DocumentList.tsx
│           │   │   ├── DocumentCard.tsx
│           │   │   ├── CreateDocumentModal.tsx
│           │   │   └── MilkdownEditor.tsx (moved)
│           │   ├── hooks/
│           │   │   ├── useDocuments.tsx
│           │   │   └── useCreateDocument.tsx
│           │   ├── services/
│           │   │   └── documentService.ts
│           │   └── index.ts
│           │
│           ├── version-history/          # Document Versioning
│           │   ├── components/
│           │   │   ├── VersionHistory.tsx
│           │   │   ├── VersionHistoryModal.tsx (moved)
│           │   │   └── VersionCompare.tsx
│           │   ├── hooks/
│           │   │   └── useVersionHistory.tsx
│           │   ├── services/
│           │   │   └── versionService.ts
│           │   └── index.ts
│           │
│           ├── project-data/             # Data/Features Tab
│           │   ├── components/
│           │   │   ├── DataTab.tsx (moved)
│           │   │   ├── FeaturesTab.tsx (moved)
│           │   │   └── ProjectData.tsx
│           │   ├── hooks/
│           │   │   └── useProjectData.tsx
│           │   ├── services/
│           │   │   └── dataService.ts
│           │   └── index.ts
│           │
│           └── project-dashboard/        # Main Project View
│               ├── components/
│               │   ├── ProjectDashboard.tsx  # New simplified ProjectPage
│               │   ├── ProjectTabs.tsx       # Tab navigation
│               │   └── ProjectHeader.tsx     # Project info header
│               ├── hooks/
│               │   └── useProjectDashboard.tsx
│               └── index.ts
│
├── pages/
│   └── ProjectPage.tsx                    # Simplified, delegates to ProjectDashboard
│
└── components/
    └── ui/                               # Keep shared UI components
        ├── Button.tsx
        ├── Tabs.tsx
        └── ...
```

## Key Refactoring Benefits

### 1. Clear Separation of Concerns
- Each feature slice handles one specific capability
- No more mixing task management with document management
- Easier to test individual features

### 2. Reduced File Sizes
- Break down 1,053-line ProjectPage into focused components
- Split 614-line projectService into feature-specific services
- Each component becomes more manageable (100-300 lines)

### 3. Feature Independence
- Features can be developed/deployed independently
- Easy to disable features via feature flags
- Clear boundaries prevent coupling

### 4. Improved Developer Experience
- Easier to find code related to specific features
- Better code organization and navigation
- Simpler testing strategy per feature

### 5. Migration Path
- Can be done incrementally, feature by feature
- Start with one slice (e.g., task-board) and migrate others
- No breaking changes to existing functionality

## Current File Mapping

### Files to be Refactored

**From `src/pages/ProjectPage.tsx` (1,053 lines):**
- Extract project selection logic → `project-management/`
- Extract tab navigation → `project-dashboard/`
- Extract delete modals → respective feature slices

**From `src/services/projectService.ts` (614 lines):**
- Project operations → `project-management/services/projectService.ts`
- Task operations → `task-management/services/taskService.ts`
- Document operations → `document-management/services/documentService.ts`
- Version operations → `version-history/services/versionService.ts`

**From `src/components/project-tasks/`:**
- `TasksTab.tsx` → Split between `task-board/` and `task-table/`
- `TaskBoardView.tsx` → `task-board/components/TaskBoardView.tsx`
- `TaskTableView.tsx` → `task-table/components/TaskTable.tsx`
- `DraggableTaskCard.tsx` → `task-board/components/DraggableTaskCard.tsx`
- `EditTaskModal.tsx` → `task-management/components/EditTaskModal.tsx`
- `DocsTab.tsx` → `document-management/components/DocumentList.tsx`
- `DocumentCard.tsx` → `document-management/components/DocumentCard.tsx`
- `MilkdownEditor.tsx` → `document-management/components/MilkdownEditor.tsx`
- `VersionHistoryModal.tsx` → `version-history/components/VersionHistoryModal.tsx`
- `DataTab.tsx` → `project-data/components/DataTab.tsx`
- `FeaturesTab.tsx` → `project-data/components/FeaturesTab.tsx`
- `Tabs.tsx` → Keep in `components/ui/` (shared)

**From `src/types/project.ts`:**
- Split into feature-specific type files in each slice's shared types

## Implementation Strategy

### Phase 1: Create Structure & Shared Components (Week 1)

**Step 1.1: Create Directory Structure**
```bash
mkdir -p src/features/projects/{shared/{types,services,hooks,utils},features}
mkdir -p src/features/projects/features/{project-management,task-management,task-board,task-table,document-management,version-history,project-data,project-dashboard}/{components,hooks,services,utils}
```

**Step 1.2: Move Shared Types**
- Extract and split `src/types/project.ts`
- Create `src/features/projects/shared/types/`
- Set up barrel exports in `src/features/projects/shared/index.ts`

**Step 1.3: Move Shared Utilities**
- Move `src/lib/task-utils.tsx` → `src/features/projects/shared/utils/`
- Move `src/lib/projectSchemas.ts` → `src/features/projects/shared/services/validation.ts`
- Extract shared polling hooks → `src/features/projects/shared/hooks/`

### Phase 2: Extract Individual Features (Weeks 2-4)

**Step 2.1: Start with Task Board (Most Self-Contained)**
- Move `TaskBoardView.tsx` → `task-board/components/`
- Move `DraggableTaskCard.tsx` → `task-board/components/`
- Extract drag-drop logic from `TasksTab.tsx` → `task-board/hooks/useTaskDragDrop.tsx`
- Create `task-board/services/taskOrderingService.ts`
- Test in isolation

**Step 2.2: Extract Task Table View**
- Move `TaskTableView.tsx` → `task-table/components/TaskTable.tsx`
- Extract table logic from `TasksTab.tsx` → `task-table/hooks/useTaskTable.tsx`
- Create `task-table/services/taskTableService.ts`

**Step 2.3: Extract Task Management**
- Move `EditTaskModal.tsx` → `task-management/components/`
- Extract task CRUD from `projectService.ts` → `task-management/services/taskService.ts`
- Create task-specific hooks in `task-management/hooks/`

**Step 2.4: Extract Document Management**
- Move `DocsTab.tsx` → `document-management/components/DocumentList.tsx`
- Move `DocumentCard.tsx` → `document-management/components/`
- Move `MilkdownEditor.tsx` → `document-management/components/`
- Extract document logic from `projectService.ts` → `document-management/services/documentService.ts`

**Step 2.5: Extract Version History**
- Move `VersionHistoryModal.tsx` → `version-history/components/`
- Extract versioning logic → `version-history/services/versionService.ts`
- Create version-specific hooks

**Step 2.6: Extract Project Data**
- Move `DataTab.tsx` → `project-data/components/`
- Move `FeaturesTab.tsx` → `project-data/components/`
- Create data management hooks and services

**Step 2.7: Extract Project Management**
- Extract project CRUD from `projectService.ts` → `project-management/services/projectService.ts`
- Extract project selection logic from `ProjectPage.tsx`
- Create project management components and hooks

### Phase 3: Create Project Dashboard (Week 5)

**Step 3.1: Create Simplified Dashboard**
- Create `project-dashboard/components/ProjectDashboard.tsx`
- Move tab navigation logic → `project-dashboard/components/ProjectTabs.tsx`
- Create project header → `project-dashboard/components/ProjectHeader.tsx`
- Integrate all feature slices

**Step 3.2: Simplify ProjectPage**
- Refactor `src/pages/ProjectPage.tsx` to just route to `ProjectDashboard`
- Remove all business logic, keep only routing

### Phase 4: Clean Up & Testing (Week 6)

**Step 4.1: Remove Old Structure**
- Delete `src/components/project-tasks/` directory
- Update all imports across the codebase
- Update test files to match new structure

**Step 4.2: Integration Testing**
- Test all features work together
- Test feature flags and toggles
- Performance testing
- Update documentation

**Step 4.3: Update Barrel Exports**
- Create clean export structure from `src/features/projects/index.ts`
- Ensure easy imports for external components

## Code Organization Rules

### 1. Features are Self-Contained
- All code for a feature lives together
- Components, hooks, services, and types co-located
- Each feature has its own barrel export

### 2. No Cross-Feature Imports
- Features can only import from:
  - Their own components/hooks/services
  - Shared project utilities (`../shared/`)
  - Global shared components (`../../../components/ui/`)
- Use project shared or API calls for cross-feature communication

### 3. Shared is Minimal
- Only truly cross-cutting concerns go in `shared/`
- Types used by multiple features
- Common validation logic
- Shared API utilities

### 4. Dependencies Point Inward
- Features → Project Shared → Global Shared
- No circular dependencies
- Clear dependency hierarchy

## Testing Strategy

### Unit Tests
- Each feature has its own test directory
- Test components in isolation
- Mock external dependencies

### Integration Tests
- Test feature boundaries
- Test shared utilities
- Test API integrations

### E2E Tests
- Test complete user flows
- Test cross-feature interactions
- Test optimistic updates and error handling

## Migration Benefits

### Developer Experience
- **Easier Navigation**: Find task board code in `task-board/`, not mixed with documents
- **Focused Development**: Work on one feature without touching others
- **Clearer Testing**: Test individual features in isolation
- **Better Onboarding**: New developers can understand one feature at a time

### Maintainability
- **Reduced Coupling**: Changes in task management don't affect document management
- **Clear Boundaries**: Each feature has well-defined responsibilities
- **Feature Flags**: Easy to disable/enable entire features
- **Future Microservices**: Structure supports extraction to separate services

### Performance
- **Code Splitting**: Load only needed features
- **Smaller Bundles**: Tree-shake unused features
- **Lazy Loading**: Load features on demand

## Risk Mitigation

### Incremental Migration
- Migrate one feature at a time
- Keep old and new structure in parallel during transition
- Gradual testing and validation

### Import Management
- Use barrel exports to control API surface
- Create migration scripts for import updates
- Automated linting for import rules

### Testing Coverage
- Maintain test coverage during migration
- Test both old and new implementations
- Integration tests for boundary validation

## Success Metrics

### Code Quality
- Reduce average file size from 500+ lines to <300 lines
- Improve test coverage per feature
- Reduce coupling between features

### Developer Productivity
- Faster feature development
- Easier bug fixes and maintenance
- Reduced time to onboard new developers

### Feature Independence
- Ability to deploy features independently
- Easy feature toggling
- Clear feature boundaries

This refactoring aligns the frontend architecture with the backend's vertical slice approach, creating a more maintainable, scalable, and developer-friendly codebase.