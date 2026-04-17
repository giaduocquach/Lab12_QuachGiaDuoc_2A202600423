"use client";

import { useCallback, useState } from "react";
import { Copy, Check, UserRound } from "lucide-react";
import { useBKAgent, type BKAgentState } from "@/lib/store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const FLOW_LABELS: Record<string, string> = {
  idle: "Chưa bắt đầu",
  happy: "Thành công",
  lowConfidence: "Độ tin cậy thấp",
  failure: "Thất bại",
  recovery: "Đang phục hồi",
  escalated: "Đã chuyển cố vấn",
};

export function AdvisorBriefSheet() {
  const store = useBKAgent();
  const [copied, setCopied] = useState(false);

  const brief = buildBrief(store);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(brief).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [brief]);

  function handleClose() {
    useBKAgent.setState({ advisorBriefOpen: false });
  }

  return (
    <Sheet open={store.advisorBriefOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-[520px] max-w-[90vw] overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" />
            <SheetTitle className="text-sm font-semibold">Advisor Brief</SheetTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Tóm tắt phiên tư vấn để chuyển cho cố vấn học vụ.
          </p>
        </SheetHeader>

        <div className="space-y-4">
          <pre className="rounded-lg border border-border/50 bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono">
            {brief}
          </pre>

          <Separator className="opacity-30" />

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Đã sao chép!" : "Sao chép brief"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleClose}
            >
              Đóng
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Gửi brief này cho cố vấn học vụ qua email hoặc portal của trường để được hỗ trợ trực tiếp.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function buildBrief(store: BKAgentState): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const planAList =
    store.planACourses.length > 0
      ? store.planACourses
          .map(
            (c) =>
              `  - ${c.code} ${c.name} — ${c.day} ${c.startHour}:00, phòng ${c.room ?? "?"}`
          )
          .join("\n")
      : "  (Chưa có)";

  const planBList =
    store.planBCourses.length > 0
      ? store.planBCourses
          .map(
            (c) =>
              `  - ${c.code} ${c.name} — ${c.day} ${c.startHour}:00, phòng ${c.room ?? "?"}`
          )
          .join("\n")
      : "  (Chưa có)";

  const flagsList =
    store.redFlags.length > 0
      ? store.redFlags.map((f) => `  ⚠ ${f}`).join("\n")
      : "  Không có cảnh báo";

  const recentMessages = store.messages
    .slice(-4)
    .map(
      (m) =>
        `  [${m.role === "user" ? "SV" : "AI"}] ${m.text.slice(0, 120)}${m.text.length > 120 ? "..." : ""}`
    )
    .join("\n");

  return `ADVISOR BRIEF — BKAgent v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Thời gian: ${dateStr}
Trạng thái phiên: ${FLOW_LABELS[store.flow] ?? store.flow}
Độ tin cậy: ${store.confidenceScore}/100
Kế hoạch đã chọn: ${store.selectedPlan ? `Plan ${store.selectedPlan}` : "Chưa chọn"}

KẾ HOẠCH ĐỀ XUẤT (Plan A):
${planAList}

PHƯƠNG ÁN DỰ PHÒNG (Plan B):
${planBList}

RỦI RO PHÁT HIỆN:
${flagsList}

TÓM TẮT CUỘC HỘI THOẠI GẦN NHẤT:
${recentMessages || "  (Chưa có tin nhắn)"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sinh viên cần hỗ trợ tư vấn thêm.
`;
}
