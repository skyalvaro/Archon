# Analysis and Claude Commands Branch

This branch contains analysis files and Claude command definitions that were separated from the main feature branches to keep them focused and compliant with CONTRIBUTING.md guidelines.

## Contents

### Claude Commands (/.claude/commands/archon/)
- `archon-alpha-review.md` - Code review command for Archon V2 Beta
- `archon-onboarding.md` - Onboarding command for new contributors  
- `archon-prime.md` - Prime analysis command
- `archon-prime-simple.md` - Simplified prime analysis command
- `archon-rca.md` - Root cause analysis command
- `archon-coderabbit-helper.md` - CodeRabbit integration helper

These files are Claude Code command definitions that help with development workflows but are not part of the core application functionality.

## Purpose

This branch serves as a storage location for:
1. Analysis and report generation tools
2. Development workflow commands
3. Code review and quality assurance utilities
4. Documentation and onboarding helpers

## Usage

These files can be merged back into main when the repository structure supports development tooling, or kept as a separate branch for contributors who want to use the Claude commands.

## Relationship to Feature Branches

This branch was created to reduce the size of feature branches and ensure they comply with the 2,000-line guideline in CONTRIBUTING.md while preserving valuable development tools.