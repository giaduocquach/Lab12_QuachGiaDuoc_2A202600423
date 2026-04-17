"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck, LogOut, User, BookOpen, Star, Calendar, GraduationCap, ChevronRight } from "lucide-react";
import { getCurrentStudent, logoutAccount, verifyCurrentStudent } from "@/lib/auth";
import { getPendingInvitesFor, markInviteStatus, setInviteAction, type GroupInvite } from "@/lib/group-registration";
import { useBKAgent } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

const EMPTY_INVITES: GroupInvite[] = [];
const inviteSnapshotCache = new Map<string, { hash: string; value: GroupInvite[] }>();

function getPendingInvitesSnapshot(studentId?: string | null): GroupInvite[] {
  if (!studentId) return EMPTY_INVITES;
  const next = getPendingInvitesFor(studentId);
  const hash = JSON.stringify(next);
  const cached = inviteSnapshotCache.get(studentId);
  if (cached && cached.hash === hash) return cached.value;
  inviteSnapshotCache.set(studentId, { hash, value: next });
  return next;
}

export default function UserProfilePage() {
  const router = useRouter();
  const [verification, setVerification] = useState<{ ok: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const aiProvider = useBKAgent((state) => state.aiProvider);
  const apiKey = useBKAgent((state) => state.apiKey);
  const setAIProvider = useBKAgent((state) => state.setAIProvider);
  const setApiKey = useBKAgent((state) => state.setApiKey);
  const stopGenerating = useBKAgent((state) => state.stopGenerating);
  const providerLabel = aiProvider === "chatgpt" ? "ChatGPT" : "Gemini";

  const student = useSyncExternalStore(
    () => () => {},
    () => getCurrentStudent(),
    () => null
  );

  function onVerify() {
    setVerification(verifyCurrentStudent());
  }

  function onLogout() {
    stopGenerating();
    logoutAccount();
    router.push("/dang-nhap");
  }

  const pendingInvites = useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const onStorage = () => onChange();
      const onInviteChanged = () => onChange();
      window.addEventListener("storage", onStorage);
      window.addEventListener("bkagent:invites-changed", onInviteChanged);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("bkagent:invites-changed", onInviteChanged);
      };
    },
    () => getPendingInvitesSnapshot(student?.id),
    () => EMPTY_INVITES
  );
  if (!student) {
    return (
      <div className="flex h-full overflow-y-auto items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex justify-center">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="size-8 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Chưa đăng nhập</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Vui lòng đăng nhập để truy cập hồ sơ sinh viên của bạn.
          </p>
          <Link href="/dang-nhap">
            <Button className="w-full h-11 bg-primary text-white font-semibold">
              Đăng nhập ngay
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const infoRows = [
    { icon: User, label: "Mã sinh viên", value: student.id },
    { icon: GraduationCap, label: "Ngành học", value: student.major },
    { icon: BookOpen, label: "Chương trình", value: student.program ?? "Chuẩn" },
    { icon: Calendar, label: "Năm học", value: `Năm ${student.year}` },
    { icon: Star, label: "GPA", value: String(student.gpa) },
    { icon: Calendar, label: "Học kỳ hiện tại", value: student.currentSemester },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="bg-primary px-6 pt-12 pb-20">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/hust-logo.svg" alt="HUST" width={16} height={24} />
            <span className="text-white font-bold text-base">BKAgent</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/15 gap-1.5 text-xs"
            onClick={onLogout}
          >
            <LogOut className="size-3.5" />
            Đăng xuất
          </Button>
        </div>
        <div className="max-w-lg mx-auto mt-8 flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg">
            <span className="text-white text-xl font-bold">
              {student.name.split(" ").map((w) => w[0]).slice(-2).join("")}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{student.name}</h1>
            <p className="text-sm text-white/70">{student.major} · HUST</p>
          </div>
        </div>
      </div>

      {/* Card pulled up over header */}
      <div className="max-w-lg mx-auto px-4 -mt-8">
        {pendingInvites.length > 0 && (
          <div className="mb-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-primary mb-2">
              Bạn có {pendingInvites.length} lời mời đăng ký cùng nhóm
            </p>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="rounded-lg border border-primary/20 bg-background p-3">
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">{invite.fromStudentName}</span> mời bạn theo Plan {invite.planType}.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {invite.courses.length} môn học sẽ được nạp tự động sau khi bạn xác nhận.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        markInviteStatus(invite.id, "accepted");
                        setInviteAction(invite);
                        router.push("/tao-ke-hoach");
                      }}
                    >
                      Xác nhận & tự động đăng ký
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        markInviteStatus(invite.id, "rejected");
                      }}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">Thông tin sinh viên</h3>
          </div>
          <div className="divide-y divide-border/40">
            {infoRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-3.5">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="size-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium text-foreground truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advisor */}
        <div className="mt-3 rounded-2xl border border-border bg-card shadow-sm px-5 py-4">
          <p className="text-xs text-muted-foreground mb-1">Cố vấn học vụ</p>
          <p className="text-sm font-medium text-foreground">{student.advisorName}</p>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-card shadow-sm px-5 py-4">
          <p className="text-xs text-muted-foreground mb-3">Cấu hình AI</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nhà cung cấp API</Label>
              <Select value={aiProvider} onValueChange={(value) => setAIProvider(value as "gemini" | "chatgpt")}>
                <SelectTrigger className="w-full h-9 text-xs">
                  {providerLabel}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chatgpt" className="text-xs">ChatGPT</SelectItem>
                  <SelectItem value="gemini" className="text-xs">Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">API key</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={aiProvider === "chatgpt" ? "sk-..." : "AIza..."}
                  className="h-9 text-xs"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => setShowApiKey((value) => !value)}
                  aria-label={showApiKey ? "Ẩn API key" : "Hiện API key"}
                >
                  {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 space-y-2">
          <Button
            className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold gap-2"
            onClick={onVerify}
          >
            <ShieldCheck className="size-4" />
            Kiểm tra tính hợp lệ dữ liệu
          </Button>

          {verification && (
            <div className={`rounded-xl px-4 py-3 text-sm ${verification.ok ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900" : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900"}`}>
              {verification.message}
            </div>
          )}

          <Link href="/tao-ke-hoach" className="block">
            <Button
              variant="ghost"
              className="w-full h-11 justify-between text-primary border border-primary/20 hover:bg-primary/5 font-medium"
            >
              Bắt đầu lên kế hoạch đăng ký
              <ChevronRight className="size-4" />
            </Button>
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6 mb-4">
          Dữ liệu được xác thực từ hệ thống HUST và lưu trên thiết bị của bạn
        </p>
      </div>
    </div>
  );
}
