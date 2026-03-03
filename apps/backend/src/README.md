# Backend Source Structure

This backend follows a layered Express structure.

## Directory Map

- `app.ts`
  - Express composition root (middleware + route mounting)
  - Contains VM cleanup scheduler wiring (`schedulePurgeUncreatedVms`)
- `server.ts`
  - HTTP server bootstrap
  - WebSocket AgentHub initialization
- `index.ts`
  - Thin runtime entrypoint (`import "./server.js"`)

- `routes/`
  - Route registration only
  - Applies auth/role middleware
  - Delegates to controllers

- `controllers/`
  - Request/response layer
  - Parses request data, calls services, maps service errors to HTTP

- `services/`
  - Business orchestration and use-case logic
  - Coordinates `data/` persistence and `ws/` command execution

- `middleware/`
  - Express middleware (`authenticate`, `requireRole`)

- `utils/`
  - Pure helpers (`auth.util`, `views` mappers)

- `data/`
  - Persistence boundary
  - Drizzle DB access and table schema
  - All store operations

- `ws/`
  - WebSocket runtime (`AgentHub`)

## Layer Rules

1. `routes` should not contain business logic.
2. `controllers` should stay thin; no DB-heavy orchestration.
3. `services` own business workflows and policy checks.
4. `data` is the only persistence boundary.
5. `utils` should be side-effect free where possible.

## API Conventions

- Project policy: only `GET` and `POST` methods.
- Keep response errors in `{ error: string }` shape.
- Preserve existing endpoint contracts unless explicitly requested.

## Validation Commands

- Backend build: `npm --workspace @vm-manager/backend run build`
- Backend typecheck: `npm --workspace @vm-manager/backend run typecheck`
- Full repo build: `npm run build`
