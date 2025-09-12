# TASK PRP: Rebase bugfix-issue-362 onto main

## Task Overview
Rebase the bugfix-issue-362 branch (33 commits of OpenAI error handling improvements) onto main branch (includes TanStack Query Migration Phase 3) while preserving all error handling functionality and adapting to the new architecture.

## Analysis Process

### Scope Definition
- **Affected Files**: 
  - `archon-ui-main/src/pages/KnowledgeBasePage.tsx` (conflict)
  - `archon-ui-main/src/services/knowledgeBaseService.ts` (deleted in main)
  - `python/src/server/services/search/rag_service.py` (conflict)
  - Multiple test files with error handling updates
- **Dependencies**: TanStack Query hooks, frontend error handling, backend RAG service
- **Side Effects**: Error sanitization patterns, API authentication flows
- **Test Coverage**: Frontend error display, backend error handling, integration tests

### Pattern Research
```yaml
context:
  docs:
    - url: "PR #605 - TanStack Query Migration Phase 3"
      focus: "Knowledge base architecture changes"
    - url: "archon-ui-main/src/features/knowledge/hooks/"
      focus: "New TanStack Query patterns"

  patterns:
    - file: "archon-ui-main/src/features/knowledge/components/KnowledgeBase.tsx"
      copy: "TanStack Query error handling patterns"
    - file: "archon-ui-main/src/features/knowledge/hooks/useKnowledgeQueries.ts"  
      copy: "Service replacement patterns"

  gotchas:
    - issue: "knowledgeBaseService.ts deleted"
      fix: "Functionality moved to TanStack Query hooks"
    - issue: "Error handling architecture changed"
      fix: "Use TanStack Query error states"
    - issue: "Import paths changed"
      fix: "Update to features/ directory structure"
```

## Task Structure

### Phase 1: Preparation and Analysis

**ACTION backup-branches:**
- CREATE: backup branch `git checkout -b bugfix-issue-362-backup`
- CREATE: analysis branch `git checkout -b rebase-analysis`
- VALIDATE: `git branch -a | grep backup`
- IF_FAIL: "Branches not created properly"
- ROLLBACK: "Continue without backup (higher risk)"

**ACTION analyze-main-changes:**
- READ: `git log origin/main --oneline -10`
- READ: `archon-ui-main/src/features/knowledge/` structure
- READ: TanStack Query migration patterns in main
- VALIDATE: Understanding of new architecture
- IF_FAIL: "Research TanStack Query documentation"
- ROLLBACK: "Proceed with basic understanding"

**ACTION identify-functionality-mapping:**
- COMPARE: deleted `knowledgeBaseService.ts` vs new hooks
- MAP: Error handling functions to TanStack Query equivalents
- DOCUMENT: Functions that need to be preserved
- VALIDATE: Complete functionality mapping
- IF_FAIL: "Manual code review needed"
- ROLLBACK: "Proceed with partial mapping"

### Phase 2: Interactive Rebase Setup

**ACTION start-rebase:**
- COMMAND: `git rebase -i origin/main`
- SELECT: Keep all commits (edit conflicting ones)
- VALIDATE: Rebase editor opens successfully
- IF_FAIL: "Check git configuration, try git rebase --abort"
- ROLLBACK: "Use merge strategy instead"

### Phase 3: Systematic Conflict Resolution

**ACTION resolve-rag-service-conflict:**
- FILE: `python/src/server/services/search/rag_service.py`
- OPERATION: Merge error handling improvements with main changes
- PRESERVE: OpenAI authentication error handling
- PRESERVE: Error message sanitization
- VALIDATE: `cd python && uv run pytest tests/test_rag_*.py -v`
- IF_FAIL: "Review specific test failures, adjust error handling"
- ROLLBACK: "Accept main version, re-implement error handling"

**ACTION resolve-knowledge-page-conflict:**
- FILE: `archon-ui-main/src/pages/KnowledgeBasePage.tsx`
- OPERATION: Adapt error handling to TanStack Query patterns
- PORT: Error display logic to new component structure
- UPDATE: Import statements to use features/ directory
- VALIDATE: `cd archon-ui-main && npm run test KnowledgeBasePage`
- IF_FAIL: "Check TanStack Query error handling patterns"
- ROLLBACK: "Use main version, re-add error handling manually"

**ACTION handle-deleted-service:**
- ANALYZE: Functions from `knowledgeBaseService.ts` 
- PORT: Error handling utilities to appropriate TanStack Query hooks
- UPDATE: All imports using the deleted service
- REMOVE: References to deleted service
- VALIDATE: `cd archon-ui-main && npm run build`
- IF_FAIL: "Find missing function mappings, update imports"
- ROLLBACK: "Recreate minimal service file"

### Phase 4: Architecture Adaptation

**ACTION adapt-error-handling:**
- UPDATE: Frontend error handling to use TanStack Query error states
- PRESERVE: Error message sanitization functions
- PRESERVE: OpenAI API key masking
- UPDATE: Error boundary components if needed
- VALIDATE: Manual test of error scenarios
- IF_FAIL: "Check error state propagation"
- ROLLBACK: "Keep old error handling patterns where possible"

**ACTION update-imports:**
- SCAN: All files for old import paths
- UPDATE: Import paths to new features/ structure
- REMOVE: Unused imports from deleted services
- ADD: New TanStack Query hook imports
- VALIDATE: `cd archon-ui-main && npm run lint`
- IF_FAIL: "Fix remaining import issues"
- ROLLBACK: "Manual import fixes"

