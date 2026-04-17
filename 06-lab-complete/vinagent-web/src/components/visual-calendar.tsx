"use client";

import { cn } from "@/lib/utils";
import type { CourseSlot } from "@/lib/store";
import { Card } from "@/components/ui/card";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const DAY_LABELS: Record<string, string> = {
  Mon: "Thứ 2", Tue: "Thứ 3", Wed: "Thứ 4", Thu: "Thứ 5", Fri: "Thứ 6",
};
const START_HOUR = 7;
const END_HOUR = 18;
const TOTAL_ROWS = (END_HOUR - START_HOUR) * 2;

export function VisualCalendar({
  planA,
  planB,
  showPlanB = false,
  selectedPlan,
}: {
  planA: CourseSlot[];
  planB: CourseSlot[];
  showPlanB?: boolean;
  selectedPlan: "A" | "B" | null;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  function getSlotStyle(slot: CourseSlot) {
    const top = ((slot.startHour - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
    const rawHeight = ((slot.endHour - slot.startHour) / (END_HOUR - START_HOUR)) * 100;
    // Clamp to keep cards visually consistent (avoid too short/too tall cards)
    const height = Math.max(11, Math.min(22, rawHeight));
    return { top: `${top}%`, height: `${height}%` };
  }

  function renderSlots(slots: CourseSlot[], plan: "A" | "B") {
    const isActive = selectedPlan === plan || selectedPlan === null;
    // When both plans shown, split each column: A on left half, B on right half
    const colWidth = showPlanB ? 100 / 5 / 2 : 100 / 5;
    const colOffset = plan === "B" && showPlanB ? colWidth : 0;

    return slots.map((slot, idx) => {
      const dayIdx = DAYS.indexOf(slot.day);
      if (dayIdx < 0) return null;
      const style = getSlotStyle(slot);
      return (
        <div
          key={`${plan}-${slot.code}-${slot.day}-${idx}`}
          className={cn(
            "absolute rounded-md border px-1.5 py-1 text-[10px] font-medium leading-tight transition-opacity overflow-hidden",
            plan === "A"
              ? "bg-primary text-white border-primary shadow-sm"
              : "bg-gold text-foreground border-gold/60 shadow-sm",
            !isActive && "opacity-30",
          )}
          style={{
            ...style,
            left: `${(dayIdx / 5) * 100 + colOffset}%`,
            width: `${colWidth}%`,
            paddingLeft: "4px",
            paddingRight: "4px",
          }}
          title={`${slot.code} ${slot.name}\n${slot.day} ${slot.startHour}:00–${slot.endHour}:00\n${slot.room ?? ""}${slot.slotsRemaining != null ? `\nCòn ${slot.slotsRemaining}/${slot.capacity ?? "?"} chỗ` : ""}`}
        >
          <span className="font-semibold">{slot.code}</span>
          <br />
          <span className="opacity-80 truncate block">{slot.name}</span>
          {slot.room && <><span className="opacity-60 truncate block">{slot.room}</span></>}
          {slot.slotsRemaining != null && (
            <span className={cn(
              "mt-0.5 flex items-center gap-0.5 truncate",
              slot.seatRisk === "high"
                ? plan === "A" ? "text-yellow-200" : "text-red-700"
                : "opacity-70"
            )}>
              {slot.seatRisk === "high" && "⚠ "}
              {slot.slotsRemaining}/{slot.capacity ?? "?"} chỗ
            </span>
          )}
        </div>
      );
    });
  }

  return (
    <Card className="border-border/50 bg-card overflow-hidden">
      <div className="grid grid-cols-[48px_repeat(5,1fr)] border-b border-border/50">
        <div className="p-2" />
        {DAYS.map((d) => (
          <div key={d} className="border-l border-border/30 p-2 text-center text-[11px] font-medium text-muted-foreground leading-normal">
            {DAY_LABELS[d]}
          </div>
        ))}
      </div>
      <div className="relative grid grid-cols-[48px_1fr]" style={{ minHeight: `${TOTAL_ROWS * 20}px` }}>
        <div className="relative">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-2 font-mono text-[10px] text-muted-foreground"
              style={{ top: `${((h - START_HOUR) / (END_HOUR - START_HOUR)) * 100}%`, transform: "translateY(-50%)" }}
            >
              {h}:00
            </div>
          ))}
        </div>
        <div className="relative">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute inset-x-0 border-t border-dashed border-border/30"
              style={{ top: `${((h - START_HOUR) / (END_HOUR - START_HOUR)) * 100}%` }}
            />
          ))}
          {renderSlots(planA, "A")}
          {showPlanB && renderSlots(planB, "B")}
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-border/50 px-3 py-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" />
          <span className="text-muted-foreground font-medium">Plan A — Tối ưu</span>
        </div>
        {showPlanB && (
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-gold" />
            <span className="text-muted-foreground font-medium">Plan B — Dự phòng</span>
          </div>
        )}
      </div>
    </Card>
  );
}
