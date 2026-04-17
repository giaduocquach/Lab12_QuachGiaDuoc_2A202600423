import { NextResponse } from "next/server";

import { recordRequest } from "@/lib/day12-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  recordRequest();
  const apiKey = process.env.AGENT_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        ready: false,
        reason: "AGENT_API_KEY is missing",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ready: true });
}
