---
name: "Toast Migration to Features Directory - Radix UI Implementation"
description: "Migrate toast notifications from legacy context to Radix UI primitives within features vertical slice architecture"
---

## Original Story

```
Check import { useToast } from "../../../contexts/ToastContext"; import in archon-ui-main/src/features/projects/tasks/TasksTab.tsx and any other places its used in our archon-ui-main/src/features directory. We are currently mid-migration. We are migrating things from outside of the features directory into the vertical slice architecture that we have now established inside of the features directory. And now this toast context and toast usage is something that we want to migrate into the features directory at least for the things that already live inside of the features directory. So it's okay to have some sort of duplicate toast. So one context for outside features and one context for inside of features. And inside of features we of course want to use Radix primitives following the established UI in Glassmorphism Tron style things that we have inside the project and we want to use TanStack Query whenever appropriate following all of the patterns that we have already established inside of the features directory.
```

## Story Metadata

**Story Type**: Refactor/Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: 
- UI primitives layer (features/ui/primitives)
- 13 feature files using toast notifications
- TanStack Query mutation callbacks
- App-level provider hierarchy

---

## CONTEXT REFERENCES

[Auto-discovered documentation and patterns]

- archon-ui-main/src/features/ui/primitives/dialog.tsx - Radix UI component wrapping pattern with forwardRef
- archon-ui-main/src/features/ui/primitives/styles.ts - Glassmorphism utilities and animation presets
- archon-ui-main/src/features/projects/hooks/useProjectQueries.ts - TanStack Query mutation with toast integration pattern
- archon-ui-main/src/contexts/ToastContext.tsx - Current toast implementation API to replicate
- archon-ui-main/package.json - Missing @radix-ui/react-toast dependency
- archon-ui-main/test/setup.ts - Test utilities and mocking patterns
- archon-ui-main/biome.json - Biome configuration for features directory (120 char, double quotes)

---

## IMPLEMENTATION TASKS

### Guidelines for Tasks

- We are using information dense keywords to be specific and concise about implementation steps and details
- The tasks have to be detailed and specific to ensure clarity and accuracy
- The developer who will execute the tasks should be able to complete the task using only the context of this file, with references to relevant codebase paths and integration points

### INSTALL archon-ui-main/package.json:

- ADD: "@radix-ui/react-toast" dependency using npm install
- VERIFY: Package appears in dependencies section
- VERSION: Use latest stable version (^1.1.5 or higher)
- **VALIDATE**: `npm ls @radix-ui/react-toast && echo "✓ Radix Toast installed"`

### CREATE archon-ui-main/src/features/ui/primitives/toast.tsx:

- IMPLEMENT: Radix Toast primitive wrappers following dialog.tsx pattern
- PATTERN: Follow archon-ui-main/src/features/ui/primitives/dialog.tsx structure
- IMPORTS: import * as ToastPrimitive from "@radix-ui/react-toast"; import { cn, glassmorphism } from "./styles"
- COMPONENTS: Export ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastAction, ToastClose
- STYLING: Apply glassmorphism.background.card, glassmorphism.border variants, glassmorphism.shadow.glow effects
- VARIANTS: Create variant prop with "default", "success", "error", "warning" using established color schemes
- POSITIONING: Fixed top-right with z-[100], max-width 420px, padding 4
- ANIMATIONS: Use glassmorphism.animation.fadeIn and data-[swipe=end] attributes
- GOTCHA: Use forwardRef for all styled components with proper displayName assignment
- **VALIDATE**: `npm run biome src/features/ui/primitives/toast.tsx && echo "✓ Toast primitive created"`

### CREATE archon-ui-main/src/features/ui/hooks/useToast.ts:

- IMPLEMENT: Toast hook with same API as current ToastContext (showToast function)
- PATTERN: Follow hook patterns from archon-ui-main/src/features/ui/hooks/useSmartPolling.ts
- STATE: Use useState for toast array management with unique IDs
- INTERFACE: showToast(message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number = 4000)
- QUEUE: Support multiple toasts with stacked display
- AUTO_DISMISS: Use setTimeout for auto-dismiss with cleanup on unmount
- ICONS: Import CheckCircle, XCircle, Info, AlertCircle from lucide-react
- EXPORTS: Export useToast hook and toast type definitions
- **VALIDATE**: `npx tsc --noEmit src/features/ui/hooks/useToast.ts && echo "✓ Hook type-safe"`