### Phase 5: Comprehensive Validation

**ACTION run-frontend-tests:**
- COMMAND: `cd archon-ui-main && npm test`
- FOCUS: Error handling test cases
- FOCUS: Knowledge base functionality
- VALIDATE: All tests pass
- IF_FAIL: "Fix failing tests one by one"
- ROLLBACK: "Identify and skip non-critical failures"

**ACTION run-backend-tests:**
- COMMAND: `cd python && uv run pytest tests/ -v`
- FOCUS: RAG service tests
- FOCUS: Error handling tests
- VALIDATE: All tests pass
- IF_FAIL: "Fix backend test failures"
- ROLLBACK: "Document test failures for later"

**ACTION manual-error-testing:**
- TEST: Invalid OpenAI API key scenario
- TEST: Network timeout scenarios  
- TEST: Invalid query scenarios
- VERIFY: Error messages are sanitized
- VERIFY: Error messages are user-friendly
- VALIDATE: All error scenarios handled properly
- IF_FAIL: "Fix specific error handling issues"
- ROLLBACK: "Document error handling gaps"

**ACTION performance-validation:**
- TEST: Knowledge base loading performance
- TEST: Error handling overhead
- COMPARE: Before and after performance
- VALIDATE: No significant performance regression
- IF_FAIL: "Identify and fix performance issues"
- ROLLBACK: "Accept minor performance trade-offs"

### Phase 6: Finalization

**ACTION complete-rebase:**
- COMMAND: `git rebase --continue` (for each remaining commit)
- RESOLVE: Any remaining conflicts systematically
- VALIDATE: `git log --oneline` shows clean history
- IF_FAIL: "Continue resolving conflicts"
- ROLLBACK: "git rebase --abort and retry"

**ACTION final-validation:**
- RUN: Full test suite
- RUN: Manual smoke test of key functionality
- CHECK: All error handling improvements preserved
- VALIDATE: Branch ready for PR
- IF_FAIL: "Address remaining issues"
- ROLLBACK: "Reset to backup branch"

## User Interaction Points

### 1. Initial Confirmation
**Questions:**
- Confirm understanding of TanStack Query migration impact
- Verify that all 33 commits of error handling should be preserved
- Approve the systematic conflict resolution approach

### 2. Architecture Review
**Questions:**
- Review the mapping of knowledgeBaseService.ts to TanStack Query hooks
- Confirm error handling patterns for the new architecture
- Approve the adaptation strategy

### 3. Conflict Resolution Review
**Questions:**
- Review specific conflict resolutions as they occur
- Confirm that error handling functionality is preserved
- Approve any architectural adaptations

## Critical Elements

### Debug Patterns
- **Frontend Issues**: Check browser console for TanStack Query errors
- **Backend Issues**: Check logs for RAG service error handling
- **Integration Issues**: Test full error flow from backend to frontend

### Performance Considerations
- TanStack Query caching may affect error handling timing
- Error boundary performance with new architecture
- Backend error processing overhead

### Security Concerns
- Ensure error message sanitization still works
- Verify OpenAI API key masking is preserved
- Check that no sensitive data leaks in new error flows

### Assumptions
- TanStack Query migration is complete and stable in main
- All required TanStack Query hooks are implemented
- Test suite covers error handling scenarios adequately

## Risk Assessment

### High Risk Areas
- **Frontend Architecture Mismatch**: TanStack Query vs old service patterns
- **Lost Functionality**: Functions from deleted knowledgeBaseService.ts
- **Error Handling Gaps**: New architecture may miss some error cases

### Medium Risk Areas  
- **Import Path Updates**: Many files may have outdated imports
- **Test Compatibility**: Tests may need updates for new architecture
- **Performance Impact**: New error handling patterns may affect performance

### Low Risk Areas
- **Backend RAG Service**: Likely straightforward merge conflict
- **Basic Functionality**: Core features should work with proper adaptation

### Rollback Strategy
1. **Immediate Abort**: `git rebase --abort` returns to original state
2. **Partial Rollback**: Reset to backup branch and cherry-pick successful commits
3. **Alternative Approach**: Use merge strategy instead of rebase if conflicts too complex

## Success Criteria
- [ ] All 33 commits successfully rebased onto main
- [ ] All error handling functionality preserved
- [ ] Frontend works with TanStack Query architecture  
- [ ] Backend RAG service conflicts resolved
- [ ] All tests passing
- [ ] Error scenarios work as expected
- [ ] No performance regression
- [ ] Security features (sanitization) intact

## Output Files
- `bugfix-issue-362` branch rebased onto main
- Updated test results
- Documentation of any architectural changes made
- List of any functionality that couldn't be preserved (if any)

## Estimated Timeline
- **Phase 1-2**: 30 minutes (preparation and setup)
- **Phase 3**: 1-2 hours (conflict resolution)
- **Phase 4**: 1 hour (architecture adaptation)
- **Phase 5**: 1 hour (validation)
- **Phase 6**: 30 minutes (finalization)
- **Total**: 4-5 hours

## Quality Checklist
- [x] All changes identified (3 main conflicts + architecture adaptation)
- [x] Dependencies mapped (TanStack Query, error handling, RAG service)
- [x] Each task has validation (tests and manual checks)
- [x] Rollback steps included (backup branches, abort strategies)
- [x] Debug strategies provided (frontend, backend, integration)
- [x] Performance impact noted (TanStack Query caching, error processing)
- [x] Security checked (error sanitization, API key masking)
- [x] No missing edge cases (comprehensive error scenario testing)