import { NextResponse, type NextRequest } from "next/server";
import { createBpmPreset, listBpmPresets } from "@workspace/db";
import { z } from "zod/v4";

const bpmPresetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  bpm: z.number().int().min(30).max(300),
  timeSignature: z.enum(["2/4", "3/4", "4/4", "6/8"]),
  accentFirstBeat: z.boolean(),
  subdivision: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  soundStyle: z.enum(["classic", "wood", "soft"]),
});

export async function GET() {
  try {
    const presets = await listBpmPresets();
    return NextResponse.json(presets);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const parsed = bpmPresetSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid BPM preset data" }, { status: 400 });
  }

  try {
    const preset = await createBpmPreset(parsed.data);
    return NextResponse.json(preset, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
