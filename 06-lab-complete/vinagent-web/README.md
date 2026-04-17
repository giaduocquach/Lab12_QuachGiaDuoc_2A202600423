# BKAgent (HUST) - VinAgent Web

Web app ho tro sinh vien HUST lap ke hoach dang ky tin chi voi AI Agent (LangGraph + LangChain), co Plan A/B, do tin cay tung plan, va mo phong dang ky theo nhom.

## Yeu cau moi truong

- Node.js 20.x (khuyen nghi 20 LTS)
- npm 10+
- Git

Kiem tra nhanh:

```bash
node -v
npm -v
```

## Cai dat du an

Chay trong thu muc `vinagent-web`:

```bash
npm install
```

## Cau hinh bien moi truong

Tao file `.env.local` trong `vinagent-web` (neu chua co):

```bash
GOOGLE_API_KEY=your_google_key
OPENAI_API_KEY=your_openai_key
```

Luu y:
- Ban co the de trong key trong luc test UI.
- Trong trang Ho so nguoi dung, co the doi provider va nhap API key truc tiep tren giao dien.

## Chay development

```bash
npm run dev
```

Mo trinh duyet tai:
- [http://localhost:3000](http://localhost:3000)

Neu bi trung cong 3000:

```bash
npm run dev -- --port 3001
```

## Dang nhap demo

- MSSV: `2022600001` / Mat khau: `1`
- MSSV: `2022600002` / Mat khau: `1`

## Lenh kiem tra truoc khi demo

```bash
npm run lint
npm run test
npm run build
```

## Cau truc chinh

- `src/app/api/chat/route.ts`: API stream SSE cho AI agent
- `src/lib/ai/agent.ts`: LangGraph orchestration
- `src/lib/ai/tools.ts`: tools va logic lap lich
- `src/lib/mock/`: mock data (student, courses, schedule, prerequisites, curriculum)

## Build production

```bash
npm run build
npm start
```
