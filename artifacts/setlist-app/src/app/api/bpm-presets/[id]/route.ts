import { NextResponse, type NextRequest } from "next/server";
import { deleteBpmPreset } from "@workspace/db";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const id = Number.parseInt(params.id, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const deleted = await deleteBpmPreset(id);

    if (!deleted) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
