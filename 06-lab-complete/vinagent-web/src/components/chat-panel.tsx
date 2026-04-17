"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, CheckCircle2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBKAgent, type ChatMessage } from "@/lib/store";
import { TypingText } from "./typing-text";
import { CitationRef } from "./citation-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const SUGGESTIONS = [
  "Lên lịch HK 20252, tránh sáng, phải có Giải tích II và Vật lý II",
  "Đăng ký 5 môn, ưu tiên lớp còn nhiều chỗ",
  "Xếp lịch KTCT Mác-Lênin + GDTC 2 + CTDL&GT, tránh xung đột",
];

function MessageBubble({ message, isLatest }: { message: ChatMessage; isLatest: boolean }) {
  const { citations } = useBKAgent();
  const isUser = message.role === "user";
  const [typingDone, setTypingDone] = useState(false);

  function highlightImportant(text: string) {
    const dangerTerms = /(\bPlan B\b|rủi ro|thất bại|cảnh báo|Rủi ro|Thất bại|Cảnh báo)/g;
    const successTerms = /(\bPlan A\b|thành công|Thành công|đã tạo|Đã tạo|Đã xác nhận|đã xác nhận)/g;
    const infoTerms = /(Độ tin cậy|độ tin cậy)/g;

    return text
      .split(
        /(\bPlan [AB]\b|rủi ro|thất bại|cảnh báo|Rủi ro|Thất bại|Cảnh báo|thành công|Thành công|đã tạo|Đã tạo|Đã xác nhận|đã xác nhận|Độ tin cậy|độ tin cậy)/g
      )
      .map((part, i) => {
        if (dangerTerms.test(part))
          return (
            <span key={i} className="font-bold text-danger">
              {part}
            </span>
          );
        if (successTerms.test(part))
          return (
            <span key={i} className="font-bold text-primary">
              {part}
            </span>
          );
        if (infoTerms.test(part))
          return (
            <span key={i} className="font-semibold text-primary">
              {part}
            </span>
          );
        return <span key={i}>{part}</span>;
      });
  }

  function renderTextWithCitations(text: string) {
    const parts = text.split(/\[(\d+(?:,\d+)*)\]/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const ids = part.split(",").map(Number);
        return ids.map((id) => {
          const cit = citations.find((c) => c.id === id);
          return <CitationRef key={`${message.id}-cit-${id}`} id={id} citation={cit} />;
        });
      }
      return <span key={`${message.id}-text-${i}`}>{highlightImportant(part)}</span>;
    });
  }

  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-primary text-white text-[11px] font-bold">BK</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line",
          isUser
            ? "bg-primary text-white border-0 rounded-tr-sm font-medium"
            : "border border-border bg-white shadow-sm rounded-tl-sm"
        )}
      >
        {!isUser && isLatest && !typingDone ? (
          <TypingText text={message.text} speed={12} onComplete={() => setTypingDone(true)} />
        ) : (
          renderTextWithCitations(message.text)
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { messages, prompt, setPrompt, generate, isTyping, flow, clarify, streamingSteps, suggestions, lastGeneratedMsgId } =
    useBKAgent();
  const stopGenerating = useBKAgent((state) => state.stopGenerating);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, isTyping, streamingSteps.length]);

  useEffect(() => () => {
    stopGenerating();
  }, [stopGenerating]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Native scroll div — reliable sticky input at bottom */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ scrollbarWidth: "thin", scrollbarColor: "oklch(0.6 0.16 23 / 0.35) transparent" }}
      >
        <div className="px-4 py-4 space-y-3">
          {isEmpty && (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
              <Avatar className="size-12 mb-4">
                <AvatarFallback className="bg-primary text-white text-base font-bold">
                  BK
                </AvatarFallback>
              </Avatar>
              <h3 className="text-base font-bold text-primary leading-normal">
                Xin chào! Mình là BKAgent
              </h3>
              <p className="mt-1.5 max-w-xs text-sm text-muted-foreground leading-relaxed">
                Mô tả yêu cầu đăng ký học phần bằng ngôn ngữ tự nhiên, mình sẽ tạo kế hoạch tối
                ưu cho bạn.
              </p>
              <div className="mt-5 flex flex-col gap-2 w-full max-w-xs">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    className="h-auto justify-start whitespace-normal text-left text-sm px-3.5 py-2.5 leading-relaxed border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
                    onClick={() => {
                      setPrompt(s);
                      generate(s);
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLatest={
                idx === messages.length - 1 &&
                msg.role === "assistant" &&
                msg.id === lastGeneratedMsgId
              }
            />
          ))}

          {isTyping && (
            <div className="flex gap-2.5">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-primary text-white text-[11px] font-bold">
                  BK
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 max-w-[85%]">
                {streamingSteps.length > 0 ? (
                  <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    {streamingSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-2 text-sm">
                        {step.type === "tool_start" ? (
                          <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                        ) : (
                          <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />
                        )}
                        <span
                          className={cn(
                            "text-sm",
                            step.type === "tool_end"
                              ? "text-muted-foreground"
                              : "text-primary font-medium"
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="flex gap-1">
                        <span
                          className="size-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="size-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="size-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </span>
                      <span className="text-xs text-muted-foreground">Đang xử lý...</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg rounded-tl-sm border border-border bg-white shadow-sm px-3 py-2.5">
                    <span className="flex gap-1">
                      <span
                        className="size-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="size-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="size-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI-generated follow-up suggestions */}
          {suggestions.length > 0 && !isTyping && (
            <div className="pl-10 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Gợi ý tiếp theo:</p>
              <div className="flex flex-col gap-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="group relative text-left text-sm rounded-lg border border-primary/25 bg-primary/5 hover:bg-primary/12 active:scale-[0.98] transition-all px-3.5 py-2.5 text-primary leading-snug overflow-hidden"
                    onClick={() => {
                      setPrompt(s);
                      generate(s);
                    }}
                  >
                    <span className="absolute inset-0 rounded-lg ring-1 ring-primary/10 group-hover:ring-primary/30 transition-all" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(flow === "lowConfidence" || flow === "idle") &&
            messages.length > 0 &&
            !isTyping &&
            suggestions.length === 0 && (
              <div className="flex gap-2 pl-10">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
                  onClick={() => clarify("avoidMorning")}
                >
                  Tránh lịch sáng
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
                  onClick={() => clarify("keepGroup")}
                >
                  Giữ lớp cùng nhóm
                </Button>
              </div>
            )}
        </div>
      </div>

      <form
        className="flex-shrink-0 border-t border-border/50 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (prompt.trim()) generate(prompt.trim());
        }}
      >
        <div className="flex gap-2">
          <Input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Nhập yêu cầu đăng ký học phần..."
            disabled={isTyping}
            className="flex-1 bg-white text-sm h-10 border-border focus-visible:ring-primary/50"
          />
          {isTyping ? (
            <Button
              type="button"
              size="default"
              className="h-10 px-4 border border-primary bg-primary text-white hover:bg-primary/90 hover:border-primary shadow-sm shadow-primary/20"
              onClick={stopGenerating}
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="default"
              className="h-10 px-4 bg-primary hover:bg-primary/85 text-white"
              disabled={!prompt.trim()}
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
