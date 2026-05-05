import { NextResponse, type NextRequest } from "next/server";
import { db } from "@workspace/db";

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