### CREATE archon-ui-main/src/features/ui/components/ToastProvider.tsx:

- IMPLEMENT: React context provider wrapping Radix ToastProvider
- PATTERN: Follow provider pattern similar to legacy ToastContext
- CONTEXT: Create ToastContext with showToast function
- STATE: Manage toast array with add/remove functions
- RENDER: Map toasts to Toast components with proper keys
- VIEWPORT: Include ToastViewport at provider level
- DURATION: Default 4000ms with customizable per-toast duration
- SWIPE: Enable swipe-to-dismiss on mobile with direction="right"
- **VALIDATE**: `npm run biome src/features/ui/components/ToastProvider.tsx && echo "✓ Provider created"`

### UPDATE archon-ui-main/src/features/ui/primitives/index.ts:

- ADD: export * from "./toast"
- FIND: Last export statement in file
- INSERT: New export after existing primitives exports
- **VALIDATE**: `grep -q "export.*toast" src/features/ui/primitives/index.ts && echo "✓ Toast exports added"`

### UPDATE archon-ui-main/src/features/projects/tasks/TasksTab.tsx:

- FIND: import { useToast } from "../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../ui/hooks/useToast"
- GOTCHA: Verify relative path is correct (../../ui/hooks/useToast)
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/tasks/TasksTab.tsx && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/views/ProjectsView.tsx:

- FIND: import { useToast } from "../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/views/ProjectsView.tsx && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/tasks/hooks/useTaskEditor.ts:

- FIND: import { useToast } from "../../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/tasks/hooks/useTaskEditor.ts && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/tasks/hooks/useTaskActions.ts:

- FIND: import { useToast } from "../../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/tasks/hooks/useTaskActions.ts && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/hooks/useProjectQueries.ts:

- FIND: import { useToast } from "../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/hooks/useProjectQueries.ts && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/tasks/hooks/useTaskQueries.ts:

- FIND: import { useToast } from "../../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/tasks/hooks/useTaskQueries.ts && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/documents/components/DocumentEditor.tsx:

- FIND: import { useToast } from "../../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/documents/components/DocumentEditor.tsx && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/documents/components/VersionHistoryModal.tsx:

- FIND: import { useToast } from "../../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/documents/components/VersionHistoryModal.tsx && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/documents/hooks/useDocumentQueries.ts:

- FIND: import { useToast } from "../../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/documents/hooks/useDocumentQueries.ts && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/documents/hooks/useDocumentActions.ts:

- FIND: import { useToast } from "../../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/documents/hooks/useDocumentActions.ts && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/documents/DocsTab.tsx:

- FIND: import { useToast } from "../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/documents/DocsTab.tsx && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/components/ProjectCardActions.tsx:

- FIND: import { useToast } from "../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/components/ProjectCardActions.tsx && echo "✓ Import updated"`

### UPDATE archon-ui-main/src/features/projects/tasks/components/TaskCardActions.tsx:

- FIND: import { useToast } from "../../../../contexts/ToastContext"
- REPLACE: import { useToast } from "../../../ui/hooks/useToast"
- **VALIDATE**: `grep -q "ui/hooks/useToast" src/features/projects/tasks/components/TaskCardActions.tsx && echo "✓ Import updated"`

### CREATE archon-ui-main/test/features/ui/hooks/useToast.test.ts:

- IMPLEMENT: Test suite for useToast hook
- PATTERN: Follow test patterns from existing hook tests
- IMPORTS: import { renderHook, act } from '@testing-library/react'; import { describe, it, expect, vi, beforeEach } from 'vitest'
- TESTS: showToast function exists, toast appears with correct props, auto-dismiss after duration, multiple toasts stack
- TIMERS: Use vi.useFakeTimers() and vi.advanceTimersByTime() for auto-dismiss testing
- CLEANUP: Test cleanup on unmount with vi.clearAllTimers()
- **VALIDATE**: `vitest run test/features/ui/hooks/useToast.test.ts && echo "✓ Hook tests pass"`

### CREATE archon-ui-main/test/features/ui/primitives/toast.test.tsx:

