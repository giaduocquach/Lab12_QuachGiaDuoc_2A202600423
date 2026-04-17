"""Production AI Agent for Day 12 final project."""
import json
import logging
import signal
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from app.auth import verify_api_key
from app.config import settings
from app.cost_guard import check_budget, estimate_request_cost, get_current_month_spend
from app.rate_limiter import check_rate_limit
from app.vinagent_service import answer_question as vinagent_answer
from utils.mock_llm import ask as llm_ask


logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format='{"ts":"%(asctime)s","lvl":"%(levelname)s","msg":"%(message)s"}',
)
logger = logging.getLogger(__name__)

START_TIME = time.time()
_is_ready = False
_request_count = 0
_error_count = 0

redis_client = redis.from_url(settings.redis_url, decode_responses=True)


def _redis_healthy() -> bool:
    try:
        redis_client.ping()
        return True
    except redis.RedisError:
        return False


def _history_key(user_id: str) -> str:
    return f"history:{user_id}"


def _estimate_tokens(text: str) -> int:
    return max(1, len(text.split()) * 2)


def _load_history(user_id: str) -> list[dict]:
    try:
        raw_items = redis_client.lrange(_history_key(user_id), 0, -1)
    except redis.RedisError as exc:
        raise HTTPException(status_code=503, detail="Conversation storage unavailable") from exc

    history: list[dict] = []
    for item in raw_items:
        try:
            history.append(json.loads(item))
        except json.JSONDecodeError:
            continue
    return history


def _save_turn(user_id: str, question: str, answer: str) -> int:
    now_iso = datetime.now(timezone.utc).isoformat()
    messages = [
        {"role": "user", "content": question, "timestamp": now_iso},
        {"role": "assistant", "content": answer, "timestamp": now_iso},
    ]

    try:
        pipe = redis_client.pipeline()
        for message in messages:
            pipe.rpush(_history_key(user_id), json.dumps(message))
        pipe.ltrim(_history_key(user_id), -40, -1)
        pipe.expire(_history_key(user_id), settings.session_ttl_seconds)
        pipe.execute()
        return redis_client.llen(_history_key(user_id))
    except redis.RedisError as exc:
        raise HTTPException(status_code=503, detail="Conversation storage unavailable") from exc


def _answer_with_context(question: str, history: list[dict], user_id: str) -> str:
    previous_user_messages = [item["content"] for item in history if item.get("role") == "user"]
    normalized = question.strip().lower()

    domain_answer = vinagent_answer(question, user_id)
    if domain_answer:
        if previous_user_messages:
            return f"{domain_answer}\n\nContext from previous turn: \"{previous_user_messages[-1]}\"."
        return domain_answer

    if previous_user_messages and (
        "what did i just say" in normalized
        or "what did i ask" in normalized
    ):
        return f'You previously asked: "{previous_user_messages[-1]}".'

    answer = llm_ask(question)
    if previous_user_messages:
        return f"{answer}\n\nContext from previous turn: \"{previous_user_messages[-1]}\"."
    return answer


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _is_ready
    logger.info(json.dumps({
        "event": "startup",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }))

    _is_ready = _redis_healthy()
    if _is_ready:
        logger.info(json.dumps({"event": "ready"}))
    else:
        logger.warning(json.dumps({"event": "ready", "status": "redis_unavailable"}))

    yield

    _is_ready = False
    logger.info(json.dumps({"event": "graceful_shutdown"}))


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)


@app.middleware("http")
async def request_middleware(request: Request, call_next):
    global _request_count, _error_count
    started_at = time.time()
    _request_count += 1
    try:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        if "server" in response.headers:
            del response.headers["server"]

        logger.info(json.dumps({
            "event": "request",
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "ms": round((time.time() - started_at) * 1000, 1),
        }))
        return response
    except Exception:
        _error_count += 1
        raise


class AskRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    question: str = Field(..., min_length=1, max_length=2000)


class AskResponse(BaseModel):
    user_id: str
    question: str
    answer: str
    model: str
    history_size: int
    timestamp: str


