import { NextResponse, type NextRequest } from "next/server";
import { db } from "@workspace/db";
import { z } from "zod/v4";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const setlistId = Number.parseInt(params.id, 10);
  if (Number.isNaN(setlistId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const schema = z.object({ songIds: z.array(z.number().int()) });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "songIds array required" },
      { status: 400 },
    );
  }

  try {
    await db.$transaction(
      parsed.data.songIds.map((songId, position) =>
        db.setlistSong.updateMany({
          where: { id: songId, setlistId },
          data: { position },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
