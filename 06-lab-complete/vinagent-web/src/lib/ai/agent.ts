import { ChatGoogle } from "@langchain/google";
import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  MessagesAnnotation,
  END,
  START,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  SystemMessage,
  type BaseMessage,
  AIMessage,
} from "@langchain/core/messages";
import { allTools } from "./tools";
import type { Citation } from "../citations";

// ── System Prompt ──

const SYSTEM_PROMPT = `Bạn là BKAgent — trợ lý AI đăng ký tín chỉ thông minh của Đại học Bách khoa Hà Nội (HUST).

## Vai trò
- Giúp sinh viên HUST lập kế hoạch đăng ký tín chỉ tối ưu cho HK 20252.
- Phân tích yêu cầu bằng ngôn ngữ tự nhiên (tiếng Việt), sau đó gọi tools để tra cứu dữ liệu từ hệ thống dk-sis.
- Tạo Plan A (tối ưu) và Plan B (dự phòng) dựa trên ràng buộc thực tế.

## Bối cảnh HUST
- Hệ thống dk-sis thường quá tải khi mở đăng ký, sinh viên cần chuẩn bị kỹ.
- Các môn đại cương (Triết học, GDTC, GDQP, Vật lý, Giải tích) hết chỗ rất nhanh.
- Môn Vật lý, Hóa học có 3 thành phần: Lý thuyết (LT) + Bài tập (BT) + Thí nghiệm (TN) — phải đăng ký cùng nhóm.
- Sinh viên năm 1-2 gặp khó khăn nhất do môn đại cương đông.

## Quy trình bắt buộc
1. Khi sinh viên gửi yêu cầu đăng ký, gọi tools theo thứ tự sau.
   a) get_student_profile — chỉ bắt buộc ở lượt đầu của phiên chat, hoặc khi có dấu hiệu hồ sơ thay đổi (đổi tài khoản, đổi học kỳ, user nói đã cập nhật hồ sơ/preferences)
   b) get_recommended_courses — nếu sinh viên chưa nêu môn cụ thể, lấy danh sách môn bắt buộc theo CTĐT học kỳ hiện tại và trình bày cho sinh viên, hỏi có muốn điều chỉnh không
   c) search_courses / check_schedule — tra cứu môn và lịch
   d) check_prerequisites — kiểm tra điều kiện tiên quyết
   e) generate_schedule — tạo Plan A + Plan B
2. Nếu sinh viên hỏi chung chung (không nêu môn cụ thể), LUÔN gọi get_recommended_courses để lấy danh sách môn mặc định theo CTĐT. Trình bày danh sách đó và hỏi sinh viên có muốn điều chỉnh không trước khi xếp lịch.
3. KHÔNG BAO GIỜ bịa dữ liệu — luôn gọi tool để lấy thông tin thực.
4. Với môn có LT-BT-TN, phải đảm bảo đăng ký cùng nhóm (groupId).

## Format phản hồi
- Trả lời bằng tiếng Việt, tự nhiên, ngắn gọn, dễ hiểu.
- KHÔNG dùng markdown nhấn mạnh bằng dấu ** trong nội dung trả lời.
- Khi trích dẫn dữ liệu từ tool, PHẢI gắn citation theo format: [citation:N] (N là số thứ tự, bắt đầu từ 1).
- Mỗi fact phải có ít nhất 1 citation.
- Nếu có rủi ro hết chỗ (seatRisk high), CẢNH BÁO rõ ràng.
- Khi nêu sức chứa lớp, luôn ghi rõ theo mẫu: "còn X/Y chỗ trống" để tránh hiểu nhầm.
- Cuối mỗi phản hồi, LUÔN thêm đúng 3 gợi ý câu hỏi tiếp theo, format:
  SUGGESTIONS: ["câu gợi ý 1", "câu gợi ý 2", "câu gợi ý 3"]
  (phải là JSON array hợp lệ, trên 1 dòng riêng cuối cùng)

## Ví dụ phản hồi
"Đã kiểm tra lịch HK 20252 cho bạn [citation:1]. Điều kiện tiên quyết đáp ứng [citation:2].

Plan A — Tối ưu:
- MI1131 (Giải tích II) — Thứ 6, 14:00–16:30, phòng D5-401 (còn 45/90 chỗ trống)

Lưu ý: SSH1121 còn 2/150 chỗ trống, rủi ro hết chỗ cao [citation:3].

SUGGESTIONS: ["So sánh Plan A và Plan B cho tôi", "Tôi có thể đổi lịch môn Giải tích II không?", "Môn nào có nguy cơ hết chỗ cao nhất?"]"

## Luôn nhớ
- Ưu tiên an toàn cho sinh viên — cảnh báo rủi ro hết chỗ rõ ràng.
- Môn đại cương năm 1-2 là nhóm khó đăng ký nhất, luôn có Plan B.
- Khi không chắc chắn, hỏi lại thay vì đoán.
- Nhắc sinh viên tận dụng đợt điều chỉnh nếu đợt chính không thành công.`;

