import { NextResponse } from "next/server";

import { getSpleeterIntegrationStatus } from "@/server/spleeter";

export async function GET() {
  return NextResponse.json(getSpleeterIntegrationStatus());
}
