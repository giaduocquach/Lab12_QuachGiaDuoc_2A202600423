import { NextResponse } from "next/server";

import { recordRequest } from "@/lib/day12-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  recordRequest();

  return NextResponse.json({
    app: process.env.APP_NAME ?? "Production AI Agent",
    version: process.env.APP_VERSION ?? "1.0.0",
    environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    endpoints: {
      ask: "POST /ask (requires X-API-Key)",
      health: "GET /health",
      ready: "GET /ready",
      chat: "POST /api/chat",
      api_info: "GET /api-info",
    },
  });
}
