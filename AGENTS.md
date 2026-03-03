# AGENTS Guide for `lxc-manager`

This document is for autonomous coding agents operating in this repository.
It captures practical commands and code conventions inferred from the codebase.

## Repo Overview

- Monorepo with npm workspaces.
- Main workspaces:
  - `apps/backend` (`@vm-manager/backend`) - Node/Express + WebSocket backend.
  - `apps/frontend` (`@vm-manager/frontend`) - React + Vite frontend.
  - `packages/shared` (`@vm-manager/shared`) - shared TypeScript types/contracts.
- TypeScript strict mode is enabled at base config level.

## Environment and Package Manager

- Package manager: `npm`.
- Node runtime expected by tooling: modern Node with ESM support.
- Prefer running commands from repo root unless specifically targeting a workspace.

## Build Commands

### Full monorepo

- Build all packages in dependency order:
  - `npm run build`
- Typecheck all packages:
  - `npm run typecheck`

### Backend only

- Build backend:
  - `npm --workspace @vm-manager/backend run build`
- Typecheck backend (no emit):
  - `npm --workspace @vm-manager/backend run typecheck`
- Run backend in dev watch mode:
  - `npm --workspace @vm-manager/backend run dev`
- Run compiled backend:
  - `npm --workspace @vm-manager/backend run start`

### Frontend only

- Build frontend:
  - `npm --workspace @vm-manager/frontend run build`
- Typecheck frontend:
  - `npm --workspace @vm-manager/frontend run typecheck`
- Start frontend dev server:
  - `npm --workspace @vm-manager/frontend run dev`
- Preview production frontend build:
  - `npm --workspace @vm-manager/frontend run preview`

### Shared package only

- Build shared types package:
  - `npm --workspace @vm-manager/shared run build`
- Typecheck shared package:
  - `npm --workspace @vm-manager/shared run typecheck`

## Lint and Test Status

- No dedicated lint script is currently defined in root/backend/frontend/shared `package.json`.
- No dedicated test script/config (Jest/Vitest/Playwright/Cypress) was detected.
- Do not invent lint/test commands in PR notes; report actual state.

## Single-Test Guidance (Important)

There is no test runner configured today, so a true single-test command is not available yet.

If a test runner is introduced, follow these common patterns:

- Vitest single file:
  - `npm --workspace <pkg> run test -- path/to/file.test.ts`
- Vitest single test name:
  - `npm --workspace <pkg> run test -- -t "test name"`
- Jest single file:
  - `npm --workspace <pkg> run test -- path/to/file.test.ts`
- Jest single test name:
  - `npm --workspace <pkg> run test -- -t "test name"`

When adding tests in this repo, also add explicit `test` and (optionally) `test:watch` scripts.

## TypeScript and Module Conventions

- Base TS config:
  - `strict: true`
  - `module: NodeNext` (base)
  - `target: ES2022`
  - declarations + sourcemaps enabled in base
- Backend TS config:
  - emits to `dist`
  - `rootDir: src`
  - Node types enabled
- Frontend TS config:
  - `moduleResolution: Bundler`
  - `jsx: react-jsx`
  - `noEmit: true`

## Import Style

- Use stable grouping order:
  1. Third-party imports (`express`, `react`, etc.)
  2. Type-only imports (`import type { ... } from ...`)
  3. Local relative imports (`./x.js`, `./y`)
- Keep shared types from `@vm-manager/shared` in type imports when possible.
- In backend TS ESM files, preserve explicit `.js` extension in relative imports where present.

## Naming Conventions

- `camelCase` for variables, functions, and most helpers.
- `PascalCase` for React components and TypeScript type/interface aliases.
- Route handlers in backend often use `*Handler` suffix (`createSessionHandler`, etc.).
- Use descriptive domain names (`systemOptions`, `assignVmOwnerHandler`) over abbreviations.
- Keep API route names resource-oriented; current API policy in this repo uses `GET` + `POST` only.

## API and HTTP Conventions

- Current project convention: only `GET` and `POST` for endpoints.
- Keep auth-protected routes wrapped with existing middleware patterns.
- Keep response shapes consistent with existing handlers.
- Reuse existing view/serializer helpers for outbound payloads where applicable.

## Error Handling Conventions

- Backend:
  - Validate inputs early and return `res.status(...).json({ error: "..." })`.
  - Prefer explicit status codes (`400`, `401`, `403`, `404`, `409`, `502`, etc.).
  - Wrap external/service operations in `try/catch` and convert to safe API errors.
- Frontend:
  - Always check `response.ok` after `fetch`.
  - Parse backend JSON error payloads as `{ error?: string }`.
  - Surface errors through shared UI error state (existing `setError(...)` flow).

## State and UI Patterns (Frontend)

- Prefer typed unions for UI modes/pages (`ModalKind`, `PageKey`, etc.).
- Keep modal-specific state local to `App.tsx` unless there is a clear abstraction win.
- Follow existing button/modal/form patterns instead of introducing new UI paradigms ad hoc.

## Data and Persistence Patterns (Backend)

- Use `store.ts` functions as the persistence boundary from route handlers.
- Avoid bypassing store helpers from HTTP layer unless introducing new helper intentionally.
- Preserve existing transformation helpers (`vmView`, `hostView`, `userView`) when returning API data.

## Formatting Rules

- Match existing formatting:
  - Double quotes.
  - Semicolons.
  - Readable multi-line objects/arrays with trailing commas when style already uses them.
- Keep changes minimal and stylistically consistent with nearby code.
- Do not introduce broad reformat-only diffs.

## Security and Auth Notes

- Never log secrets, passwords, tokens, or full auth headers.
- Password updates must verify current password server-side before hash update.
- Keep JWT/session handling aligned with existing auth helpers/middleware.

## Cursor/Copilot Rules Status

- `.cursorrules`: not found.
- `.cursor/rules/`: not found.
- `.github/copilot-instructions.md`: not found.
- If these files are added later, update this document and treat those rules as higher-priority guidance.

## Agent Workflow Recommendations

- Before edits: run targeted reads/grep for impacted files.
- After edits: run workspace-specific build/typecheck commands first.
- Prefer small, focused diffs; avoid opportunistic refactors.
- If adding tooling (lint/test), document exact commands in this file immediately.

## Quick Command Checklist

- Full build: `npm run build`
- Full typecheck: `npm run typecheck`
- Backend build: `npm --workspace @vm-manager/backend run build`
- Frontend build: `npm --workspace @vm-manager/frontend run build`
- Shared build: `npm --workspace @vm-manager/shared run build`
