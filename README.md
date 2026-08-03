# PGKhata

PGKhata is a PG and hostel operations platform: rooms, tenants, electricity
readings, monthly billing, and payment tracking for Indian PG owners.

## Layout

- `apps/web` - the application. TanStack Start, React 19, and Supabase for
  auth, Postgres, and storage.

The repository keeps the pnpm workspace layout so a second deployable can be
added later without another restructure, but there is only one today.

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

## Status

The product does not yet close its core loop. Reminders are email-only, and
there is no payment webhook, so payments cannot be reconciled automatically.
Both are the current priority.

An Express, Drizzle, and BullMQ backend was started and then removed: it had
reached one module while the shipping application had grown past seventeen
thousand lines, so it was two codebases of maintenance for no delivered
behaviour. The schema and contract design is kept outside this repository, in
`data-points/reference-backend`, for whenever a separate backend is actually
warranted.
