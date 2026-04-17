"use client";

import { useEffect } from "react";
import { CheckCircle2, Loader2, AlertCircle, Send } from "lucide-react";
import { useBKAgent, type CourseSlot } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const DAY_VI: Record<string, string> = {
  Mon: "Thứ 2",
  Tue: "Thứ 3",
  Wed: "Thứ 4",
  Thu: "Thứ 5",
  Fri: "Thứ 6",
  Sat: "Thứ 7",
};

export function RegisterDialog() {
  const store = useBKAgent();
  const courses =
    store.selectedPlan === "B" ? store.planBCourses : store.planACourses;
  const status = store.registerStatus;
  const closedCourses = courses.filter(
    (c) => (c.slotsRemaining ?? ((c.capacity ?? 0) - (c.enrolled ?? 0))) <= 0
  );

  useEffect(() => {
    if (!store.registerDialogOpen || status !== "loading") return;

    const t1 = setTimeout(() => {}, 1000);
    const t2 = setTimeout(() => {
      store.setRegisterStatus("success");
    }, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [store.registerDialogOpen, status]);

  function handleStart() {
    if (closedCourses.length > 0) {
      store.setToast({
        title: "Không thể đăng ký",
        message: `Có ${closedCourses.length} lớp đã hết chỗ trong plan hiện tại.`,
      });
      return;
    }
    store.setRegisterStatus("loading");
  }

  function handleClose() {
    store.closeRegisterDialog();
  }

  const progressValue =
    status === "idle" ? 0 : status === "loading" ? 65 : 100;

  return (
    <Dialog
      open={store.registerDialogOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Send className="size-4 text-primary" />
            Đăng ký tín chỉ — dk-sis
          </DialogTitle>
          <DialogDescription className="text-xs">
            BKAgent sẽ chuẩn bị và gửi lệnh đăng ký thay mặt bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Course list */}
          <div className="space-y-1.5">
            {courses.map((c: CourseSlot, i: number) => (
              <div
                key={`${c.code}-${i}`}
                className={cn(
                  "flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 text-xs",
                  status === "success" && "border-success/30 bg-success/5"
                )}
              >
                {status === "success" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                ) : status === "loading" ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border border-border/50" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-normal">{c.code} — {c.name}</p>
                  <p className="text-muted-foreground leading-normal">
                    {DAY_VI[c.day] ?? c.day} {c.startHour}:00 · {c.room ?? "?"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Progress */}
          {status !== "idle" && (
            <div className="space-y-1.5">
              <Progress
                value={progressValue}
                className={cn(
                  "h-1.5 transition-all duration-700",
                  status === "success" && "[&>div]:bg-success"
                )}
              />
              <p className="text-[11px] text-muted-foreground text-center">
                {status === "loading"
                  ? "Đang kết nối dk-sis và gửi yêu cầu..."
                  : `Đã đăng ký thành công ${courses.length}/${courses.length} môn học!`}
              </p>
            </div>
          )}

          {/* Warning */}
          {status === "idle" && (
            <div className="flex items-start gap-2 rounded-md bg-warning/5 border border-warning/20 p-2.5">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-warning" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Đây là môi trường demo với dữ liệu mock. Trong thực tế, hệ thống sẽ kết nối trực tiếp với dk-sis.hust.edu.vn.
              </p>
            </div>
          )}
          {status === "idle" && closedCourses.length > 0 && (
            <div className="rounded-md border border-danger/25 bg-danger/5 p-2.5">
              <p className="text-xs font-medium text-danger">
                Plan hiện tại có lớp đã hết chỗ:
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {closedCourses.map((c) => c.code).join(", ")}. Hãy đổi plan hoặc chỉnh sửa lịch trước khi đăng ký.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {status === "idle" && (
              <Button
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={handleStart}
                disabled={courses.length === 0 || closedCourses.length > 0}
              >
                <Send className="size-3" />
                Xác nhận đăng ký {courses.length} môn
              </Button>
            )}
            {status === "loading" && (
              <Button size="sm" className="flex-1 text-xs" disabled>
                <Loader2 className="size-3 mr-1.5 animate-spin" />
                Đang xử lý...
              </Button>
            )}
            {status === "success" && (
              <Button
                size="sm"
                className="flex-1 gap-1.5 text-xs bg-success text-white hover:bg-success/90"
                onClick={handleClose}
              >
                <CheckCircle2 className="size-3" />
                Hoàn tất — Đóng
              </Button>
            )}
            {status === "idle" && (
              <Button variant="outline" size="sm" className="text-xs" onClick={handleClose}>
                Hủy
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
