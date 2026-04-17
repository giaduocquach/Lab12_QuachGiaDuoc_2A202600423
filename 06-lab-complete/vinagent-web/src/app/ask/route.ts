import { NextRequest, NextResponse } from "next/server";

import { buildFallbackDoneEvent } from "@/app/api/chat/route";
import { runAgent } from "@/lib/ai/agent";
import {
  checkAndReserveBudget,
  checkRateLimit,
  estimateRequestCost,
  estimateTokens,
  getHistory,
  hasModelApiKey,
  recordError,
  recordRequest,
  saveTurn,
} from "@/lib/day12-runtime";

export const dynamic = "force-dynamic";

type AskRequestBody = {
  user_id?: string;
  question?: string;
};

function getRateLimitPerMinute() {
  const parsed = Number(process.env.RATE_LIMIT_PER_MINUTE ?? "10");
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return 10;
}

function getMonthlyBudgetUsd() {
  const parsed = Number(process.env.MONTHLY_BUDGET_USD ?? "10");
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 10;
}

function getModelName() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.DEFAULT_MODEL ?? "gemini-2.5-flash";
  }
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_MODEL ?? process.env.LLM_MODEL ?? "gpt-4o-mini";
  }
  return "local-planner";
}

function mapHistoryForAgent(
  history: ReturnType<typeof getHistory>
): { role: "user" | "model"; text: string }[] {
  return history
    .filter((item) => item.content && item.content.trim())
    .map((item) => ({
      role: item.role === "user" ? "user" : "model",
      text: item.content,
    }));
}

function unauthorized() {
  return NextResponse.json(
    { detail: "Invalid or missing API key. Include X-API-Key header." },
    { status: 401 }
  );
}

export async function POST(req: NextRequest) {
  recordRequest();

  try {
    const configuredApiKey = process.env.AGENT_API_KEY?.trim();
    const incomingApiKey = req.headers.get("x-api-key")?.trim();

    if (!configuredApiKey || !incomingApiKey || incomingApiKey !== configuredApiKey) {
      return unauthorized();
    }

    const body = (await req.json()) as AskRequestBody;
    const userId = String(body.user_id ?? "").trim();
    const question = String(body.question ?? "").trim();

    if (!userId || !question) {
      return NextResponse.json(
        { detail: "user_id and question are required." },
        { status: 400 }
      );
    }

    const rateResult = checkRateLimit({
      userId,
      limitPerMinute: getRateLimitPerMinute(),
    });
    if (!rateResult.ok) {
      return NextResponse.json(
        {
          detail: `Rate limit exceeded: ${getRateLimitPerMinute()} req/min`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateResult.retryAfterSeconds),
          },
        }
      );
    }

    const estimatedCost = estimateRequestCost(estimateTokens(question), 250);
    const budgetResult = checkAndReserveBudget({
      userId,
      estimatedCost,
      monthlyBudgetUsd: getMonthlyBudgetUsd(),
    });
    if (!budgetResult.ok) {
      return NextResponse.json(
        {
          detail: "Monthly budget exceeded",
        },
        { status: 402 }
      );
    }

    const history = getHistory(userId);
    const previousUserMessage = [...history]
      .reverse()
      .find((item) => item.role === "user")?.content;

    let answer: string;
    if (hasModelApiKey()) {
      try {
        const result = await runAgent(question, mapHistoryForAgent(history), undefined);
        answer = result.text;
      } catch {
        const fallback = await buildFallbackDoneEvent(question);
        answer = fallback.text;
      }
    } else {
      const fallback = await buildFallbackDoneEvent(question);
      answer = fallback.text;
    }

    if (previousUserMessage) {
      answer = `${answer}\n\nContext from previous turn: "${previousUserMessage}".`;
    }

    const historySize = saveTurn({ userId, question, answer });

    return NextResponse.json({
      user_id: userId,
      question,
      answer,
      model: getModelName(),
      history_size: historySize,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordError();
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
