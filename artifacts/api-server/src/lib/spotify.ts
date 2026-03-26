import { logger } from "./logger";

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 5000) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify token error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  logger.info("Refreshed Spotify access token");
  return cachedToken;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  albumArt: string | null;
  album: string;
}

export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  const token = await getAccessToken();

  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "10");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify search error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    tracks: {
      items: Array<{
        id: string;
        name: string;
        duration_ms: number;
        album: {
          name: string;
          images: Array<{ url: string; width: number; height: number }>;
        };
        artists: Array<{ name: string }>;
      }>;
    };
  };

  return data.tracks.items.map((item) => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map((a) => a.name).join(", "),
    durationMs: item.duration_ms,
    albumArt: item.album.images[0]?.url ?? null,
    album: item.album.name,
  }));
}
