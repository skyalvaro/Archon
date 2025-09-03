/**
 * Projects Feature Module
 *
 * Vertical slice containing all project-related functionality:
 * - Project management (CRUD, selection)
 * - Task management (CRUD, status, board, table views)
 * - Document management (docs, versioning)
 * - Project dashboard and routing
 */

// Views
export { ProjectsView } from './views/ProjectsView';

// Components
export * from './components';

// Hooks
export * from './hooks';

// Sub-features
export * from './tasks';
export * from './documents';
