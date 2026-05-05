# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Web framework**: Next.js App Router
- **API framework**: Next route handlers, with a legacy Express 5 API server still available in `artifacts/api-server`
- **Database**: PostgreSQL + Prisma ORM
- **Validation**: Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)

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

- Uses Spotify Client Credentials flow
- Credentials are stored as `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
- Token is cached and auto-refreshed

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Legacy Express API server (routes: /setlists, /spotify)
│   └── setlist-app/        # Next.js app (SetlistOS + /api route handlers)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Prisma schema + DB connection
│       └── prisma/
│           └── schema.prisma
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Packages

### `artifacts/setlist-app` (`@workspace/setlist-app`)

Next.js App Router app. Uses route handlers under `src/app/api`, `@hello-pangea/dnd` for drag-and-drop, and React Query for API calls.

### `artifacts/api-server` (`@workspace/api-server`)

Legacy Express 5 API server. Routes:

- `GET /api/healthz` - health check
- `GET /api/setlists` - list setlists with song count + total duration
- `POST /api/setlists` - create setlist
- `GET /api/setlists/:id` - get setlist with songs
- `PATCH /api/setlists/:id` - rename setlist
- `DELETE /api/setlists/:id` - delete setlist
- `POST /api/setlists/:id/songs` - add song
- `DELETE /api/setlists/:id/songs/:songId` - remove song
- `PUT /api/setlists/:id/songs/reorder` - reorder songs
- `GET /api/spotify/search?q=...` - search Spotify tracks

### `lib/db` (`@workspace/db`)

- `prisma/schema.prisma` - `setlists` and `setlist_songs` models
- `src/index.ts` - shared Prisma Client

### DB Management

```bash
pnpm --filter @workspace/db run generate
pnpm --filter @workspace/db run push
```
