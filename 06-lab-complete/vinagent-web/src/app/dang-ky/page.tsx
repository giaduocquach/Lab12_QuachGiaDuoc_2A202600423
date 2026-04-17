"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { loginAccount } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
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
    // Auth is verified against HUST database (student.json) — same flow as login
    const result = loginAccount(studentId, password);
    if (result.ok) {
      setStatus({ ok: true, message: "Xác thực thành công! Tài khoản đã sẵn sàng." });
      setLoading(false);
      setTimeout(() => router.push("/nguoi-dung"), 800);
    } else {
      setStatus({ ok: false, message: result.message });
      setLoading(false);
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
              Xác thực tài khoản bằng mã sinh viên chính thức từ hệ thống HUST
            </p>
          </div>
          <div className="rounded-lg bg-white/10 px-4 py-4 w-full max-w-xs text-left">
            <p className="text-sm font-semibold text-white mb-2">Lưu ý</p>
            <ul className="space-y-1.5 text-sm text-white/80">
              <li className="flex gap-2"><span>•</span><span>Mã sinh viên phải đúng format HUST</span></li>
              <li className="flex gap-2"><span>•</span><span>Họ tên phải khớp với hồ sơ sinh viên</span></li>
              <li className="flex gap-2"><span>•</span><span>Thông tin không gửi lên server</span></li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-auto">Đại học Bách khoa Hà Nội · HUST</p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <Image src="/hust-logo.svg" alt="HUST" width={20} height={30} />
            <span className="text-xl font-bold text-primary">BKAgent</span>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">Xác thực tài khoản</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Tài khoản được tạo tự động từ dữ liệu HUST. Nhập MSSV và mật khẩu để xác thực.
          </p>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="reg-student-id" className="text-sm font-medium text-foreground">
                MSSV
              </label>
              <Input
                id="reg-student-id"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="VD: 20210001"
                required
                className="h-11 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập password"
                required
                className="h-11 text-sm"
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
                {status.message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-md shadow-primary/20 mt-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {loading ? "Đang xác thực..." : "Xác thực & Tạo tài khoản"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link href="/dang-nhap" className="font-medium text-primary hover:underline">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
