import { db } from "./index";

export type LyricSource = "lrclib" | "manual";

export type LyricLine = {
  index: number;
  text: string;
  startMs: number | null;
};

export type StoredSongLyrics = {
  id: number;
  songId: number;
  source: LyricSource;
  lrclibId: number | null;
  plainLyrics: string;
  syncedLyrics: string | null;
  lines: LyricLine[];
  audioUrl: string | null;
  bpm: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveSongLyricsInput = {
  setlistId: number;
  songId: number;
  source: LyricSource;
  lrclibId?: number | null;
  plainLyrics: string;
  syncedLyrics?: string | null;
  lines?: LyricLine[];
  audioUrl?: string | null;
  bpm?: number | null;
};

export type LrclibLyricsResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number | null;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string | null;
  lines: LyricLine[];
};

type LyricsRow = {
  id: number;
  songId: number;
  source: string;
  lrclibId: number | null;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  lines: unknown;
  audioUrl: string | null;
  bpm: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type LrclibResponse = {
  id?: number;
  name?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

const timestampPattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function normalizeLyricLines(rawLyrics: string): string[] {
  return rawLyrics
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function linesFromPlainLyrics(rawLyrics: string): LyricLine[] {
  return normalizeLyricLines(rawLyrics).map((text, index) => ({
    index,
    text,
    startMs: null,
  }));
}

export function parseSyncedLyrics(rawLyrics: string): LyricLine[] {
  const lines: Array<Omit<LyricLine, "index">> = [];

  for (const rawLine of rawLyrics.split(/\r?\n/)) {
    const matches = [...rawLine.matchAll(timestampPattern)];
    if (matches.length === 0) {
      continue;
    }

    const text = rawLine.replace(timestampPattern, "").replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    for (const match of matches) {
      const minutes = Number.parseInt(match[1] ?? "0", 10);
      const seconds = Number.parseInt(match[2] ?? "0", 10);
      const fraction = match[3] ?? "0";
      const fractionMs = Number.parseInt(fraction.padEnd(3, "0").slice(0, 3), 10);
      lines.push({
        text,
        startMs: minutes * 60_000 + seconds * 1_000 + fractionMs,
      });
    }
  }

  return lines
    .sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0))
    .map((line, index) => ({ ...line, index }));
}

export function formatSyncedLyrics(lines: LyricLine[]): string {
  return lines
    .filter((line) => line.text.trim())
    .map((line) => {
      if (line.startMs == null) {
        return line.text.trim();
      }

      const totalMs = Math.max(0, Math.round(line.startMs));
      const minutes = Math.floor(totalMs / 60_000);
      const seconds = Math.floor((totalMs % 60_000) / 1_000);
      const centiseconds = Math.floor((totalMs % 1_000) / 10);
      return `[${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}] ${line.text.trim()}`;
    })
    .join("\n");
}

export async function ensureSongLyricsTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS setlist_song_lyrics (
      id SERIAL PRIMARY KEY,
      song_id INTEGER NOT NULL UNIQUE REFERENCES setlist_songs(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'manual',
      lrclib_id INTEGER,
      plain_lyrics TEXT NOT NULL DEFAULT '',
      synced_lyrics TEXT,
      lines JSONB NOT NULL DEFAULT '[]'::jsonb,
      audio_url TEXT,
      bpm INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function assertSongInSetlist(setlistId: number, songId: number) {
  const song = await db.setlistSong.findFirst({
    where: { id: songId, setlistId },
  });

  return song;
}

export async function getSongLyrics(setlistId: number, songId: number) {
  const song = await assertSongInSetlist(setlistId, songId);
  if (!song) {
    return null;
  }

  await ensureSongLyricsTable();

  const rows = await db.$queryRawUnsafe<LyricsRow[]>(
    `
      SELECT
        id,
        song_id AS "songId",
        source,
        lrclib_id AS "lrclibId",
        plain_lyrics AS "plainLyrics",
        synced_lyrics AS "syncedLyrics",
        lines,
        audio_url AS "audioUrl",
        bpm,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM setlist_song_lyrics
      WHERE song_id = $1
      LIMIT 1
    `,
    songId,
  );

  return rows[0] ? mapLyricsRow(rows[0]) : null;
}

export async function saveSongLyrics(input: SaveSongLyricsInput) {
  const song = await assertSongInSetlist(input.setlistId, input.songId);
  if (!song) {
    return null;
  }

  await ensureSongLyricsTable();

  const source = input.source === "lrclib" ? "lrclib" : "manual";
  const normalizedLines = normalizeInputLines(
    input.lines && input.lines.length > 0
      ? input.lines
      : linesFromPlainLyrics(input.plainLyrics),
  );
  const syncedLyrics =
    input.syncedLyrics ??
    (normalizedLines.some((line) => line.startMs != null)
      ? formatSyncedLyrics(normalizedLines)
      : null);

  const rows = await db.$queryRawUnsafe<LyricsRow[]>(
    `
      INSERT INTO setlist_song_lyrics (
        song_id,
        source,
        lrclib_id,
        plain_lyrics,
        synced_lyrics,
        lines,
        audio_url,
        bpm,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, now())
      ON CONFLICT (song_id) DO UPDATE SET
        source = EXCLUDED.source,
        lrclib_id = EXCLUDED.lrclib_id,
        plain_lyrics = EXCLUDED.plain_lyrics,
        synced_lyrics = EXCLUDED.synced_lyrics,
        lines = EXCLUDED.lines,
        audio_url = EXCLUDED.audio_url,
        bpm = EXCLUDED.bpm,
        updated_at = now()
      RETURNING
        id,
        song_id AS "songId",
        source,
        lrclib_id AS "lrclibId",
        plain_lyrics AS "plainLyrics",
        synced_lyrics AS "syncedLyrics",
        lines,
        audio_url AS "audioUrl",
        bpm,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    input.songId,
    source,
    input.lrclibId ?? null,
    input.plainLyrics,
    syncedLyrics,
    JSON.stringify(normalizedLines),
    input.audioUrl ?? null,
    input.bpm ?? null,
  );

  return mapLyricsRow(rows[0]);
}

export async function fetchLrclibLyrics(params: {
  trackName: string;
  artistName: string;
  durationMs?: number | null;
}) {
  const searchParams = new URLSearchParams({
    track_name: params.trackName,
    artist_name: params.artistName,
  });

  if (params.durationMs && params.durationMs > 0) {
    searchParams.set("duration", Math.round(params.durationMs / 1_000).toString());
  }

  const response = await fetch(`https://lrclib.net/api/get?${searchParams}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "setlist-tracker/0.1.0 (lyrics sync)",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`LRCLIB request failed with ${response.status}`);
  }

  const payload = (await response.json()) as LrclibResponse;
  return normalizeLrclibResponse(payload);
}

function normalizeLrclibResponse(payload: LrclibResponse): LrclibLyricsResult | null {
  const syncedLyrics = payload.syncedLyrics?.trim() || null;
  const plainLyrics = payload.plainLyrics?.trim() || "";
  const lines = syncedLyrics
    ? parseSyncedLyrics(syncedLyrics)
    : linesFromPlainLyrics(plainLyrics);

  if (lines.length === 0 && !payload.instrumental) {
    return null;
  }

  return {
    id: payload.id ?? 0,
    trackName: payload.trackName ?? payload.name ?? "",
    artistName: payload.artistName ?? "",
    albumName: payload.albumName ?? null,
    duration: payload.duration ?? null,
    instrumental: Boolean(payload.instrumental),
    plainLyrics,
    syncedLyrics,
    lines,
  };
}

function normalizeInputLines(lines: LyricLine[]): LyricLine[] {
  return lines
    .map((line) => ({
      index: line.index,
      text: line.text.replace(/\s+/g, " ").trim(),
      startMs:
        typeof line.startMs === "number" && Number.isFinite(line.startMs)
          ? Math.max(0, Math.round(line.startMs))
          : null,
    }))
    .filter((line) => line.text)
    .map((line, index) => ({ ...line, index }));
}

function mapLyricsRow(row: LyricsRow): StoredSongLyrics {
  const source: LyricSource = row.source === "lrclib" ? "lrclib" : "manual";
  const lines = Array.isArray(row.lines)
    ? normalizeInputLines(row.lines as LyricLine[])
    : [];

  return {
    id: row.id,
    songId: row.songId,
    source,
    lrclibId: row.lrclibId,
    plainLyrics: row.plainLyrics ?? "",
    syncedLyrics: row.syncedLyrics,
    lines,
    audioUrl: row.audioUrl,
    bpm: row.bpm,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
