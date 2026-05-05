import { NextResponse, type NextRequest } from "next/server";
import { searchTracks } from "@/server/spotify";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 },
    );
  }

  try {
    const tracks = await searchTracks(q);
    return NextResponse.json(tracks);
  } catch {
    return NextResponse.json(
      { error: "Failed to search Spotify" },
      { status: 500 },
    );
  }
}
