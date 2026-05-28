import { NextResponse, type NextRequest } from "next/server";
import { db, ensureSetlistSongsBpmColumn } from "@workspace/db";
import { z } from "zod/v4";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function getId(context: RouteContext): Promise<number | null> {
  const params = await Promise.resolve(context.params);
  const id = Number.parseInt(params.id, 10);
  return Number.isNaN(id) ? null : id;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = await getId(context);
  if (id == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await ensureSetlistSongsBpmColumn();

    const setlist = await db.setlist.findUnique({
      where: { id },
      include: { songs: { orderBy: { position: "asc" } } },
    });

    if (!setlist) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 });
    }

    return NextResponse.json(setlist);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = await getId(context);
  if (id == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const updated = await db.setlist.updateMany({
      where: { id },
      data: { name: parsed.data.name },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 });
    }

    const setlist = await db.setlist.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(setlist);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = await getId(context);
  if (id == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await db.setlist.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
