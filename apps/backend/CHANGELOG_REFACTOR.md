# Backend Refactor Changelog

This document summarizes the completed backend restructuring work.

## Goal

Align backend architecture with layered Express conventions while keeping API behavior stable.

## Completed Scope

### 1) Bootstrap split

- Added `src/app.ts` as composition root.
- Added `src/server.ts` for HTTP/WebSocket bootstrap.
- Kept `src/index.ts` as thin entrypoint (`import "./server.js"`).

### 2) Route modularization

Split routes from monolithic `index.ts` into:

- `src/routes/health.routes.ts`
- `src/routes/site-config.routes.ts`
- `src/routes/sessions.routes.ts`
- `src/routes/users.routes.ts`
- `src/routes/system-options.routes.ts`
- `src/routes/hosts.routes.ts`
- `src/routes/vms.routes.ts`

### 3) Controller extraction

Added controllers and moved request-handling logic out of route files:

- `src/controllers/health.controller.ts`
- `src/controllers/site-config.controller.ts`
- `src/controllers/sessions.controller.ts`
- `src/controllers/system-options.controller.ts`
- `src/controllers/users.controller.ts`
- `src/controllers/hosts.controller.ts`
- `src/controllers/vms.controller.ts`

### 4) Service layer extraction

Introduced business orchestration layer:

- `src/services/httpError.ts`
- `src/services/sessions.service.ts`
- `src/services/siteConfig.service.ts`
- `src/services/users.service.ts`
- `src/services/hosts.service.ts`
- `src/services/vms.service.ts`

Controllers are now thin and call services.

### 5) Auth and utils cleanup

- Split old auth responsibilities into:
  - `src/middleware/auth.middleware.ts`
  - `src/utils/auth.util.ts`
- Removed old `src/auth.ts`.
- Unified view mappers in `src/utils/views.ts`.

### 6) Data and websocket namespace moves

- `src/store.ts` -> `src/data/store.ts`
- `src/db.ts` -> `src/data/db.ts`
- `src/schema.ts` -> `src/data/schema.ts`
- `src/agentHub.ts` -> `src/ws/agentHub.ts`

All backend imports were updated to new module locations.

## API Contract Notes

- Endpoint behavior preserved as part of non-breaking refactor intent.
- API method policy remains `GET` + `POST` only.

## Supporting Docs Added/Updated

- Added: `src/README.md` (layer responsibilities and structure)
- Updated: `REFACTOR_PLAN.md` (phase completion status)

## Validation

Validated with successful builds:

- `npm --workspace @vm-manager/backend run build`
- `npm --workspace @vm-manager/frontend run build`
