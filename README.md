# SetlistOS

SetlistOS is a Next.js app for organizing band setlists, searching Deezer tracks, adding songs, reordering them by drag-and-drop, and tracking total runtime.

## Stack

- Next.js App Router
- React Query
- PostgreSQL
- Prisma ORM
- Zod
- OpenAPI/Orval generated API client

The app no longer uses Replit auth or Replit-specific runtime dependencies.

## Environment

Create a local env file from the example:

```bash
cp .env.example .env.local
```

Required variables:

```bash
DATABASE_URL="postgresql://user:password@host:5432/database"
# Optional Spotify OAuth login.
AUTH_SPOTIFY_ID="your_spotify_oauth_client_id"
AUTH_SPOTIFY_SECRET="your_spotify_oauth_client_secret"
```

## Install

```bash
pnpm install
pnpm --filter @workspace/db run generate
```

## Database

Push the Prisma schema to PostgreSQL:

```bash
pnpm --filter @workspace/db run push
```

Prisma schema:

```text
lib/db/prisma/schema.prisma
```

## Development

Run the Next app:

```bash
pnpm --filter @workspace/setlist-app run dev
```

Default URL:

```text
http://localhost:3000
```

The Next app serves both the UI and API routes:

```text
GET    /api/healthz
GET    /api/setlists
POST   /api/setlists
GET    /api/setlists/:id
PATCH  /api/setlists/:id
DELETE /api/setlists/:id
POST   /api/setlists/:id/songs
DELETE /api/setlists/:id/songs/:songId
PUT    /api/setlists/:id/songs/reorder
GET    /api/deezer/search?q=...
```

## Build

```bash
pnpm --filter @workspace/setlist-app run build
```

The legacy Express API server remains in `artifacts/api-server`, also using Prisma, but the primary app path is the Next app in `artifacts/setlist-app`.
