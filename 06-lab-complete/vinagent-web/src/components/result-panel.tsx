"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, UserRound, ChevronDown, ChevronUp, Users, CheckCircle2, CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBKAgent } from "@/lib/store";
import { VisualCalendar } from "./visual-calendar";
import { CitationList } from "./citation-popover";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AdvisorBriefSheet } from "./advisor-brief-sheet";
import { EditPlanSheet } from "./edit-plan-sheet";
import { RegisterDialog } from "./register-dialog";
import { GroupInviteSheet } from "./group-invite-sheet";

function computePlanConfidence(
  courses: { slotsRemaining?: number; capacity?: number; seatRisk?: "low" | "medium" | "high"; day: string; startHour: number; endHour: number }[]
) {
  if (courses.length === 0) return 0;
  // Weighted reliability score (spec-aligned trust gate):
  // - Seat pressure / risk (60%)
  // - Schedule feasibility/stability (25%)
  // - Distribution comfort (15%)
  const seatScores = courses.map((c) => {
    const cap = c.capacity ?? 0;
    const remaining = c.slotsRemaining ?? cap;
    const ratio = cap > 0 ? remaining / cap : 0.5;
    let score = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    if (c.seatRisk === "high") score -= 18;
    else if (c.seatRisk === "medium") score -= 8;
    if (remaining <= 3) score -= 12;
    else if (remaining <= 8) score -= 6;
    return Math.max(0, score);
  });
  const seatComponent =
    seatScores.reduce((sum, v) => sum + v, 0) / seatScores.length;

  // Feasibility proxy: avoid overloaded same-day blocks
  const dayLoad: Record<string, number> = {};
  for (const c of courses) dayLoad[c.day] = (dayLoad[c.day] ?? 0) + (c.endHour - c.startHour);
  const maxDayLoad = Math.max(...Object.values(dayLoad));
  const feasibilityComponent = Math.max(55, 100 - Math.round((maxDayLoad - 3) * 10));

  // Distribution proxy: penalize too many classes same day
  const maxCountSameDay = Math.max(
    ...Object.keys(dayLoad).map((d) => courses.filter((c) => c.day === d).length)
  );
  const distributionComponent = maxCountSameDay >= 3 ? 70 : maxCountSameDay === 2 ? 85 : 95;

  const finalScore =
    seatComponent * 0.6 + feasibilityComponent * 0.25 + distributionComponent * 0.15;
  return Math.max(35, Math.min(99, Math.round(finalScore)));
}

function ConfidenceBar({
  planAScore,
  planBScore,
}: {
  planAScore: number;
  planBScore: number;
}) {
  const aLabel = planAScore >= 80 ? "An toàn" : planAScore >= 60 ? "Cần kiểm tra" : "Rủi ro";
  const bLabel = planBScore >= 80 ? "An toàn" : planBScore >= 60 ? "Cần kiểm tra" : "Rủi ro";

  return (
    <div className="rounded-lg bg-primary text-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-base font-bold text-white/95 hover:text-white transition-colors"
                  >
                    Độ tin cậy từng plan
                    <CircleHelp className="size-3.5 opacity-80" />
                  </button>
                }
              />
              <TooltipContent className="max-w-sm border border-white/20 bg-white text-primary px-3 py-2 leading-relaxed">
                Điểm plan = 60% dựa vào số chỗ trống của lớp + 25% dựa vào việc lịch có bị dồn trong 1 ngày hay không + 15% dựa vào việc môn học có được trải đều trong tuần. Kết quả cuối cùng luôn nằm trong khoảng 35-99.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-bold text-white">
            A: {planAScore}<span className="text-[10px] font-normal text-white/70">/100</span>
          </p>
          <p className="font-mono text-base font-bold text-yellow-200">
            B: {planBScore}<span className="text-[10px] font-normal text-white/70">/100</span>
          </p>
        </div>
      </div>
      <div className="space-y-1 px-4 pb-3">
        <div>
          <div className="mb-0.5 flex items-center justify-between text-[10px] text-white/80">
            <span>Plan A • {aLabel}</span>
            <span>{planAScore}/100</span>
          </div>
          <Progress value={planAScore} className="h-1.5 bg-white/20 [&>div]:bg-white" />
        </div>
        <div>
          <div className="mb-0.5 flex items-center justify-between text-[10px] text-white/80">
            <span>Plan B • {bLabel}</span>
            <span>{planBScore}/100</span>
          </div>
          <Progress value={planBScore} className="h-1.5 bg-white/20 [&>div]:bg-yellow-300" />
        </div>
      </div>
    </div>
  );
}

