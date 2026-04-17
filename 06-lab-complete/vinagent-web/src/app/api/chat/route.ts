import { NextRequest, NextResponse } from "next/server";
import { streamAgent } from "@/lib/ai/agent";
import type { Citation } from "@/lib/citations";
import {
  checkPrerequisitesTool,
  generateScheduleTool,
  getRecommendedCoursesTool,
} from "@/lib/ai/tools";

export type ChatRequestBody = {
  message: string;
  history?: { role: "user" | "model"; text: string }[];
  aiConfig?: { provider: "gemini" | "chatgpt"; apiKey?: string };
};

type PlanItem = {
  code: string;
  name: string;
  day: string;
  startHour: number;
  endHour: number;
  room: string;
  enrolled?: number;
  capacity?: number;
  slotsRemaining?: number;
  seatRisk?: "low" | "medium" | "high";
  classId: string;
};

export type DoneEvent = {
  type: "done";
  text: string;
  citations: Citation[];
  confidenceScore: number;
  flow: "happy" | "lowConfidence" | "failure";
  planA: PlanItem[] | null;
  planB: PlanItem[] | null;
  toolsUsed: string[];
  suggestions: string[];
};

function normalizeText(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectRequiredCourseCodes(message: string): string[] {
  const msg = normalizeText(message);
  const matched = new Set<string>();
  const rules: Array<{ code: string; patterns: RegExp[] }> = [
    {
      code: "MI1124",
      patterns: [/giai\s*tich\s*(ii|2)\b/, /\bmi1124\b/i],
    },
    {
      code: "PH1120",
      patterns: [/vat\s*ly\s*(ii|2)\b/, /\bph1120\b/i],
    },
  ];
  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(msg))) {
      matched.add(rule.code);
    }
  }
  return [...matched];
}

function enrichMessageWithRequiredCourses(message: string) {
  const requiredCodes = detectRequiredCourseCodes(message);
  if (requiredCodes.length === 0) return message;
  return `${message}\n\n[RÀNG BUỘC HỆ THỐNG: Đây là các môn BẮT BUỘC trong kết quả và không được bỏ sót: ${requiredCodes.join(", ")}. Nếu có mã tương đương đang mở lớp thì vẫn phải đảm bảo đúng 2 môn tương ứng.]`;
}