def _api_info_payload() -> dict:
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "endpoints": {
            "ask": "POST /ask (requires X-API-Key)",
            "health": "GET /health",
            "ready": "GET /ready",
            "history": "GET /history/{user_id}",
            "api_info": "GET /api-info",
        },
    }


def _render_ui() -> str:
    return """<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BKAgent - Co van dang ky tin chi thong minh</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
        :root {
            --primary: #ce1628;
            --gold: #f3c108;
            --bg: #f8f6f4;
            --surface: #ffffff;
            --line: #eadfdb;
            --text: #201f1d;
            --muted: #66615d;
            --ok: #147a4b;
            --warn: #8b5e00;
            --danger: #b4232d;
            --shadow: 0 8px 30px rgba(59, 28, 20, 0.09);
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            min-height: 100vh;
            color: var(--text);
            background:
                radial-gradient(900px 340px at -5% -15%, rgba(206, 22, 40, 0.13), transparent 55%),
                radial-gradient(800px 260px at 105% -10%, rgba(243, 193, 8, 0.2), transparent 56%),
                var(--bg);
            font-family: "Montserrat", system-ui, sans-serif;
        }

        .app {
            display: grid;
            grid-template-columns: 248px minmax(0, 1fr);
            min-height: 100vh;
        }

        .sidebar {
            color: #fff;
            background: linear-gradient(180deg, #ce1628 0%, #ac1020 100%);
            border-right: 1px solid rgba(255, 255, 255, 0.18);
            padding: 16px 12px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            border-radius: 12px;
        }

        .brand-mark {
            width: 35px;
            height: 35px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.2);
            display: grid;
            place-items: center;
            font-weight: 700;
            font-size: 0.95rem;
        }

        .brand h1 {
            margin: 0;
            font-size: 1rem;
            line-height: 1.2;
            letter-spacing: 0.01em;
        }

        .brand p {
            margin: 2px 0 0;
            font-size: 0.73rem;
            color: rgba(255, 255, 255, 0.8);
        }

        .nav-list {
            display: grid;
            gap: 5px;
        }

        .nav-item {
            border: 0;
            border-radius: 10px;
            color: #fff;
            text-align: left;
            font-size: 0.89rem;
            padding: 10px 11px;
            background: transparent;
        }

        .nav-item.active {
            background: rgba(255, 255, 255, 0.2);
            font-weight: 600;
        }

        .sidebar-foot {
            margin-top: auto;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            padding-top: 11px;
            font-size: 0.76rem;
            line-height: 1.4;
            color: rgba(255, 255, 255, 0.8);
        }

        .main {
            min-width: 0;
            display: grid;
            grid-template-rows: auto 1fr;
            gap: 0;
        }

        .topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 14px;
            padding: 16px 20px;
            border-bottom: 1px solid var(--line);
            background: rgba(255, 255, 255, 0.82);
            backdrop-filter: blur(6px);
        }

        .topbar h2 {
            margin: 0;
            font-size: 1.05rem;
            color: var(--primary);
            letter-spacing: 0.01em;
        }

        .topbar p {
            margin: 3px 0 0;
            font-size: 0.83rem;
            color: var(--muted);
        }

        .inline-row {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }

        .btn {
            border: 1px solid transparent;
            border-radius: 10px;
            font-weight: 600;
            font-family: inherit;
            font-size: 0.83rem;
            padding: 8px 11px;
            cursor: pointer;
            transition: all 0.14s ease;
            color: #fff;
            background: var(--primary);
        }

        .btn:hover { filter: brightness(1.05); }

        .btn.soft {
            color: var(--primary);
            background: #fff;
            border-color: rgba(206, 22, 40, 0.28);
        }

        .workspace {
            min-height: 0;
            display: grid;
            grid-template-columns: minmax(320px, 39%) minmax(0, 1fr);
            gap: 0;
            padding: 14px;
        }

        .panel {
            min-height: 0;
            background: var(--surface);
            border: 1px solid var(--line);
            box-shadow: var(--shadow);
            border-radius: 14px;
            overflow: hidden;
        }

        .panel + .panel {
            margin-left: 11px;
        }

        .panel-head {
            border-bottom: 1px solid #efe7e4;
            padding: 10px 13px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            background: linear-gradient(180deg, #fff 0%, #fff9f8 100%);
        }

        .panel-head strong {
            font-size: 0.88rem;
            color: var(--primary);
        }

        .panel-head span {
            font-size: 0.76rem;
            color: var(--muted);
        }

        .panel-body {
            min-height: 0;
            height: calc(100% - 56px);
            display: flex;
            flex-direction: column;
        }

        .chat-scroll {
            min-height: 0;
            flex: 1;
            overflow: auto;
            padding: 13px;
            display: grid;
            gap: 9px;
            background: #fffcfb;
        }

        .bubble {
            max-width: 88%;
            font-size: 0.86rem;
            line-height: 1.45;
            padding: 9px 11px;
            border-radius: 11px;
            white-space: pre-wrap;
        }

        .bubble.user {
            justify-self: end;
            background: var(--primary);
            color: #fff;
            border-top-right-radius: 3px;
        }

        .bubble.assistant {
            justify-self: start;
            background: #fff;
            border: 1px solid #eaded9;
            border-top-left-radius: 3px;
        }

        .suggestions {
            padding: 0 13px 10px;
            display: grid;
            gap: 7px;
            border-top: 1px dashed #eadbd7;
            background: #fff;
        }

        .suggestions button {
            border: 1px solid rgba(206, 22, 40, 0.25);
            border-radius: 9px;
            background: #fff;
            color: var(--primary);
            padding: 8px 10px;
            text-align: left;
            font-size: 0.81rem;
            font-family: inherit;
            cursor: pointer;
        }

        .composer {
            border-top: 1px solid #ece1dd;
            padding: 10px;
            display: grid;
            gap: 8px;
            background: #fff;
        }

        .grid2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        label {
            display: grid;
            gap: 4px;
            font-size: 0.72rem;
            color: var(--muted);
        }

        input {
            width: 100%;
            border: 1px solid #dbcfc9;
            border-radius: 8px;
            padding: 8px 9px;
            font-family: inherit;
            font-size: 0.83rem;
            color: var(--text);
            background: #fff;
        }

        input:focus {
            outline: none;
            border-color: rgba(206, 22, 40, 0.52);
            box-shadow: 0 0 0 3px rgba(206, 22, 40, 0.1);
        }

        .composer-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
        }

        .result-scroll {
            min-height: 0;
            flex: 1;
            overflow: auto;
            padding: 13px;
            display: grid;
            align-content: start;
            gap: 11px;
            background: #fff;
        }

        .plan-switch {
            display: inline-flex;
            padding: 3px;
            border-radius: 10px;
            border: 1px solid #e8d8d1;
            background: #fff8f6;
            gap: 4px;
        }

        .plan-switch button {
            border: 0;
            border-radius: 7px;
            padding: 6px 11px;
            font-size: 0.76rem;
            font-weight: 600;
            background: transparent;
            color: #8f5b52;
            cursor: pointer;
        }

        .plan-switch button.active {
            color: #fff;
            background: var(--primary);
        }

        .meter {
            border: 1px solid #efdfdb;
            border-radius: 11px;
            padding: 9px;
            background: linear-gradient(180deg, #fff8f7 0%, #fff 100%);
        }

        .meter-line {
            height: 7px;
            border-radius: 999px;
            background: #efe8e5;
            overflow: hidden;
            margin-top: 6px;
        }

        .meter-fill {
            height: 100%;
            background: linear-gradient(90deg, #ce1628 0%, #f3c108 100%);
        }

        .course-list {
            display: grid;
            gap: 8px;
        }

        .course-item {
            border: 1px solid #ecdfda;
            border-radius: 10px;
            padding: 10px;
            background: #fff;
            display: grid;
            gap: 4px;
        }

        .course-title {
            font-size: 0.86rem;
            font-weight: 700;
            color: var(--primary);
        }

        .course-meta {
            font-size: 0.78rem;
            line-height: 1.35;
            color: var(--muted);
        }

        .badge {
            display: inline-flex;
            width: fit-content;
            align-items: center;
            gap: 5px;
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 0.72rem;
            border: 1px solid #e2d8d3;
            background: #fff;
        }

        .badge.low { color: var(--ok); border-color: rgba(20, 122, 75, 0.35); }
        .badge.medium { color: var(--warn); border-color: rgba(139, 94, 0, 0.35); }
        .badge.high { color: var(--danger); border-color: rgba(180, 35, 45, 0.35); }

        .muted-box {
            border: 1px dashed #dbcfc9;
            border-radius: 10px;
            padding: 14px;
            font-size: 0.82rem;
            color: var(--muted);
            text-align: center;
            background: #fffcfb;
        }

        .status {
            font-size: 0.8rem;
            font-weight: 600;
            min-height: 1.2em;
        }

        .status.ok { color: var(--ok); }
        .status.err { color: var(--danger); }
        .status.warn { color: var(--warn); }

        pre {
            margin: 0;
            border-radius: 10px;
            border: 1px solid #eadfd9;
            background: #fffdfc;
            padding: 10px;
            font-family: "JetBrains Mono", ui-monospace, monospace;
            font-size: 0.73rem;
            line-height: 1.45;
            color: #4f4a47;
            max-height: 220px;
            overflow: auto;
        }

        @media (max-width: 1100px) {
            .workspace {
                grid-template-columns: minmax(280px, 1fr);
                grid-auto-rows: minmax(430px, auto);
            }
            .panel + .panel {
                margin-left: 0;
                margin-top: 11px;
            }
        }

        @media (max-width: 860px) {
            .app {
                grid-template-columns: 1fr;
                grid-template-rows: auto 1fr;
            }
            .sidebar {
                border-right: 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                padding: 10px;
                gap: 9px;
            }
            .nav-list {
                display: flex;
                gap: 5px;
                overflow: auto;
                padding-bottom: 1px;
            }
            .nav-item {
                white-space: nowrap;
                padding: 8px 10px;
            }
            .sidebar-foot { display: none; }
            .topbar { padding: 12px; }
            .workspace { padding: 10px; }
            .grid2 { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="app">
        <aside class="sidebar">
            <div class="brand">
                <div class="brand-mark">BK</div>
                <div>
                    <h1>BKAgent</h1>
                    <p>Co van dang ky tin chi thong minh</p>
                </div>
            </div>

            <div class="nav-list">
                <button class="nav-item">Trang chu</button>
                <button class="nav-item active">Tao ke hoach</button>
                <button class="nav-item">Bang chi so</button>
                <button class="nav-item">Ho so</button>
            </div>

            <div class="sidebar-foot">
                <div>Da dong goi tu project BKAgent Lab5-6.</div>
                <div>Van giu auth, rate limit, budget guard, Redis session.</div>
            </div>
        </aside>

        <main class="main">
            <header class="topbar">
                <div>
                    <h2>BKAgent Workspace</h2>
                    <p>Nhap yeu cau bang ngon ngu tu nhien, he thong tao Plan A/Plan B cho dang ky hoc phan.</p>
                </div>
                <div class="inline-row">
                    <button class="btn soft" type="button" onclick="checkOps('/health')">Kiem tra /health</button>
                    <button class="btn soft" type="button" onclick="checkOps('/ready')">Kiem tra /ready</button>
                    <button class="btn soft" type="button" onclick="window.open('/api-info', '_blank')">Mo /api-info</button>
                </div>
            </header>

            <section class="workspace">
                <article class="panel">
                    <div class="panel-head">
                        <div>
                            <strong>Chat voi BKAgent</strong>
                            <span>Khung chat ben trai giong giao dien Lab5-6</span>
                        </div>
                    </div>
                    <div class="panel-body">
                        <div id="chatScroll" class="chat-scroll"></div>

                        <div class="suggestions">
                            <button type="button" onclick="askFromSuggestion(this.textContent)">Len lich HK 20252, tranh sang, phai co Giai tich II va Vat ly II</button>
                            <button type="button" onclick="askFromSuggestion(this.textContent)">Dang ky 5 mon, uu tien lop con nhieu cho</button>
                            <button type="button" onclick="askFromSuggestion(this.textContent)">Xep lich KTCT Mac-Lenin + GDTC 2 + CTDL&GT, tranh xung dot</button>
                        </div>

                        <form class="composer" onsubmit="submitAsk(event)">
                            <div class="grid2">
                                <label>
                                    User ID
                                    <input id="userId" value="20210001" />
                                </label>
                                <label>
                                    X-API-Key
                                    <input id="apiKey" placeholder="Nhap AGENT_API_KEY de goi /ask" />
                                </label>
                            </div>
                            <div class="composer-row">
                                <input id="prompt" placeholder="Nhap yeu cau dang ky hoc phan..." />
                                <button class="btn" type="submit">Gui</button>
                            </div>
                        </form>
                    </div>
                </article>

                <article class="panel">
                    <div class="panel-head">
                        <div>
                            <strong>Plan va Ket qua</strong>
                            <span>Khung ket qua ben phai: Plan A / Plan B</span>
                        </div>
                        <div class="plan-switch">
                            <button id="planAButton" class="active" type="button" onclick="switchPlan('A')">Plan A</button>
                            <button id="planBButton" type="button" onclick="switchPlan('B')">Plan B</button>
                        </div>
                    </div>
                    <div class="panel-body">
                        <div class="result-scroll">
                            <div class="meter">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                    <strong style="font-size:0.82rem;color:var(--primary)">Do tin cay tung plan</strong>
                                    <span id="scoreText" style="font-size:0.75rem;color:var(--muted)">A: - | B: -</span>
                                </div>
                                <div class="meter-line"><div id="planAMeter" class="meter-fill" style="width:0%"></div></div>
                                <div class="meter-line"><div id="planBMeter" class="meter-fill" style="width:0%"></div></div>
                            </div>

                            <div id="planList" class="course-list">
                                <div class="muted-box">Lich hoc se hien thi o day sau khi ban gui yeu cau trong khung chat.</div>
                            </div>

                            <div id="status" class="status">San sang.</div>
                            <pre id="rawOutput">Chua co response.</pre>
                        </div>
                    </div>
                </article>
            </section>
        </main>
    </div>

    <script>
        const state = {
            selectedPlan: 'A',
            planA: [],
            planB: [],
            scoreA: 0,
            scoreB: 0,
            messages: [
                {
                    role: 'assistant',
                    text: 'Xin chao! Minh la BKAgent. Mo ta yeu cau dang ky hoc phan bang ngon ngu tu nhien, minh se tao ke hoach toi uu cho ban.'
                }
            ]
        };

        function setStatus(text, type) {
            const el = document.getElementById('status');
            el.textContent = text;
            el.className = 'status' + (type ? ' ' + type : '');
        }

        function appendMessage(role, text) {
            state.messages.push({ role, text });
            renderMessages();
        }

        function renderMessages() {
            const wrap = document.getElementById('chatScroll');
            wrap.innerHTML = '';
            for (const msg of state.messages) {
                const div = document.createElement('div');
                div.className = 'bubble ' + (msg.role === 'user' ? 'user' : 'assistant');
                div.textContent = msg.text;
                wrap.appendChild(div);
            }
            wrap.scrollTop = wrap.scrollHeight;
        }

        function parsePlan(answer) {
            const result = { A: [], B: [] };
            const lines = String(answer || '')
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);

            let current = null;
            for (const line of lines) {
                if (/^Plan A/i.test(line)) {
                    current = 'A';
                    continue;
                }
                if (/^Plan B/i.test(line)) {
                    current = 'B';
                    continue;
                }
                if (!current || !line.startsWith('- ')) {
                    continue;
                }

                const raw = line.slice(2).trim();
                const parts = raw.split('|').map((p) => p.trim());
                const riskMatch = raw.match(/risk\\s+(low|medium|high)/i);
                result[current].push({
                    code: parts[0] || 'N/A',
                    title: parts[1] || 'Unknown course',
                    detail: parts.slice(2).join(' | ') || raw,
                    risk: riskMatch ? riskMatch[1].toLowerCase() : 'medium'
                });
            }
            return result;
        }

        function computeScore(courses) {
            if (!courses.length) return 0;
            let total = 0;
            for (const c of courses) {
                let base = 92;
                if (c.risk === 'high') base -= 28;
                else if (c.risk === 'medium') base -= 12;
                else base -= 3;

                const seatsMatch = c.detail.match(/seats\\s+(\\d+)\\/(\\d+)/i);
                if (seatsMatch) {
                    const enrolled = parseInt(seatsMatch[1], 10);
                    const capacity = parseInt(seatsMatch[2], 10);
                    if (capacity > 0) {
                        const ratio = enrolled / capacity;
                        if (ratio > 0.97) base -= 24;
                        else if (ratio > 0.9) base -= 12;
                        else if (ratio > 0.8) base -= 6;
                    }
                }
                total += base;
            }
            const score = Math.round(total / courses.length);
            return Math.max(35, Math.min(99, score));
        }

        function switchPlan(plan) {
            state.selectedPlan = plan;
            document.getElementById('planAButton').classList.toggle('active', plan === 'A');
            document.getElementById('planBButton').classList.toggle('active', plan === 'B');
            renderPlan();
        }

        function renderPlan() {
            const list = document.getElementById('planList');
            const courses = state.selectedPlan === 'A' ? state.planA : state.planB;

            if (!courses.length) {
                list.innerHTML = '<div class="muted-box">Chua co du lieu cho Plan ' + state.selectedPlan + '.</div>';
            } else {
                list.innerHTML = courses.map((course) => {
                    return (
                        '<div class="course-item">' +
                            '<div class="course-title">' + escapeHtml(course.code) + ' - ' + escapeHtml(course.title) + '</div>' +
                            '<div class="course-meta">' + escapeHtml(course.detail) + '</div>' +
                            '<span class="badge ' + course.risk + '">risk: ' + course.risk + '</span>' +
                        '</div>'
                    );
                }).join('');
            }

            document.getElementById('scoreText').textContent = 'A: ' + (state.scoreA || '-') + ' | B: ' + (state.scoreB || '-');
            document.getElementById('planAMeter').style.width = (state.scoreA || 0) + '%';
            document.getElementById('planBMeter').style.width = (state.scoreB || 0) + '%';
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function askFromSuggestion(text) {
            document.getElementById('prompt').value = text;
            sendAsk(text);
        }

        async function submitAsk(event) {
            event.preventDefault();
            const prompt = document.getElementById('prompt').value.trim();
            await sendAsk(prompt);
        }

        async function sendAsk(question) {
            const userId = document.getElementById('userId').value.trim();
            const apiKey = document.getElementById('apiKey').value.trim();

            if (!question) {
                setStatus('Hay nhap yeu cau truoc khi gui.', 'warn');
                return;
            }
            if (!userId) {
                setStatus('User ID khong duoc de trong.', 'warn');
                return;
            }

            appendMessage('user', question);
            setStatus('Dang goi /ask ...', 'warn');

            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) {
                headers['X-API-Key'] = apiKey;
            }

            try {
                const res = await fetch('/ask', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ user_id: userId, question })
                });

                const text = await res.text();
                document.getElementById('rawOutput').textContent = text;

                let payload = {};
                try {
                    payload = JSON.parse(text);
                } catch (err) {
                    payload = { answer: text };
                }

                if (!res.ok) {
                    const detail = payload && payload.detail ? payload.detail : ('HTTP ' + res.status);
                    appendMessage('assistant', 'Request loi: ' + detail);
                    setStatus('/ask -> HTTP ' + res.status, 'err');
                    return;
                }

                const answer = payload.answer || 'Khong co answer field trong response.';
                appendMessage('assistant', answer);

                const plans = parsePlan(answer);
                state.planA = plans.A;
                state.planB = plans.B;
                state.scoreA = computeScore(plans.A);
                state.scoreB = computeScore(plans.B);
                renderPlan();
                setStatus('/ask -> HTTP ' + res.status + ' (da cap nhat plan)', 'ok');
            } catch (err) {
                appendMessage('assistant', 'Khong the ket noi den service: ' + (err.message || String(err)));
                setStatus('Khong the ket noi den service.', 'err');
            }
        }

        async function checkOps(path) {
            setStatus('Dang kiem tra ' + path + ' ...', 'warn');
            try {
                const res = await fetch(path);
                const body = await res.text();
                document.getElementById('rawOutput').textContent = body;
                if (res.ok) {
                    setStatus(path + ' -> HTTP ' + res.status, 'ok');
                } else {
                    setStatus(path + ' -> HTTP ' + res.status, 'err');
                }
            } catch (err) {
                setStatus('Loi ket noi khi goi ' + path, 'err');
            }
        }

        renderMessages();
        renderPlan();
        checkOps('/health');
    </script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse, tags=["UI"])
def root():
    return HTMLResponse(_render_ui())


@app.get("/api-info", tags=["Info"])
def api_info():
    return _api_info_payload()


@app.post("/ask", response_model=AskResponse, tags=["Agent"])
async def ask_agent(
    body: AskRequest,
    request: Request,
    _api_key: str = Depends(verify_api_key),
):
    check_rate_limit(body.user_id)
    history = _load_history(body.user_id)

    logger.info(json.dumps({
        "event": "agent_call",
        "user_id": body.user_id,
        "q_len": len(body.question),
        "client": str(request.client.host) if request.client else "unknown",
    }))

    answer = _answer_with_context(body.question, history, body.user_id)

    input_tokens = _estimate_tokens(body.question)
    output_tokens = _estimate_tokens(answer)
    check_budget(body.user_id, estimate_request_cost(input_tokens, output_tokens))

    history_size = _save_turn(body.user_id, body.question, answer)

    return AskResponse(
        user_id=body.user_id,
        question=body.question,
        answer=answer,
        model=settings.llm_model,
        history_size=history_size,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/history/{user_id}", tags=["Agent"])
def history(user_id: str, _api_key: str = Depends(verify_api_key)):
    return {
        "user_id": user_id,
        "messages": _load_history(user_id),
    }


@app.get("/health", tags=["Operations"])
def health():
    redis_ok = _redis_healthy()
    return {
        "status": "ok" if redis_ok else "degraded",
        "version": settings.app_version,
        "environment": settings.environment,
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "total_requests": _request_count,
        "checks": {
            "redis": "ok" if redis_ok else "down",
            "llm": "mock" if not settings.openai_api_key else "openai",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ready", tags=["Operations"])
def ready():
    if not _is_ready or not _redis_healthy():
        raise HTTPException(status_code=503, detail="Not ready")
    return {"ready": True}


@app.get("/metrics", tags=["Operations"])
def metrics(user_id: str, _api_key: str = Depends(verify_api_key)):
    spent = get_current_month_spend(user_id)
    return {
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "total_requests": _request_count,
        "error_count": _error_count,
        "monthly_spent_usd": round(spent, 6),
        "monthly_budget_usd": settings.monthly_budget_usd,
    }


def _handle_signal(signum, _frame):
    logger.info(json.dumps({"event": "signal", "signum": signum}))


signal.signal(signal.SIGTERM, _handle_signal)


if __name__ == "__main__":
    logger.info(f"Starting {settings.app_name} on {settings.host}:{settings.port}")
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        timeout_graceful_shutdown=30,
    )
