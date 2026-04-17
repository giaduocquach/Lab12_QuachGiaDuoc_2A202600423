"use client";

import { useState } from "react";
import { RefreshCw, Pencil } from "lucide-react";
import { useBKAgent, type CourseSlot } from "@/lib/store";
import scheduleData from "@/lib/mock/schedule.json";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type ScheduleSlot = {
  classId: string;
  courseCode: string;
  courseNameVi: string;
  day: string;
  startHour: number;
  endHour: number;
  room: string;
  enrolled: number;
  capacity: number;
};

const DAY_VI: Record<string, string> = {
  Mon: "Thứ 2",
  Tue: "Thứ 3",
  Wed: "Thứ 4",
  Thu: "Thứ 5",
  Fri: "Thứ 6",
  Sat: "Thứ 7",
};

function formatSlot(s: ScheduleSlot) {
  const hr = s.startHour;
  const hEnd = s.endHour;
  const fmtHr = (h: number) =>
    `${Math.floor(h)}:${h % 1 === 0.5 ? "30" : "00"}`;
  const risk = s.capacity - s.enrolled;
  const riskLabel = risk <= 5 ? " ⚠ hết chỗ" : risk <= 20 ? " · gần đầy" : "";
  return `${DAY_VI[s.day] ?? s.day} ${fmtHr(hr)}–${fmtHr(hEnd)} · ${s.room}${riskLabel}`;
}

export function EditPlanSheet() {
  const store = useBKAgent();
  const activeCourses =
    store.selectedPlan === "B" ? store.planBCourses : store.planACourses;

  const [swaps, setSwaps] = useState<Record<string, string>>({});

  function getAlternatives(code: string): ScheduleSlot[] {
    return (scheduleData as ScheduleSlot[]).filter(
      (s) => s.courseCode === code
    );
  }

  function handleSubmit() {
    const changes = Object.entries(swaps)
      .map(([code, classId]) => {
        const slot = (scheduleData as ScheduleSlot[]).find(
          (s) => s.classId === classId
        );
        if (!slot) return null;
        return `${code} chuyển sang ${DAY_VI[slot.day] ?? slot.day} ${slot.startHour}:00, phòng ${slot.room}`;
      })
      .filter(Boolean);

    if (changes.length === 0) {
      store.closeEditPlan();
      return;
    }

    const prompt = `Tôi muốn điều chỉnh lịch học như sau:\n${changes.map((c) => `- ${c}`).join("\n")}\nVui lòng tạo lại kế hoạch với các điều chỉnh này.`;
    store.closeEditPlan();
    store.generate(prompt);
  }

  return (
    <Sheet
      open={store.editPlanOpen}
      onOpenChange={(open) => {
        if (open) {
          setSwaps({});
          return;
        }
        store.closeEditPlan();
      }}
    >
      <SheetContent className="w-[520px] max-w-[90vw] overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            <SheetTitle className="text-sm font-semibold">Chỉnh sửa kế hoạch</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            Chọn slot thay thế cho từng môn. Nhấn &ldquo;Tái tạo&rdquo; để AI cập nhật kế hoạch.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {activeCourses.map((course: CourseSlot) => {
            const alts = getAlternatives(course.code);
            const currentClassId = alts.find(
              (s) =>
                s.day === course.day &&
                s.startHour === course.startHour
            )?.classId;

            return (
              <div key={course.code} className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {course.code} — {course.name}
                </Label>
                <Select
                  value={swaps[course.code] ?? currentClassId ?? ""}
                  onValueChange={(val) =>
                    setSwaps((prev) => ({ ...prev, [course.code]: val ?? "" }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Chọn slot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {alts.map((s) => (
                      <SelectItem key={s.classId} value={s.classId} className="text-xs">
                        {formatSlot(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          {activeCourses.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Chưa có kế hoạch để chỉnh sửa.
            </p>
          )}

          <Separator className="opacity-30" />

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              disabled={Object.keys(swaps).length === 0}
              onClick={handleSubmit}
            >
              <RefreshCw className="size-3" />
              Tái tạo với thay đổi
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={store.closeEditPlan}
            >
              Hủy
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
