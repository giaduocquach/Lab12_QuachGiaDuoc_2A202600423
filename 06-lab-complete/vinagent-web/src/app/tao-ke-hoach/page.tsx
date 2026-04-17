"use client";

import { useEffect } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ChatPanel } from "@/components/chat-panel";
import { ResultPanel } from "@/components/result-panel";
import { consumeInviteAction } from "@/lib/group-registration";
import { useBKAgent } from "@/lib/store";

export default function CreatePlanPage() {
  const store = useBKAgent();

  useEffect(() => {
    const invite = consumeInviteAction();
    if (!invite) return;
    const acceptedPlan = invite.planType;
    const planA = acceptedPlan === "A" ? invite.courses : store.planACourses;
    const planB = acceptedPlan === "B" ? invite.courses : store.planBCourses;
    useBKAgent.setState((s) => ({
      ...s,
      planACourses: planA,
      planBCourses: planB,
      selectedPlan: acceptedPlan,
      flow: "happy",
      registerDialogOpen: true,
      registerStatus: "loading",
      messages: [
        ...s.messages,
        {
          id: `invite-auto-${Date.now()}`,
          role: "assistant",
          text: `Đã nhận lời mời từ ${invite.fromStudentName}. Hệ thống đang tự động đăng ký theo Plan ${acceptedPlan}.`,
          timestamp: new Date(),
        },
      ],
    }));
    setTimeout(() => useBKAgent.getState().setRegisterStatus("success"), 2000);
  }, []);

  return (
    <Group
      orientation="horizontal"
      className="flex flex-1 h-full overflow-hidden"
    >
      <Panel defaultSize="38%" minSize="28%" maxSize="55%" className="h-full overflow-hidden">
        <ChatPanel />
      </Panel>
      <Separator className="w-1.5 bg-border hover:bg-primary/60 active:bg-primary/80 transition-colors cursor-col-resize flex-shrink-0" />
      <Panel minSize="35%" className="h-full overflow-hidden">
        <ResultPanel />
      </Panel>
    </Group>
  );
}
