"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { loginAccount } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    await new Promise((r) => setTimeout(r, 400));
    const result = loginAccount(studentId, password);
    setStatus(result);
    setLoading(false);
    if (result.ok) {
      setTimeout(() => router.push("/nguoi-dung"), 600);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center bg-primary px-12 gap-8">
        <div className="flex flex-col items-center gap-5 text-white text-center">
          <div className="relative size-20 flex items-center justify-center rounded-2xl bg-white/15 shadow-xl backdrop-blur-sm">
            <Image src="/hust-logo.svg" alt="HUST" width={38} height={56} className="drop-shadow" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">BKAgent</h1>
            <p className="mt-2 text-base text-white/75 leading-relaxed max-w-xs">
              Cố vấn đăng ký tín chỉ thông minh dành cho sinh viên Bách Khoa Hà Nội
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 w-full max-w-xs mt-4">
            {[
              "Lên Plan A + Plan B tự động",
              "Cảnh báo rủi ro hết chỗ thời gian thực",
              "Đăng ký đồng bộ từ giao diện",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 rounded-lg bg-white/10 px-3.5 py-2.5">
                <span className="size-1.5 rounded-full bg-white/70 shrink-0" />
                <span className="text-sm text-white/85">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/40 mt-auto">Đại học Bách khoa Hà Nội · HUST</p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <Image src="/hust-logo.svg" alt="HUST" width={20} height={30} />
            <span className="text-xl font-bold text-primary">BKAgent</span>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">Đăng nhập</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Đăng nhập bằng MSSV và mật khẩu.
          </p>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="student-id" className="text-sm font-medium text-foreground">
                MSSV
              </label>
              <Input
                id="student-id"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="VD: 20210001"
                required
                className="h-11 text-sm"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập password"
                required
                className="h-11 text-sm"
                autoComplete="current-password"
              />
              <p className="text-[11px] text-muted-foreground">Demo mặc định: password = 1</p>
            </div>

            {status && !status.ok && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {status.message}
              </div>
            )}

            {status?.ok && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
                {status.message} — Đang chuyển hướng...
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-md shadow-primary/20 mt-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {loading ? "Đang xác thực..." : "Đăng nhập"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <Link href="/dang-ky" className="font-medium text-primary hover:underline">
              Xác thực mã sinh viên
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground/60">
            Tài khoản được đồng bộ từ hệ thống HUST. Thông tin chỉ lưu trên thiết bị của bạn.
          </p>
        </div>
      </div>
    </div>
  );
}