// ── Types ──

export type StreamEvent =
  | { type: "tool_start"; tool: string; label: string }
  | { type: "tool_end"; tool: string; label: string; summary?: string }
  | { type: "done"; text: string; citations: Citation[]; confidenceScore: number; flow: "happy" | "lowConfidence" | "failure"; planA: PlanSlot[] | null; planB: PlanSlot[] | null; toolsUsed: string[]; suggestions: string[] };

export type AgentResponse = {
  text: string;
  citations: Citation[];
  confidenceScore: number;
  flow: "happy" | "lowConfidence" | "failure";
  planA: PlanSlot[] | null;
  planB: PlanSlot[] | null;
  toolsUsed: string[];
  suggestions: string[];
};

export type PlanSlot = {
  code: string;
  name: string;
  day: string;
  startHour: number;
  endHour: number;
  room: string;
  seatRisk: string;
  classId: string;
};

export type AIConfig = {
  provider?: "gemini" | "chatgpt";
  apiKey?: string;
};

// ── LangGraph StateGraph ──

function shouldContinue(
  state: typeof MessagesAnnotation.State
): "tools" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    lastMessage &&
    "tool_calls" in lastMessage &&
    (lastMessage as AIMessage).tool_calls?.length
  ) {
    return "tools";
  }
  return END;
}

function buildGraph(config?: AIConfig) {
  const provider = config?.provider ?? "gemini";
  const providedApiKey = config?.apiKey?.trim();
  const geminiApiKey = providedApiKey || process.env.GEMINI_API_KEY;
  const openAiApiKey = providedApiKey || process.env.OPENAI_API_KEY;

  if (provider === "chatgpt" && !openAiApiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  if (provider === "gemini" && !geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const model =
    provider === "chatgpt"
      ? new ChatOpenAI({
          apiKey: openAiApiKey,
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0,
        }).bindTools(allTools)
      : new ChatGoogle({
          apiKey: geminiApiKey,
          model: process.env.DEFAULT_MODEL || "gemini-2.5-flash",
          temperature: 0,
        }).bindTools(allTools);

  const toolNode = new ToolNode(allTools);

  async function agentNode(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  }

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      [END]: END,
    })
    .addEdge("tools", "agent");

  return workflow.compile();
}

// ── Helpers ──

function parseSuggestions(text: string): { cleanText: string; suggestions: string[] } {
  const match = text.match(/SUGGESTIONS:\s*(\[[\s\S]*?\])\s*$/m);
  if (!match) return { cleanText: text.trim(), suggestions: [] };
  try {
    const suggestions = JSON.parse(match[1]) as string[];
    const cleanText = text.slice(0, match.index).trim();
    return { cleanText, suggestions };
  } catch {
    return { cleanText: text.trim(), suggestions: [] };
  }
}

function normalizeCitationRefs(text: string, citations: Citation[]): string {
  const validIds = new Set(citations.map((c) => c.id));
  return text.replace(/\[(\d+(?:,\d+)*)\]/g, (_m, group) => {
    const keep = String(group)
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((id) => validIds.has(id));
    if (keep.length === 0) return "";
    return `[${keep.join(",")}]`;
  });
}

function extractCitationsAndPlans(messages: BaseMessage[]) {
  const citations: Citation[] = [];
  let citationCounter = 1;
  let planA: PlanSlot[] | null = null;
  let planB: PlanSlot[] | null = null;
  const toolsUsed: string[] = [];

  for (const msg of messages) {
    if (msg._getType() === "tool") {
      try {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        const parsed = JSON.parse(content);

        if (parsed._citation) {
          const cit = parsed._citation as {
            type: string;
            title: string;
            detail: string;
          };
          // Deduplicate by title
          if (!citations.find((c) => c.title === cit.title)) {
            citations.push({
              id: citationCounter++,
              type: cit.type as Citation["type"],
              title: cit.title,
              detail: cit.detail,
              timestamp: new Date().toLocaleString("vi-VN"),
            });
          }
        }

        if (parsed.planA) planA = parsed.planA;
        if (parsed.planB) planB = parsed.planB;
      } catch {
        // skip non-JSON tool messages
      }

      if ("name" in msg && typeof msg.name === "string") {
        toolsUsed.push(msg.name);
      }
    }
  }

  return { citations, planA, planB, toolsUsed };
}