- IMPLEMENT: Component tests for Toast primitives
- PATTERN: Follow component test patterns from test directory
- IMPORTS: import { render, screen, fireEvent } from '@testing-library/react'; import '@testing-library/jest-dom/vitest'
- TESTS: Render toast with variants, close button functionality, action button clicks, accessibility attributes
- MOCKS: Mock lucide-react icons with vi.mock('lucide-react')
- ASSERTIONS: Test role="alert", aria-live attributes, focus management
- **VALIDATE**: `vitest run test/features/ui/primitives/toast.test.tsx && echo "✓ Component tests pass"`

### UPDATE archon-ui-main/src/App.tsx:

- FIND: ToastProvider import from contexts/ToastContext
- ADD: FeaturesToastProvider import from features/ui/components/ToastProvider
- WRAP: Features content with FeaturesToastProvider while keeping legacy ToastProvider for non-features
- NOTE: Maintain dual toast systems during migration period
- **VALIDATE**: `npm run dev && curl -f http://localhost:3737 && echo "✓ App starts successfully"`

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file creation - fix before proceeding
cd archon-ui-main

# Biome for features directory
npm run biome:ai-fix              # Auto-fix features directory issues
npm run biome                     # Verify fixes applied

# TypeScript checking
npx tsc --noEmit 2>&1 | grep "src/features"  # Check features only
npx tsc --noEmit                  # Full type check

# Expected: Zero errors. If errors exist, READ output and fix before proceeding.
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test new toast implementation
vitest run test/features/ui/hooks/useToast.test.ts
vitest run test/features/ui/primitives/toast.test.tsx

# Run all frontend tests to ensure no regressions
npm run test:coverage:stream

# Expected: All tests pass with 100% coverage for new toast files
```

### Level 3: Integration Testing (System Validation)

```bash
# Start development server
npm run dev &
sleep 3  # Allow startup time

# Manual validation checklist:
# 1. Navigate to Projects page
# 2. Create a new project - should show success toast (top-right, green glow)
# 3. Update project name - should show success toast
# 4. Trigger an error (invalid input) - should show error toast (red glow)
# 5. Create multiple toasts rapidly - should stack vertically
# 6. Wait 4 seconds - toasts should auto-dismiss
# 7. Click X on toast - should dismiss immediately
# 8. Check browser console - no errors or warnings

# Validate all 13 files still function correctly:
# - Projects view (create, update, delete)
# - Tasks tab (create, update, delete, status changes)
# - Documents tab (save, version, restore)
# - All mutations should show appropriate toasts

# Expected: All toast notifications appear with glassmorphism styling
```

### Level 4: Creative & Domain-Specific Validation

```bash
# MCP Server Validation (if connected)
# Test that toast notifications work with MCP operations

# Archon MCP validation
echo '{"method": "tools/call", "params": {"name": "create_project", "arguments": {"title": "Test Toast"}}}' | \
  docker exec -i archon-mcp python -m src.main

# Verify toast appears when operation completes

# Browser automation with Playwright MCP (if available)
# Navigate to app and trigger toast scenarios programmatically
playwright-mcp --url http://localhost:3737 --test-toast-notifications

# Performance validation
# Check that multiple toasts don't cause performance issues
# Monitor React DevTools Profiler during toast operations
```

---

## COMPLETION CHECKLIST

- [ ] @radix-ui/react-toast installed
- [ ] Toast primitive created with glassmorphism styling
- [ ] useToast hook implemented with same API
- [ ] ToastProvider component created
- [ ] All 13 import statements updated
- [ ] Tests written and passing
- [ ] Biome validation passes for features directory
- [ ] TypeScript compilation succeeds
- [ ] Manual testing shows all toasts working
- [ ] No console errors in browser
- [ ] Dual toast system working (legacy for non-features, new for features)
- [ ] Story acceptance criteria met

---

## Notes

- Migration maintains backward compatibility by keeping dual toast systems
- Legacy ToastContext remains for components outside features directory
- New Radix implementation follows all established patterns in features
- Glassmorphism styling consistent with existing UI primitives
- TanStack Query integration preserved in mutation callbacks
- Future task: Migrate remaining non-features components to new toast system

<!-- EOF -->