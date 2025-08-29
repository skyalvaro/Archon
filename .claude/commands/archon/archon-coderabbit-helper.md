---
title: Archon CodeRabbit Helper
Description: A helper command For analysing coderabbit code review comments that will help you understand the suggestion, analyse if its a valid suggestion and list options and tradeoffs.
---

## Start

This is a code review suggestion posted by coderabbit on the current branch related to recent changes.

The review suggestions from code rabbit: $ARGUMENTS

## Step 1

- Ingest the information formt he code rabbit suggestion and deeply undesrtand it
- Once you have a deep undestanding of the issue and why coderabbit is making this suggestion move on to step 2

## Step 2

- Based on your findings during step one, explore alternative options and tradeoffs
- We are in arly Beta with this product and we prefer simple pragmatic approaches following KISS principles while following existing codebase patterns unless specifically specified otherwise

## Step 3

- Provide the user with a list of options and tradeoffs for the suggested changes

## Format

Answer the user directly in the chat with

Why is this needed:

Should we address it as part of this PR:

```
Option #n:
Tradeoffs for option:

Option #n:
Tradeoffs for option:
```