function parseAgentResponse(messages: BaseMessage[]): AgentResponse {
  const { citations, planA, planB, toolsUsed } = extractCitationsAndPlans(messages);

  const lastMessage = messages[messages.length - 1];
  let rawText =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  // Normalize citation markers: [citation:N] → [N]
  rawText = rawText.replace(/\[citation:(\d+)\]/g, "[$1]");
  // Remove markdown bold markers to keep plain, readable text in UI.
  rawText = rawText.replace(/\*\*/g, "");
  // Remove legacy "Điểm tin cậy" lines from model text (UI computes confidence separately)
  rawText = rawText.replace(/\n?Điểm tin cậy:\s*\d+\s*\/\s*100\s*/gi, "\n");

  const { cleanText: text, suggestions } = parseSuggestions(rawText);
  const normalizedText = normalizeCitationRefs(text, citations);

  const confidenceScore = 85;

  let flow: AgentResponse["flow"] = "happy";
  if (confidenceScore < 50) flow = "failure";
  else if (confidenceScore < 80) flow = "lowConfidence";

  return { text: normalizedText, citations, confidenceScore, flow, planA, planB, toolsUsed, suggestions };
}

// ── Run Agent (non-streaming) ──

export async function runAgent(
  userMessage: string,
  history: { role: "user" | "model"; text: string }[],
  config?: AIConfig
): Promise<AgentResponse> {
  const graph = buildGraph(config);
  const messages: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];

  for (const h of history) {
    const { HumanMessage, AIMessage: AIM } = await import("@langchain/core/messages");
    if (h.role === "user") messages.push(new HumanMessage(h.text));
    else messages.push(new AIM(h.text));
  }

  const { HumanMessage } = await import("@langchain/core/messages");
  messages.push(new HumanMessage(userMessage));

  const result = await graph.invoke({ messages }, { recursionLimit: 15 });
  return parseAgentResponse(result.messages);
}

// ── Tool label map ──

const TOOL_LABELS: Record<string, string> = {
  get_student_profile: "Đang đọc hồ sơ sinh viên...",
  get_recommended_courses: "Đang tra cứu CTĐT học kỳ này...",
  search_courses: "Đang tìm kiếm môn học...",
  check_schedule: "Đang kiểm tra lịch và chỗ ngồi...",
  check_prerequisites: "Đang kiểm tra điều kiện tiên quyết...",
  generate_schedule: "Đang tạo Plan A + Plan B...",
};

// ── Stream Agent — single graph.stream("updates") pass ──

export async function* streamAgent(
  userMessage: string,
  history: { role: "user" | "model"; text: string }[],
  config?: AIConfig
): AsyncGenerator<StreamEvent> {
  const graph = buildGraph(config);

  const { HumanMessage, AIMessage: AIM, SystemMessage: SM } = await import("@langchain/core/messages");
  const messages: BaseMessage[] = [new SM(SYSTEM_PROMPT)];

  for (const h of history) {
    if (h.role === "user") messages.push(new HumanMessage(h.text));
    else messages.push(new AIM(h.text));
  }
  messages.push(new HumanMessage(userMessage));

  // Single streaming pass — "updates" mode gives us each node's output
  const stream = await graph.stream(
    { messages },
    { streamMode: "updates", recursionLimit: 15 }
  );

  // Accumulate all messages from updates to build the final state
  const allMessages: BaseMessage[] = [...messages];
  // Track yielded tool_start/end to avoid duplicates
  const yieldedToolStarts = new Set<string>();

  for await (const update of stream) {
    for (const [nodeName, nodeOutput] of Object.entries(update)) {
      const nodeMessages = (nodeOutput as { messages?: BaseMessage[] }).messages ?? [];

      if (nodeName === "agent") {
        // Look for tool calls in the agent's output
        for (const msg of nodeMessages) {
          if ("tool_calls" in msg && (msg as AIMessage).tool_calls?.length) {
            for (const tc of (msg as AIMessage).tool_calls ?? []) {
              const toolName = tc.name;
              if (!yieldedToolStarts.has(toolName + allMessages.length)) {
                yieldedToolStarts.add(toolName + allMessages.length);
                yield {
                  type: "tool_start",
                  tool: toolName,
                  label: TOOL_LABELS[toolName] ?? `Đang gọi ${toolName}...`,
                };
              }
            }
          }
        }
      }

      if (nodeName === "tools") {
        for (const msg of nodeMessages) {
          if (msg._getType() === "tool") {
            const toolName = ("name" in msg && typeof msg.name === "string") ? msg.name : "unknown";
            let summary = "";
            try {
              const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
              const parsed = JSON.parse(content);
              if (parsed._citation) {
                summary = (parsed._citation as { detail: string }).detail.slice(0, 80);
              }
            } catch { /* skip */ }

            yield {
              type: "tool_end",
              tool: toolName,
              label: TOOL_LABELS[toolName]?.replace("Đang", "Hoàn thành") ?? `Xong ${toolName}`,
              summary,
            };
          }
        }
      }

      // Accumulate messages from this node update
      for (const msg of nodeMessages) {
        allMessages.push(msg);
      }
    }
  }

  // Parse final state from all accumulated messages
  const result = parseAgentResponse(allMessages);

  yield {
    type: "done",
    text: result.text,
    citations: result.citations,
    confidenceScore: result.confidenceScore,
    flow: result.flow,
    planA: result.planA,
    planB: result.planB,
    toolsUsed: result.toolsUsed,
    suggestions: result.suggestions,
  };
}
