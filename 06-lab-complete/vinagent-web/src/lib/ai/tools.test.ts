import { describe, expect, it } from "vitest";
import { generateScheduleTool } from "./tools";

type GeneratedPlanItem = {
  code: string;
  name: string;
};

describe("generateScheduleTool", () => {
  it("keeps both requested subjects for HK 20252 scenario", async () => {
    const raw = await generateScheduleTool.invoke({
      target_courses: ["Giải tích II", "Vật lý II"],
      avoid_morning: true,
      avoid_afternoon: false,
      prefer_group_friends: false,
    });

    const parsed = JSON.parse(String(raw)) as {
      planA: GeneratedPlanItem[] | null;
      planB: GeneratedPlanItem[] | null;
      targetCourses: string[];
    };

    expect(parsed.planA).not.toBeNull();
    expect(parsed.planB).not.toBeNull();

    expect(parsed.targetCourses.some((c) => c.startsWith("MI"))).toBe(true);
    expect(parsed.targetCourses.some((c) => c.startsWith("PH"))).toBe(true);

    const codesA = new Set((parsed.planA ?? []).map((p) => p.code));
    const codesB = new Set((parsed.planB ?? []).map((p) => p.code));
    expect(parsed.targetCourses.every((c) => codesA.has(c))).toBe(true);
    expect(parsed.targetCourses.every((c) => codesB.has(c))).toBe(true);
  });
});
