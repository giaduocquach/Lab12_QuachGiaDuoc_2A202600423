"use client";

import Link from "next/link";
import { MessageSquare, Calendar, CheckCircle, ArrowRight } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    step: 1,
    title: "Mô tả yêu cầu",
    description: "Nhập bằng ngôn ngữ tự nhiên, BKAgent sẽ hiểu ý bạn.",
    icon: MessageSquare,
  },
  {
    step: 2,
    title: "Xem phương án",
    description: "Hiển thị lịch học trên calendar, so sánh Plan A/B.",
    icon: Calendar,
  },
  {
    step: 3,
    title: "Xác nhận & đăng ký",
    description: "Kiểm tra nguồn, xác nhận phương án và tiến hành đăng ký.",
    icon: CheckCircle,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-1px)] flex-col items-center justify-center px-4 py-12">
      <FadeIn>
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white text-xl font-bold mb-5 shadow-lg shadow-primary/30">
            BK
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-tight text-primary">
            Cố vấn học vụ thông minh
          </h1>
          <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
            Tối ưu đăng ký học phần bằng ngôn ngữ tự nhiên.
            Mọi đề xuất đều có trích dẫn nguồn và có thể kiểm chứng.
          </p>
        </div>
      </FadeIn>

      <Stagger className="mt-8 grid w-full max-w-xl gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <StaggerItem key={s.step}>
            <Card className="border-primary/20 bg-white shadow-md hover:shadow-lg hover:border-primary/50 transition-all">
              <CardContent className="flex flex-col items-center p-5 text-center">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/30">
                  <s.icon className="size-5 text-white" />
                </div>
                <span className="mt-3 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {s.step}
                </span>
                <h3 className="mt-2 text-sm font-bold leading-normal text-primary">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <FadeIn delay={0.2}>
        <Link
          href="/tao-ke-hoach"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/85 hover:shadow-xl hover:scale-105"
        >
          Bắt đầu tạo lịch học
          <ArrowRight className="size-5" />
        </Link>
      </FadeIn>

      <FadeIn delay={0.3}>
        <details className="mt-6 w-full max-w-xl rounded-lg border border-border/60 bg-white/70 p-3 text-left shadow-sm">
          <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground">
            Liên kết kiểm tra backend (dành cho giảng viên)
          </summary>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href="/health"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5"
            >
              /health
            </a>
            <a
              href="/ready"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5"
            >
              /ready
            </a>
            <a
              href="/api-info"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5"
            >
              /api-info
            </a>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Lưu ý: <span className="font-semibold">/ask</span> là endpoint POST-only, nên mở trực tiếp bằng trình duyệt sẽ trả 405 (Method Not Allowed).
          </p>
        </details>
      </FadeIn>
    </div>
  );
}
