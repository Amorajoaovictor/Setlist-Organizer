import { NextResponse, type NextRequest } from "next/server";
import {
  getSongLyrics,
  linesFromPlainLyrics,
  saveSongLyrics,
} from "@workspace/db";
import { z } from "zod/v4";

type RouteContext = {
  params:
    | Promise<{ id: string; songId: string }>
    | { id: string; songId: string };
};

const lyricLineSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string().min(1),
  startMs: z.number().int().nonnegative().nullable(),
});

const saveLyricsSchema = z.object({
  source: z.enum(["lrclib", "manual"]).default("manual"),
  lrclibId: z.number().int().nullable().optional(),
  plainLyrics: z.string().default(""),
  syncedLyrics: z.string().nullable().optional(),
  lines: z.array(lyricLineSchema).optional(),
  bpm: z.number().int().min(30).max(300).nullable().optional(),
});

async function getIds(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const setlistId = Number.parseInt(params.id, 10);
  const songId = Number.parseInt(params.songId, 10);

  if (Number.isNaN(setlistId) || Number.isNaN(songId)) {
    return null;
  }

  return { setlistId, songId };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const ids = await getIds(context);
  if (!ids) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const lyrics = await getSongLyrics(ids.setlistId, ids.songId);
    if (!lyrics) {
      return NextResponse.json({ error: "Lyrics not found" }, { status: 404 });
    }

    return NextResponse.json(lyrics);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const ids = await getIds(context);
  if (!ids) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const parsed = saveLyricsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lyrics data" }, { status: 400 });
  }

  try {
    const lyrics = await saveSongLyrics({
      ...ids,
      ...parsed.data,
      lines:
        parsed.data.lines ??
        linesFromPlainLyrics(parsed.data.plainLyrics),
    });

    if (!lyrics) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    return NextResponse.json(lyrics);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
