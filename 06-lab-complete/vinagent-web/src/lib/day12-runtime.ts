type Role = "user" | "assistant";

type HistoryMessage = {
  role: Role;
  content: string;
  timestamp: string;
};

type RateBucket = {
  count: number;
  expiresAt: number;
};

type RuntimeStore = {
  startTimeMs: number;
  requestCount: number;
  errorCount: number;
  historyByUser: Map<string, HistoryMessage[]>;
  rateBuckets: Map<string, RateBucket>;
  budgetByUserMonth: Map<string, number>;
};

declare global {
  // eslint-disable-next-line no-var
  var __bkagentDay12Runtime: RuntimeStore | undefined;
}

function getStore(): RuntimeStore {
  if (!globalThis.__bkagentDay12Runtime) {
    globalThis.__bkagentDay12Runtime = {
      startTimeMs: Date.now(),
      requestCount: 0,
      errorCount: 0,
      historyByUser: new Map<string, HistoryMessage[]>(),
      rateBuckets: new Map<string, RateBucket>(),
      budgetByUserMonth: new Map<string, number>(),
    };
  }
  return globalThis.__bkagentDay12Runtime;
}

export function recordRequest() {
  const store = getStore();
  store.requestCount += 1;
}

export function recordError() {
  const store = getStore();
  store.errorCount += 1;
}

export function getRuntimeStats() {
  const store = getStore();
  const uptimeSeconds = Math.max(0, (Date.now() - store.startTimeMs) / 1000);
  return {
    uptimeSeconds,
    requestCount: store.requestCount,
    errorCount: store.errorCount,
  };
}

export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, words * 2);
}

export function estimateRequestCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * 0.00015 + (outputTokens / 1000) * 0.0006;
}

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function getCurrentMonthSpend(userId: string): number {
  const store = getStore();
  return store.budgetByUserMonth.get(`${userId}:${getCurrentMonthKey()}`) ?? 0;
}

export function checkAndReserveBudget(params: {
  userId: string;
  estimatedCost: number;
  monthlyBudgetUsd: number;
}): { ok: true; projectedSpend: number } | { ok: false; projectedSpend: number } {
  const { userId, estimatedCost, monthlyBudgetUsd } = params;
  const store = getStore();
  const budgetKey = `${userId}:${getCurrentMonthKey()}`;
  const current = store.budgetByUserMonth.get(budgetKey) ?? 0;
  const projected = current + estimatedCost;

  if (projected > monthlyBudgetUsd) {
    return { ok: false, projectedSpend: projected };
  }

  store.budgetByUserMonth.set(budgetKey, projected);
  return { ok: true, projectedSpend: projected };
}

export function checkRateLimit(params: {
  userId: string;
  limitPerMinute: number;
}):
  | { ok: true; remaining: number; retryAfterSeconds: number }
  | { ok: false; remaining: 0; retryAfterSeconds: number } {
  const { userId, limitPerMinute } = params;
  const store = getStore();
  const now = Date.now();
  const minuteEpoch = Math.floor(now / 60_000);
  const key = `${userId}:${minuteEpoch}`;

  const existing = store.rateBuckets.get(key);
  const expiresAt = (minuteEpoch + 1) * 60_000;
  const bucket: RateBucket =
    existing && existing.expiresAt > now
      ? existing
      : { count: 0, expiresAt };

  bucket.count += 1;
  store.rateBuckets.set(key, bucket);

  // Best-effort cleanup for old buckets.
  for (const [bucketKey, value] of store.rateBuckets.entries()) {
    if (value.expiresAt <= now) {
      store.rateBuckets.delete(bucketKey);
    }
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
  if (bucket.count > limitPerMinute) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  return {
    ok: true,
    remaining: Math.max(0, limitPerMinute - bucket.count),
    retryAfterSeconds,
  };
}

export function getHistory(userId: string): HistoryMessage[] {
  const store = getStore();
  return store.historyByUser.get(userId) ?? [];
}

export function saveTurn(params: {
  userId: string;
  question: string;
  answer: string;
  maxMessages?: number;
}): number {
  const { userId, question, answer, maxMessages = 40 } = params;
  const store = getStore();
  const history = [...(store.historyByUser.get(userId) ?? [])];
  const nowIso = new Date().toISOString();

  history.push({ role: "user", content: question, timestamp: nowIso });
  history.push({ role: "assistant", content: answer, timestamp: nowIso });

  const trimmed = history.slice(-maxMessages);
  store.historyByUser.set(userId, trimmed);
  return trimmed.length;
}

export function hasModelApiKey() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}