function extractExplicitCourseCodes(message: string): string[] {
  const matches = message.toUpperCase().match(/\b[A-Z]{2,}\d{3,4}[A-Z]?\b/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

function hasConfiguredModelKey(config?: {
  provider: "gemini" | "chatgpt";
  apiKey?: string;
}): boolean {
  if (config?.apiKey?.trim()) return true;
  const provider = config?.provider ?? "gemini";
  if (provider === "chatgpt") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.GEMINI_API_KEY);
}

function formatHour(hour: number): string {
  const whole = Math.floor(hour);
  const mins = hour - whole >= 0.5 ? "30" : "00";
  return `${whole}:${mins}`;
}

function formatCourseLine(course: PlanItem): string {
  const seats =
    typeof course.slotsRemaining === "number" && typeof course.capacity === "number"
      ? ` (còn ${Math.max(0, course.slotsRemaining)}/${course.capacity} chỗ trống)`
      : "";
  return `- ${course.code} (${course.name}) — ${course.day} ${formatHour(course.startHour)}-${formatHour(course.endHour)}, phòng ${course.room}${seats}`;
}

export async function buildFallbackDoneEvent(message: string): Promise<DoneEvent> {
  const required = detectRequiredCourseCodes(message);
  const explicit = extractExplicitCourseCodes(message);
  let targetCourses = [...new Set([...required, ...explicit])];

  if (targetCourses.length === 0) {
    const recommendedRaw = await getRecommendedCoursesTool.invoke({});
    const recommended = JSON.parse(String(recommendedRaw)) as {
      mandatoryPending?: Array<{ code: string }>;
    };
    targetCourses = (recommended.mandatoryPending ?? [])
      .map((item) => item.code)
      .filter(Boolean)
      .slice(0, 6);
  }

  if (targetCourses.length === 0) {
    targetCourses = ["MI1124", "PH1120", "IT3090", "SSH1111", "PE1010"];
  }

  const prereqRaw = await checkPrerequisitesTool.invoke({
    course_codes: targetCourses,
  });
  const prereq = JSON.parse(String(prereqRaw)) as {
    allOk: boolean;
    results?: Array<{ course: string; ok: boolean; missing?: string[] }>;
    _citation?: { detail?: string };
  };

  const scheduleRaw = await generateScheduleTool.invoke({
    target_courses: targetCourses,
    avoid_morning: false,
    avoid_afternoon: false,
    prefer_group_friends: false,
  });
  const schedule = JSON.parse(String(scheduleRaw)) as {
    planA: PlanItem[] | null;
    planB: PlanItem[] | null;
    planAScore?: number;
    planBScore?: number;
    targetCourses?: string[];
    _citation?: { detail?: string };
  };

  const planA = schedule.planA ?? null;
  const planB = schedule.planB ?? null;

  const scoreA = Number(schedule.planAScore ?? 0);
  const scoreB = Number(schedule.planBScore ?? 0);
  const confidenceScore = Math.max(45, Math.min(95, Math.max(scoreA, scoreB, 68)));

  let flow: DoneEvent["flow"] = "happy";
  if (!planA && !planB) {
    flow = "failure";
  } else if (!prereq.allOk || confidenceScore < 80) {
    flow = "lowConfidence";
  }

  const citations: Citation[] = [
    {
      id: 1,
      type: "regulation",
      title: "BKAgent Local Fallback",
      detail:
        "Chưa có API key AI nên hệ thống dùng chế độ local planner để vẫn tạo Plan A/B từ dữ liệu mock BKAgent.",
      timestamp: new Date().toLocaleString("vi-VN"),
    },
    {
      id: 2,
      type: "sis",
      title: "Thuật toán xếp lịch — BKAgent Scheduler",
      detail:
        schedule._citation?.detail ??
        "Đã xếp lịch bằng generate_schedule từ dữ liệu lớp học HK 20252.",
      timestamp: new Date().toLocaleString("vi-VN"),
    },
    {
      id: 3,
      type: "prerequisite",
      title: "Kiểm tra điều kiện tiên quyết",
      detail:
        prereq._citation?.detail ??
        "Đã kiểm tra điều kiện tiên quyết cho các môn mục tiêu.",
      timestamp: new Date().toLocaleString("vi-VN"),
    },
  ];

  const targetText = (schedule.targetCourses ?? targetCourses).join(", ");
  const lines: string[] = [
    `BKAgent đang chạy ở chế độ local planner (không cần nhập API key) [1].`,
    `Đã xử lý yêu cầu cho các môn: ${targetText} [2].`,
    "",
    "Plan A — Tối ưu:",
  ];

  if (planA && planA.length > 0) {
    for (const item of planA.slice(0, 8)) {
      lines.push(formatCourseLine(item));
    }
  } else {
    lines.push("- Chưa tạo được Plan A phù hợp.");
  }

  lines.push("", "Plan B — Dự phòng:");
  if (planB && planB.length > 0) {
    for (const item of planB.slice(0, 8)) {
      lines.push(formatCourseLine(item));
    }
  } else {
    lines.push("- Chưa tạo được Plan B phù hợp.");
  }

  if (!prereq.allOk) {
    const missing = (prereq.results ?? [])
      .filter((r) => !r.ok)
      .map((r) => `${r.course} (thiếu: ${(r.missing ?? []).join(", ")})`)
      .join("; ");
    lines.push("", `Lưu ý tiên quyết: ${missing || "Một số môn chưa đủ điều kiện."} [3].`);
  }

  return {
    type: "done",
    text: lines.join("\n"),
    citations,
    confidenceScore,
    flow,
    planA,
    planB,
    toolsUsed: ["get_recommended_courses", "check_prerequisites", "generate_schedule"],
    suggestions: [
      "So sánh nhanh Plan A và Plan B cho tôi",
      "Tôi muốn tránh lịch sáng, hãy xếp lại",
      "Môn nào rủi ro hết chỗ cao nhất trong kế hoạch này",
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const provider = body.aiConfig?.provider;
    const aiConfig =
      provider === "gemini" || provider === "chatgpt"
        ? { provider, apiKey: body.aiConfig?.apiKey?.trim() || undefined }
        : undefined;

    if (!body.message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const enrichedMessage = enrichMessageWithRequiredCourses(body.message);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const pushEvent = (event: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          };

          if (!hasConfiguredModelKey(aiConfig)) {
            pushEvent({
              type: "tool_start",
              tool: "get_recommended_courses",
              label: "Đang tra cứu danh sách môn từ dữ liệu BKAgent...",
            });
            pushEvent({
              type: "tool_end",
              tool: "get_recommended_courses",
              label: "Đã lấy danh sách môn đề xuất.",
            });
            pushEvent({
              type: "tool_start",
              tool: "check_prerequisites",
              label: "Đang kiểm tra điều kiện tiên quyết...",
            });
            pushEvent({
              type: "tool_end",
              tool: "check_prerequisites",
              label: "Đã kiểm tra điều kiện tiên quyết.",
            });
            pushEvent({
              type: "tool_start",
              tool: "generate_schedule",
              label: "Đang tạo Plan A + Plan B từ lịch học hiện có...",
            });
            const fallbackDone = await buildFallbackDoneEvent(enrichedMessage);
            pushEvent({
              type: "tool_end",
              tool: "generate_schedule",
              label: "Đã tạo xong kế hoạch dự phòng local.",
            });
            pushEvent(fallbackDone);
          } else {
            for await (const event of streamAgent(enrichedMessage, body.history || [], aiConfig)) {
              pushEvent(event as unknown as Record<string, unknown>);
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Agent error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[/api/chat] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
