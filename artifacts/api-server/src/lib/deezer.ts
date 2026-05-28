import { logger } from "./logger";

export interface DeezerTrack {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  bpm: number | null;
  albumArt: string | null;
  album: string;
}

type DeezerSearchResponse = {
  data?: DeezerSearchItem[];
};

type DeezerSearchItem = {
  id: number;
  title: string;
  duration?: number;
  bpm?: number | null;
  artist?: { name?: string };
  album?: {
    title?: string;
    cover_medium?: string;
    cover_big?: string;
    cover_xl?: string;
  };
};

type DeezerTrackDetails = {
  bpm?: number | null;
};

export async function searchTracks(query: string): Promise<DeezerTrack[]> {
  const url = new URL("https://api.deezer.com/search/track");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Deezer search error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as DeezerSearchResponse;
  const tracks = (data.data ?? []).map(mapSearchItem);
  const bpmByTrackId = await getTrackBpmMap(tracks);

  logger.info({ count: tracks.length }, "Searched Deezer tracks");

  return tracks.map((track) => ({
    ...track,
    bpm: track.bpm ?? bpmByTrackId.get(track.id) ?? null,
  }));
}

function mapSearchItem(item: DeezerSearchItem): DeezerTrack {
  return {
    id: item.id.toString(),
    title: item.title,
    artist: item.artist?.name ?? "Unknown artist",
    durationMs: Math.max(0, Math.round((item.duration ?? 0) * 1000)),
    bpm: parseBpm(item.bpm),
    albumArt:
      item.album?.cover_xl ??
      item.album?.cover_big ??
      item.album?.cover_medium ??
      null,
    album: item.album?.title ?? "",
  };
}

async function getTrackBpmMap(tracks: DeezerTrack[]) {
  const bpmByTrackId = new Map<string, number>();

  await Promise.all(
    tracks
      .filter((track) => track.bpm == null)
      .map(async (track) => {
        const bpm = await fetchTrackBpm(track.id);
        if (bpm != null) {
          bpmByTrackId.set(track.id, bpm);
        }
      }),
  );

  return bpmByTrackId;
}

async function fetchTrackBpm(trackId: string) {
  try {
    const response = await fetch(`https://api.deezer.com/track/${trackId}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as DeezerTrackDetails;
    return parseBpm(data.bpm);
  } catch {
    return null;
  }
}

function parseBpm(value: string | number | null | undefined) {
  const bpm =
    typeof value === "number" ? value : Number.parseFloat(value ?? "");

  if (!Number.isFinite(bpm)) {
    return null;
  }

  const roundedBpm = Math.round(bpm);
  if (roundedBpm > 220 && roundedBpm <= 300) {
    return Math.round(roundedBpm / 2);
  }

  return roundedBpm >= 30 && roundedBpm <= 220 ? roundedBpm : null;
}
