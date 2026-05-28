import { NextResponse, type NextRequest } from "next/server";
import {
  db,
  ensureSetlistSongsBpmColumn,
  fetchLrclibLyrics,
} from "@workspace/db";

type RouteContext = {
  params:
    | Promise<{ id: string; songId: string }>
    | { id: string; songId: string };
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const setlistId = Number.parseInt(params.id, 10);
  const songId = Number.parseInt(params.songId, 10);

  if (Number.isNaN(setlistId) || Number.isNaN(songId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await ensureSetlistSongsBpmColumn();

    const song = await db.setlistSong.findFirst({
      where: { id: songId, setlistId },
    });

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const lyrics = await fetchLrclibLyrics({
      trackName: song.title,
      artistName: song.artist,
      durationMs: song.durationMs,
    });

    if (!lyrics) {
      return NextResponse.json(
        { error: "Lyrics not found on LRCLIB" },
        { status: 404 },
      );
    }

    return NextResponse.json(lyrics);
  } catch {
    return NextResponse.json(
      { error: "Failed to search LRCLIB" },
      { status: 500 },
    );
  }
}
