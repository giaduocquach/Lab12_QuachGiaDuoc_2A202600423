import { describe, expect, it } from "vitest";
import { evaluatePlannerDecision } from "./planner";

describe("evaluatePlannerDecision", () => {
  it("returns non-failure flow for clear intent", () => {
    const result = evaluatePlannerDecision(
      "len lich hk xuan 2026 tranh sang va co giai tich 2",
    );
    expect(["happy", "lowConfidence"]).toContain(result.flow);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(50);
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it("returns cautious flow for vague input", () => {
    const result = evaluatePlannerDecision("help");
    expect(["lowConfidence", "failure"]).toContain(result.flow);
    expect(result.confidenceScore).toBeLessThan(80);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0].citationIds.length).toBeGreaterThan(0);
  });

  it("returns failure for stale / high-risk input", () => {
    const result = evaluatePlannerDecision("high risk stale near full");
    expect(result.flow).toBe("failure");
    expect(result.needsPlanBFallback).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
  });
});
