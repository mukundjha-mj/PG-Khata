# PGKhata

PGKhata is a PG and hostel operations platform. The repository is organized as
a modular monorepo so the frontend, API, and background worker can be deployed
independently while sharing validated contracts.

## Applications

- `apps/web` - existing TanStack Start owner and platform application.
- `apps/api` - Express 5 REST API and Better Auth boundary.
- `apps/worker` - BullMQ background processing.

## Shared packages

- `packages/contracts` - Zod request/response contracts and OpenAPI metadata.
- `packages/db` - Drizzle schema, migrations, and database access.
- `packages/config` - shared runtime configuration and logging.
- `packages/test-utils` - integration-test infrastructure and fixtures.

## Development

Use an LTS Node.js release and pnpm:

```sh
pnpm install
pnpm dev
```

Run the full quality gate with:

```sh
pnpm check
```

The migration from direct Supabase browser access is incremental. See
`docs/backend-migration.md` before moving or removing legacy data paths.
