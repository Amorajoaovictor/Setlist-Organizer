# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Project: Band Setlist Organizer (SetlistOS)

A web app for bands to organize setlists, search songs via Spotify, and track total show duration.

### Features
- Create and manage multiple setlists
- Search Spotify for tracks (gets title, artist, album art, duration)
- Add tracks to setlists
- Drag-and-drop reorder songs
- View total duration of each setlist
- Delete songs and setlists

### Spotify Integration
- Uses Spotify Client Credentials flow (no user login required)
- Credentials stored as `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` env vars
- Token is cached and auto-refreshed
- Note: Spotify integration was set up manually (user provided credentials) — not via Replit Spotify integration connector

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (routes: /setlists, /spotify)
│   └── setlist-app/        # React + Vite frontend (SetlistOS)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           └── setlists.ts # setlists + setlist_songs tables
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes:
- `GET /api/healthz` — health check
- `GET /api/setlists` — list setlists with song count + total duration
- `POST /api/setlists` — create setlist
- `GET /api/setlists/:id` — get setlist with songs
- `PATCH /api/setlists/:id` — rename setlist
- `DELETE /api/setlists/:id` — delete setlist
- `POST /api/setlists/:id/songs` — add song
- `DELETE /api/setlists/:id/songs/:songId` — remove song
- `PUT /api/setlists/:id/songs/reorder` — reorder songs (body: `{songIds: number[]}`)
- `GET /api/spotify/search?q=...` — search Spotify tracks

### `artifacts/setlist-app` (`@workspace/setlist-app`)

React + Vite frontend. Uses `@hello-pangea/dnd` for drag-and-drop, React Query for API calls.

### `lib/db` (`@workspace/db`)

- `src/schema/setlists.ts` — `setlists` + `setlist_songs` tables

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec at `openapi.yaml`. Run codegen:
```bash
pnpm --filter @workspace/api-spec run codegen
```

### DB Management

```bash
pnpm --filter @workspace/db run push        # push schema changes
pnpm --filter @workspace/db run push-force  # force push
```
