"use client";

import type { CourseSlot } from "./store";

const INVITE_KEY = "bkagent.groupInvites";
const INVITE_ACTION_KEY = "bkagent.inviteAction";
const INVITE_CHANGED_EVENT = "bkagent:invites-changed";

export type GroupInvite = {
  id: string;
  fromStudentId: string;
  fromStudentName: string;
  toStudentId: string;
  toStudentName: string;
  createdAt: string;
  status: "pending" | "accepted" | "rejected";
  planType: "A" | "B";
  courses: CourseSlot[];
  note: string;
};

function readInvites(): GroupInvite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVITE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GroupInvite[];
  } catch {
    return [];
  }
}

function writeInvites(invites: GroupInvite[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVITE_KEY, JSON.stringify(invites));
  window.dispatchEvent(new Event(INVITE_CHANGED_EVENT));
}

export function createGroupInvites(params: {
  fromStudentId: string;
  fromStudentName: string;
  recipients: { id: string; name: string }[];
  planType: "A" | "B";
  courses: CourseSlot[];
}) {
  const current = readInvites();
  const now = new Date().toISOString();
  const newInvites: GroupInvite[] = params.recipients.map((r, idx) => ({
    id: `invite-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    fromStudentId: params.fromStudentId,
    fromStudentName: params.fromStudentName,
    toStudentId: r.id,
    toStudentName: r.name,
    createdAt: now,
    status: "pending",
    planType: params.planType,
    courses: params.courses,
    note: `${params.fromStudentName} mời bạn đăng ký theo Plan ${params.planType}.`,
  }));
  writeInvites([...newInvites, ...current]);
  return newInvites;
}

export function getPendingInvitesFor(studentId: string) {
  return readInvites().filter((i) => i.toStudentId === studentId && i.status === "pending");
}

export function markInviteStatus(inviteId: string, status: "accepted" | "rejected") {
  const current = readInvites();
  const next = current.map((i) => (i.id === inviteId ? { ...i, status } : i));
  writeInvites(next);
}

export function setInviteAction(invite: GroupInvite) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVITE_ACTION_KEY, JSON.stringify(invite));
}

export function consumeInviteAction(): GroupInvite | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(INVITE_ACTION_KEY);
  if (!raw) return null;
  localStorage.removeItem(INVITE_ACTION_KEY);
  try {
    return JSON.parse(raw) as GroupInvite;
  } catch {
    return null;
  }
}

