"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarPlus, BarChart3, Plus, MessageSquare, Trash2, History, UserCircle, LogOut, Bell } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getCurrentStudent, logoutAccount } from "@/lib/auth";
import type { StudentProfile } from "@/lib/student-data";
import { getPendingInvitesFor } from "@/lib/group-registration";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useBKAgent } from "@/lib/store";

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/tao-ke-hoach", label: "Tạo kế hoạch", icon: CalendarPlus },
  { href: "/chi-so", label: "Bảng chỉ số", icon: BarChart3 },
  { href: "/nguoi-dung", label: "Hồ sơ", icon: UserCircle },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(true);
  const currentUser = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const rerender = () => onStoreChange();
      const onStorage = (e: StorageEvent) => {
        if (!e.key || e.key === "bkagent.groupInvites" || e.key === "bkagent.currentUser") {
          rerender();
        }
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener("bkagent:invites-changed", rerender);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("bkagent:invites-changed", rerender);
      };
    },
    () => getCurrentStudent(),
    () => null
  ) as StudentProfile | null;
  const pendingInviteCount = currentUser ? getPendingInvitesFor(currentUser.id).length : 0;
  const { sessions, currentSessionId, newSession, loadSession, deleteSession, stopGenerating } = useBKAgent();
  const ownerId = currentUser?.id ?? "anonymous";
  const userSessions = sessions.filter((s) => (s.ownerId ?? "anonymous") === ownerId);

  useEffect(() => {
    stopGenerating();
  }, [pathname, stopGenerating]);

  useEffect(() => {
    // Keep runtime context isolated per logged-in user
    useBKAgent.setState((s) => {
      const activeOwner = getCurrentStudent()?.id ?? "anonymous";
      const owned = s.sessions.filter((ss) => (ss.ownerId ?? "anonymous") === activeOwner);
      const currentOwned = owned.find((ss) => ss.id === s.currentSessionId);
      if (currentOwned) return {};
      if (owned.length > 0) {
        const first = owned[0];
        return {
          currentSessionId: first.id,
          messages: first.messages,
          planACourses: first.planACourses,
          planBCourses: first.planBCourses,
          citations: first.citations,
          flow: "happy" as const,
          isTyping: false,
          streamingSteps: [],
        };
      }
      return {
        currentSessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        messages: [],
        planACourses: [],
        planBCourses: [],
        citations: [],
        flow: "idle" as const,
        isTyping: false,
        streamingSteps: [],
      };
    });
  }, [pathname]); // re-check on navigation (login/logout)

  function handleNewChat() {
    stopGenerating();
    newSession();
    router.push("/tao-ke-hoach");
  }

  function handleLoadSession(id: string) {
    stopGenerating();
    loadSession(id);
    router.push("/tao-ke-hoach");
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between gap-1">
          <Link href="/" className="flex items-center gap-2.5 px-1 min-w-0">
            <Image src="/hust-logo.svg" alt="HUST" width={19} height={28} className="shrink-0" />
            <span className="text-base font-bold tracking-tight text-white group-data-[collapsible=icon]:hidden truncate">
              BKAgent
            </span>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            title="Tạo chat mới"
            className="size-7 shrink-0 text-white/80 hover:text-white hover:bg-white/15 group-data-[collapsible=icon]:hidden"
            onClick={handleNewChat}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                      {item.href === "/nguoi-dung" && pendingInviteCount > 0 && (
                        <span className="ml-auto inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-white text-primary text-[10px] font-bold px-1">
                          {pendingInviteCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Chat history section */}
        {userSessions.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-white/70 hover:text-white transition-colors">
                <History className="size-3.5" />
                <span>Lịch sử</span>
                <span className="ml-auto text-white/50">{userSessions.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 space-y-0.5 px-1">
                  {userSessions.slice(0, 8).map((session) => (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                        session.id === currentSessionId
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                      onClick={() => handleLoadSession(session.id)}
                    >
                      <MessageSquare className="size-3 shrink-0" />
                      <span className="flex-1 truncate text-xs leading-tight">{session.title}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          stopGenerating();
                          deleteSession(session.id);
                        }}
                        title="Xóa phiên"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <div className="border-t border-white/20 p-3">
        {currentUser ? (
          <div className="group-data-[collapsible=icon]:hidden">
            <Link href="/nguoi-dung" className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/10 transition-colors">
              <div className="size-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">
                  {currentUser.name.split(" ").map((w) => w[0]).slice(-2).join("")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-white/60 leading-tight truncate">{currentUser.id} · {currentUser.major}</p>
              </div>
            </Link>
            {pendingInviteCount > 0 && (
              <Link href="/nguoi-dung" className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-white/80 hover:bg-white/10">
                <Bell className="size-3" />
                <span>Bạn có {pendingInviteCount} lời mời mới</span>
              </Link>
            )}
            <button
              className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => { stopGenerating(); logoutAccount(); router.push("/dang-nhap"); }}
            >
              <LogOut className="size-3" />
              <span>Đăng xuất</span>
            </button>
          </div>
        ) : (
          <Link
            href="/dang-nhap"
            className="group-data-[collapsible=icon]:hidden flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <UserCircle className="size-4 shrink-0" />
            <span>Đăng nhập</span>
          </Link>
        )}
        {/* Collapsed icon mode: show avatar or login icon */}
        <div className="group-data-[collapsible=icon]:flex hidden items-center justify-center py-1">
          {currentUser ? (
            <Link href="/nguoi-dung" title={currentUser.name}>
              <div className="size-7 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">
                  {currentUser.name.split(" ").map((w) => w[0]).slice(-2).join("")}
                </span>
              </div>
            </Link>
          ) : (
            <Link href="/dang-nhap" title="Đăng nhập">
              <UserCircle className="size-5 text-white/60 hover:text-white transition-colors" />
            </Link>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
