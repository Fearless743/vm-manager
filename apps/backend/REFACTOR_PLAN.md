# Backend Refactor Plan (Non-Breaking)

Goal: align backend structure with Express layered conventions (routes/controllers/services/middleware/utils) while keeping API URL, method, request/response contracts, and auth behavior unchanged.

## Scope

- In scope:
  - Directory restructuring and code movement.
  - Route registration split by resource.
  - Handler extraction from `src/index.ts`.
  - Service layer wrapping persistence and agent orchestration.
- Out of scope:
  - Endpoint URL/method changes.
  - Response shape or status code policy changes.
  - Database schema changes.

## Current State (Summary)

- Refactor completed through Phase 6.
- `src/index.ts`: thin entrypoint forwarding to `server.ts`.
- `src/app.ts` + `src/server.ts`: bootstrap and composition root.
- `src/middleware/auth.middleware.ts` + `src/utils/auth.util.ts`: auth split complete.
- `src/data/store.ts`: persistence boundary.
- `src/ws/agentHub.ts`: websocket/agent runtime.

## Target Directory Layout

```text
apps/backend/src/
  app.ts
  server.ts
  config.ts
  routes/
    health.routes.ts
    sessions.routes.ts
    users.routes.ts
    hosts.routes.ts
    vms.routes.ts
    site-config.routes.ts
    system-options.routes.ts
  controllers/
    health.controller.ts
    sessions.controller.ts
    users.controller.ts
    hosts.controller.ts
    vms.controller.ts
    site-config.controller.ts
    system-options.controller.ts
  services/
    users.service.ts
    hosts.service.ts
    vms.service.ts
    site-config.service.ts
  middleware/
    auth.middleware.ts
  utils/
    auth.util.ts
    views.ts
  data/
    store.ts
    db.ts
    schema.ts
  ws/
    agentHub.ts
  types/
    api.ts
    index.ts
```

Notes:
- Keep existing TS ESM import conventions (`.js` in relative imports where needed after build).
- Existing behavior in `store.ts` and `agentHub.ts` should remain functionally identical after move.

## API Contract Freeze

All existing endpoints remain unchanged during this refactor:

- `GET /api/health`
- `GET /api/site-configs/current`
- `POST /api/site-configs/current`
- `POST /api/sessions`
- `GET /api/users/me`
- `POST /api/users/me/password`
- `GET /api/vms`
- `GET /api/users`
- `POST /api/users`
- `POST /api/users/:userId`
- `POST /api/users/:userId/deletions`
- `GET /api/system-options`
- `GET /api/hosts`
- `POST /api/hosts`
- `POST /api/hosts/:hostKey`
- `POST /api/hosts/:hostKey/secret-rotations`
- `POST /api/vms`
- `POST /api/vms/:vmId/owner`
- `POST /api/vms/:vmId/operations`

## Layer Responsibilities

- `routes/*`: URL-to-controller mapping only; apply middleware composition.
- `controllers/*`: parse/validate request, call service, map to HTTP response.
- `services/*`: business orchestration and cross-module use-cases.
- `data/*`: persistence boundary (Drizzle + table access helpers).
- `middleware/*`: auth/authorization request guards.
- `utils/*`: pure helper functions (view mappers, auth helpers).

## Migration Phases

1) Bootstrap split
- Create `app.ts` (Express setup + router mounting).
- Create `server.ts` (HTTP server listen).
- Keep `index.ts` as thin compatibility re-export or entry forwarding.

2) Route split (no logic change)
- Move route declarations out of `index.ts` into `routes/*.routes.ts`.
- Keep handlers temporarily local in route files.

3) Controller extraction
- Move each handler body into `controllers/*.controller.ts`.
- Route files should only wire middleware and controller function.

4) Service extraction
- Move orchestration logic into `services/*`.
- Keep `data/store.ts` as primary persistence API.

5) Auth/util cleanup
- Split `auth.ts` into `middleware/auth.middleware.ts` + `utils/auth.util.ts`.
- Move view helpers (`vmView`, `hostView`, `userView`) into `utils/views.ts`.

6) Final consolidation
- Remove dead imports/files and ensure route mounting order unchanged.

## File Mapping (Source -> Target)

- `src/index.ts`
  - app/server bootstrap -> `app.ts`, `server.ts`
  - route defs -> `routes/*.routes.ts`
  - handler functions -> `controllers/*.controller.ts`
  - `vmView/hostView/userView` -> `utils/views.ts`
- `src/auth.ts`
  - middleware -> `middleware/auth.middleware.ts`
  - token/hash helpers -> `utils/auth.util.ts`
- `src/store.ts` -> `data/store.ts`
- `src/db.ts` -> `data/db.ts`
- `src/schema.ts` -> `data/schema.ts`
- `src/agentHub.ts` -> `ws/agentHub.ts`

## Quality Gates

Run after each migration phase:

- `npm --workspace @vm-manager/backend run typecheck`
- `npm --workspace @vm-manager/backend run build`

Run full repo validation before merge:

- `npm run typecheck`
- `npm run build`

## Acceptance Criteria

- No endpoint URL/method change.
- No auth behavior regression (same role checks, same protected routes).
- Response payload fields and status codes remain equivalent.
- Backend build/typecheck pass.
- Frontend build still passes without API-call changes.

## Rollback Strategy

- Keep refactor in small commits per phase.
- If regression appears, revert latest phase commit only.
- Do not mix structural and behavioral changes in the same commit.

## Migration Status

- [x] Phase 1: Bootstrap split
- [x] Phase 2: Route split
- [x] Phase 3: Controller extraction
- [x] Phase 4: Service extraction
- [x] Phase 5: Auth/util cleanup
- [x] Phase 6: Final consolidation (data/ws moves + import normalization)

## Next Improvements (Optional)

1. Introduce shared request/response DTO types in `types/api.ts`.
2. Add centralized error middleware to reduce repetitive controller `try/catch`.
3. Add test scripts and minimal integration coverage for auth/users/vms routes.
