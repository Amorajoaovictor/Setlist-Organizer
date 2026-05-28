import { NextResponse, type NextRequest } from "next/server";
import { db, ensureSetlistSongsBpmColumn } from "@workspace/db";
import { z } from "zod/v4";

export async function GET() {
  try {
    await ensureSetlistSongsBpmColumn();

    const rows = await db.setlist.findMany({
      include: { songs: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      rows.map((setlist) => ({
        id: setlist.id,
        name: setlist.name,
        createdAt: setlist.createdAt,
        songCount: setlist.songs.length,
        totalDurationMs: setlist.songs.reduce(
          (total, song) => total + song.durationMs,
          0,
        ),
      })),
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const setlist = await db.setlist.create({
      data: { name: parsed.data.name },
    });

    return NextResponse.json(
      {
        ...setlist,
        songCount: 0,
        totalDurationMs: 0,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