function RedFlagBanner({ flags, onAcknowledge }: { flags: string[]; onAcknowledge: () => void }) {
  if (flags.length === 0) return null;
  return (
    <Alert variant="destructive" className="border-danger/20 bg-danger/5">
      <AlertTriangle className="size-4" />
      <AlertTitle className="text-xs font-semibold leading-normal">
        Cảnh báo ({flags.length})
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-1">
          {flags.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-danger" />
              {f}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 text-[11px] border-danger/30 text-danger hover:bg-danger/10"
          onClick={onAcknowledge}
        >
          Đánh dấu đã xử lý
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function PlanListView({ courses, plan }: { courses: { code: string; name: string; day: string; startHour: number; endHour: number; room?: string; enrolled?: number; capacity?: number; slotsRemaining?: number; seatRisk?: "low" | "medium" | "high" }[]; plan: "A" | "B" }) {
  return (
    <div className="space-y-2">
      {courses.map((c, idx) => (
        <div key={`${plan}-${c.code}-${c.day}-${idx}`} className="flex items-center gap-3 rounded-lg border border-border bg-white shadow-sm p-3">
          <span className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold",
            plan === "A" ? "bg-primary text-white" : "bg-gold text-foreground",
          )}>
            {c.code.slice(-3)}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-bold leading-normal", plan === "A" ? "text-primary" : "text-[oklch(0.65_0.15_86)]")}>
              {c.code} — {c.name}
            </p>
            <p className="text-xs text-muted-foreground leading-normal">
              {c.day} {c.startHour}:00–{c.endHour > Math.floor(c.endHour) ? `${Math.floor(c.endHour)}:30` : `${c.endHour}:00`} · {c.room}
              {typeof c.slotsRemaining === "number" && (
                <span className={cn("ml-1", c.seatRisk === "high" ? "text-danger font-semibold" : "")}>
                  · còn {c.slotsRemaining}/{c.capacity ?? "?"} chỗ
                </span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReasoningPanel({ reasons, citations }: { reasons: { text: string; citationIds: number[] }[]; citations: import("@/lib/citations").Citation[] }) {
  const [open, setOpen] = useState(false);
  if (reasons.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10 transition-colors">
        <span>Lý luận AI ({reasons.length} bước)</span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-2.5 rounded-md border border-primary/20 bg-primary/5 p-3">
          {reasons.map((r, i) => {
            const cit = citations.find((c) => r.citationIds.includes(c.id));
            return (
              <div key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-foreground">
                  {r.text}
                  {cit && (
                    <span className="ml-1 rounded-sm bg-primary px-1.5 py-0.5 text-xs font-bold text-white">
                      {cit.title}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ResultPanel() {
  const store = useBKAgent();
  const hasResult = store.flow !== "idle";
  const planAScore = computePlanConfidence(store.planACourses);
  const planBScore = computePlanConfidence(store.planBCourses);

  useEffect(() => {
    if (store.toast) {
      toast(store.toast.title, { description: store.toast.message });
    }
  }, [store.toast]);

  if (!hasResult) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center px-8">
        <div className="rounded-lg border-2 border-dashed border-border/40 p-8">
          <p className="text-sm font-medium text-muted-foreground">Lịch học sẽ hiển thị ở đây</p>
          <p className="mt-1 text-xs text-muted-foreground">Nhập yêu cầu ở khung chat bên trái để bắt đầu</p>
        </div>
      </div>
    );
  }

  const selectedCourses =
    store.selectedPlan === "B" ? store.planBCourses : store.planACourses;
  const hasClosedClass =
    selectedCourses.some((c) => (c.slotsRemaining ?? ((c.capacity ?? 0) - (c.enrolled ?? 0))) <= 0);
  const canRegister = store.selectedPlan !== null && selectedCourses.length > 0 && !hasClosedClass;

  return (
    <>
      <AdvisorBriefSheet />
      <EditPlanSheet />
      <RegisterDialog />
      <GroupInviteSheet />

      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
          <Tabs value={store.currentView} onValueChange={(v) => store.setCurrentView(v as "calendar" | "list")}>
            <TabsList className="h-7 bg-primary/10 border border-primary/20">
              <TabsTrigger
                value="calendar"
                className="text-xs px-2.5 text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                Lịch học
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="text-xs px-2.5 text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                Danh sách
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-1">
            <Button
              size="sm"
              className={cn(
                "text-xs h-7 transition-colors",
                store.selectedPlan === "A"
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-transparent border border-primary/30 text-primary hover:bg-primary hover:text-white"
              )}
              onClick={() => store.acceptPlan("A")}
            >
              Plan A
            </Button>
            <Button
              size="sm"
              className={cn(
                "text-xs h-7 transition-colors",
                store.selectedPlan === "B"
                  ? "bg-gold text-foreground hover:bg-gold/90"
                  : "bg-transparent border border-primary/30 text-primary hover:bg-gold hover:text-foreground"
              )}
              onClick={() => store.acceptPlan("B")}
            >
              Plan B
            </Button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{ scrollbarWidth: "thin", scrollbarColor: "oklch(0.6 0.16 23 / 0.3) transparent" }}
        >
          {store.planACourses.length === 0 && store.planBCourses.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
              Agent đang tạo kế hoạch...
            </div>
          ) : store.currentView === "calendar" ? (
            <VisualCalendar
              planA={store.planACourses}
              planB={store.planBCourses}
              showPlanB={store.usePlanB || store.flow === "failure" || store.flow === "recovery"}
              selectedPlan={store.selectedPlan}
            />
          ) : (
            <div className="space-y-4">
              {store.planACourses.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-bold text-primary uppercase tracking-wide">
                    Plan A — Tối ưu
                  </h4>
                  <PlanListView courses={store.planACourses} plan="A" />
                </div>
              )}
              {store.planBCourses.length > 0 && (store.usePlanB || store.flow === "failure" || store.flow === "recovery") && (
                <div>
                  <h4 className="mb-2 text-sm font-bold text-primary uppercase tracking-wide">
                    Plan B — Dự phòng
                  </h4>
                  <PlanListView courses={store.planBCourses} plan="B" />
                </div>
              )}
            </div>
          )}

          <ConfidenceBar planAScore={planAScore} planBScore={planBScore} />
          <ReasoningPanel reasons={store.reasons} citations={store.citations} />
          <RedFlagBanner flags={store.redFlags} onAcknowledge={store.acknowledgeFlags} />
          {store.citations.length > 0 && <CitationList citations={store.citations} />}
          <Separator className="opacity-30" />

          <div className="flex flex-wrap gap-2 pb-4">
            {hasClosedClass && (
              <p className="w-full text-xs font-medium text-danger">
                Có lớp đã hết chỗ trong plan đang chọn, vui lòng đổi plan hoặc chỉnh sửa trước khi đăng ký.
              </p>
            )}
            {canRegister && (
              <Button
                size="sm"
                className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => store.openRegisterDialog()}
              >
                <CheckCircle2 className="size-3" />
                Đăng ký ngay
              </Button>
            )}
            {store.planACourses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => store.openGroupInvite()}
              >
                <Users className="size-3" />
                Mời bạn đăng ký cùng
              </Button>
            )}
            {store.selectedPlan && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => store.openEditPlan()}
              >
                <Pencil className="size-3" />
                Chỉnh sửa kế hoạch
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-danger gap-1.5"
              onClick={store.escalate}
            >
              <UserRound className="size-3" />
              Chuyển cố vấn học vụ
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
