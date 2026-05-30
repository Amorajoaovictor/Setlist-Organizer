import { NextResponse, type NextRequest } from "next/server";
import { db, ensureSetlistSongsBpmColumn } from "@workspace/db";
import { z } from "zod/v4";

type RouteContext = {
  params:
    | Promise<{ id: string; songId: string }>
    | { id: string; songId: string };
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const songId = Number.parseInt(params.songId, 10);
  if (Number.isNaN(songId)) {
    return NextResponse.json({ error: "Invalid songId" }, { status: 400 });
  }

  try {
    await db.setlistSong.deleteMany({ where: { id: songId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const setlistId = Number.parseInt(params.id, 10);
  const songId = Number.parseInt(params.songId, 10);

  if (Number.isNaN(setlistId) || Number.isNaN(songId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const schema = z.object({
    bpm: z.number().int().min(30).max(300).nullable(),
  });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid song data" }, { status: 400 });
  }

  try {
    await ensureSetlistSongsBpmColumn();

    const result = await db.setlistSong.updateMany({
      where: { id: songId, setlistId },
      data: { bpm: parsed.data.bpm },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const song = await db.setlistSong.findUnique({ where: { id: songId } });
    return NextResponse.json(song);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
