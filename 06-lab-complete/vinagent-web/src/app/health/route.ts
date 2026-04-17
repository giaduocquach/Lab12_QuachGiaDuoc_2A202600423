import { NextResponse } from "next/server";

import {
  getRuntimeStats,
  hasModelApiKey,
  recordRequest,
} from "@/lib/day12-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  recordRequest();
  const stats = getRuntimeStats();

  return NextResponse.json({
    status: "ok",
    version: process.env.APP_VERSION ?? "1.0.0",
    environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    uptime_seconds: Number(stats.uptimeSeconds.toFixed(1)),
    total_requests: stats.requestCount,
    error_count: stats.errorCount,
    checks: {
      redis: process.env.REDIS_URL ? "ok" : "not-configured",
      llm: hasModelApiKey() ? "configured" : "mock",
    },
    timestamp: new Date().toISOString(),
  });
}
