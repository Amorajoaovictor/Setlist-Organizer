import { NextResponse, type NextRequest } from "next/server";
import { db, ensureSetlistSongsBpmColumn } from "@workspace/db";
import { z } from "zod/v4";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const setlistId = Number.parseInt(params.id, 10);
  if (Number.isNaN(setlistId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const schema = z.object({
    title: z.string().min(1),
    artist: z.string().min(1),
    durationMs: z.number().int().positive(),
    bpm: z.number().int().min(30).max(300).nullable().optional(),
    deezerId: z.string().optional(),
    spotifyId: z.string().optional(),
    albumArt: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid song data" }, { status: 400 });
  }

  try {
    await ensureSetlistSongsBpmColumn();

    const maxPosition = await db.setlistSong.aggregate({
      where: { setlistId },
      _max: { position: true },
    });

    const song = await db.setlistSong.create({
      data: {
        setlistId,
        position: (maxPosition._max.position ?? -1) + 1,
        title: parsed.data.title,
        artist: parsed.data.artist,
        durationMs: parsed.data.durationMs,
        bpm: parsed.data.bpm ?? null,
        deezerId: parsed.data.deezerId ?? null,
        spotifyId: parsed.data.spotifyId ?? null,
        albumArt: parsed.data.albumArt ?? null,
      },
    });

    return NextResponse.json(song, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
