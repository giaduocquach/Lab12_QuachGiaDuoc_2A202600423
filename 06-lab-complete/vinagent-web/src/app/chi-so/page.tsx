"use client";

import { cn } from "@/lib/utils";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useBKAgent } from "@/lib/store";

const FLOW_LABELS: Record<string, { label: string; status: "good" | "warning" | "danger" }> = {
  idle: { label: "Chờ yêu cầu", status: "warning" },
  happy: { label: "Thành công", status: "good" },
  lowConfidence: { label: "Độ tin cậy thấp", status: "warning" },
  failure: { label: "Phát hiện lỗi", status: "danger" },
  recovery: { label: "Đang phục hồi", status: "warning" },
  escalated: { label: "Đã chuyển cố vấn", status: "good" },
};

const statusClasses = {
  good: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  danger: "border-danger/30 text-danger",
};

const statusLabels = { good: "Đạt", warning: "Theo dõi", danger: "Cờ đỏ" };

export default function MetricsPage() {
  const store = useBKAgent();

  const confidenceStatus =
    store.confidenceScore >= 80 ? "good" : store.confidenceScore >= 60 ? "warning" : "danger";
  const planLabel = store.selectedPlan
    ? `Plan ${store.selectedPlan} — ${store.flow === "recovery" ? "Đang phục hồi" : "Đang dùng"}`
    : "Chưa chọn";
  const planStatus = store.selectedPlan ? "good" : "warning";
  const flagStatus = store.redFlags.length === 0 ? "good" : store.redFlags.length <= 2 ? "warning" : "danger";
  const agentState = FLOW_LABELS[store.flow] ?? { label: store.flow, status: "warning" };

  const STATIC_METRICS = [
    { label: "Schedule Precision Rate", value: "87%", target: "> 85%", status: "good" as const, isSimulated: true },
    { label: "Thời gian đăng ký TB", value: "< 10 phút", target: "< 10 phút", status: "good" as const, isSimulated: true },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <FadeIn>
        <header className="mb-6">
          <h1 className="text-lg font-medium tracking-tight leading-tight">
            Bảng chỉ số vận hành
          </h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            4 chỉ số live từ phiên hiện tại · 2 chỉ số mô phỏng.
          </p>
        </header>
      </FadeIn>

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Live: Confidence */}
        <StaggerItem>
          <Card className="border-border/50 bg-card hover:border-border transition-colors">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground leading-normal">
                Độ tin cậy phiên hiện tại
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">
                {store.confidenceScore}
                <span className="text-sm text-muted-foreground font-normal">/100</span>
              </p>
              <Progress
                value={store.confidenceScore}
                className={cn(
                  "mt-2 h-1",
                  confidenceStatus === "good" && "[&>div]:bg-success",
                  confidenceStatus === "warning" && "[&>div]:bg-warning",
                  confidenceStatus === "danger" && "[&>div]:bg-danger",
                )}
              />
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="outline" className={cn("text-[10px] leading-normal", statusClasses[confidenceStatus])}>
                  {statusLabels[confidenceStatus]}
                </Badge>
                <span className="text-[10px] text-muted-foreground">Live</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Live: Selected Plan */}
        <StaggerItem>
          <Card className="border-border/50 bg-card hover:border-border transition-colors">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground leading-normal">
                Kế hoạch hiện tại
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">
                {store.selectedPlan ? `Plan ${store.selectedPlan}` : "—"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                {planLabel}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="outline" className={cn("text-[10px] leading-normal", statusClasses[planStatus])}>
                  {statusLabels[planStatus]}
                </Badge>
                <span className="text-[10px] text-muted-foreground">Live</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Live: Red Flags */}
        <StaggerItem>
          <Card className="border-border/50 bg-card hover:border-border transition-colors">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground leading-normal">
                Cảnh báo đang mở
              </p>
              <p className={cn(
                "mt-2 font-mono text-2xl font-semibold tracking-tight",
                store.redFlags.length > 0 && "text-danger",
              )}>
                {store.redFlags.length}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                Mục tiêu: 0
              </p>
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="outline" className={cn("text-[10px] leading-normal", statusClasses[flagStatus])}>
                  {statusLabels[flagStatus]}
                </Badge>
                <span className="text-[10px] text-muted-foreground">Live</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Live: Agent Flow State */}
        <StaggerItem>
          <Card className="border-border/50 bg-card hover:border-border transition-colors">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground leading-normal">
                Trạng thái agent
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">
                {store.flow === "idle" ? "—" : store.flow === "happy" ? "OK" : store.flow === "failure" ? "ERR" : "..."}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                {agentState.label}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="outline" className={cn("text-[10px] leading-normal", statusClasses[agentState.status])}>
                  {statusLabels[agentState.status]}
                </Badge>
                <span className="text-[10px] text-muted-foreground">Live</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Static simulated */}
        {STATIC_METRICS.map((m) => (
          <StaggerItem key={m.label}>
            <Card className="border-border/50 bg-card hover:border-border transition-colors">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground leading-normal">
                  {m.label}
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">
                  {m.value}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                  Mục tiêu: {m.target}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline" className={cn("text-[10px] leading-normal", statusClasses[m.status])}>
                    {statusLabels[m.status]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] leading-normal text-muted-foreground border-border/30">
                    Mô phỏng
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
