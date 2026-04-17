# Thông Tin Triển Khai

## Public URL
https://lab12-quachgiaduoc-2a202600423-production.up.railway.app

## Nền tảng
Railway

## Project được đóng gói theo yêu cầu bổ sung
- Project gốc đã chọn từ buổi trước: BKAgent (đã đóng gói lại trong `06-lab-complete/vinagent-web`)
- Đã đóng gói lại trong `06-lab-complete` theo chuẩn Lab12 (auth, rate limit, cost guard, health/readiness, stateless Redis, Docker, cloud deploy)
- Đã migrate dữ liệu vào `06-lab-complete/app/vinagent_data/` và dùng logic domain trong `06-lab-complete/app/vinagent_service.py`

## Trạng thái triển khai
- Kiểm tra local production: PASS (`06-lab-complete/check_production_ready.py` = 100%)
- Triển khai cloud: PASS
- Cập nhật mới (2026-04-17): đã bổ sung trực tiếp các route backend Day12 vào bản hiện tại (`/health`, `/ready`, `/api-info`, `/ask`) để vừa giữ BKAgent UI vừa đạt rubric backend.

## Kết quả kiểm thử cloud thực tế
- `GET /` -> `200` (HTML UI BKAgent Production UI)
- `GET /api-info` -> `200` (JSON metadata endpoint)
- `GET /health` -> `200`
- `GET /ready` -> `200`
- `POST /ask` không có API key -> `401`
- `POST /ask` có API key -> `200` (trả nội dung BKAgent: Plan A/Plan B đăng ký tín chỉ)
- `POST /api/chat` -> `200` (SSE stream cho giao diện chat)
- Rate limiting -> trả `429` sau khi vượt ngưỡng 10 req/phút

Ghi chú UI:
- Root `/` đã hiển thị workspace giao diện kiểu BKAgent Lab5-6 (sidebar đỏ, chat panel bên trái, Plan A/B panel bên phải).

## Lệnh kiểm thử

### Kiểm tra Health
```bash
curl https://lab12-quachgiaduoc-2a202600423-production.up.railway.app/health
```

Kết quả mong đợi: HTTP 200 với payload JSON trạng thái.

### Kiểm tra UI ở trang chủ
```bash
curl -I https://lab12-quachgiaduoc-2a202600423-production.up.railway.app/
```

Kết quả mong đợi: HTTP 200 và `Content-Type: text/html`.

### Kiểm tra endpoint metadata JSON
```bash
curl https://lab12-quachgiaduoc-2a202600423-production.up.railway.app/api-info
```

Kết quả mong đợi: HTTP 200 với JSON mô tả endpoint.

### Kiểm tra Readiness
```bash
curl https://lab12-quachgiaduoc-2a202600423-production.up.railway.app/ready
```

Kết quả mong đợi: HTTP 200 khi service sẵn sàng.

### Kiểm tra bắt buộc xác thực (negative test)
```bash
curl -X POST https://lab12-quachgiaduoc-2a202600423-production.up.railway.app/ask \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","question":"hello"}'
```

Kết quả mong đợi: HTTP 401.

### Kiểm tra API có xác thực
```bash
curl -X POST https://lab12-quachgiaduoc-2a202600423-production.up.railway.app/ask \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","question":"Hello"}'
```

Kết quả mong đợi: HTTP 200 kèm dữ liệu trả lời.

### Kiểm tra chat stream của giao diện
```bash
curl -X POST https://lab12-quachgiaduoc-2a202600423-production.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Lập kế hoạch học kỳ 20252"}'
```

Kết quả mong đợi: HTTP 200 với `Content-Type: text/event-stream`.

### Kiểm tra Rate Limiting
```bash
for i in {1..15}; do
  curl -X POST https://lab12-quachgiaduoc-2a202600423-production.up.railway.app/ask \
    -H "X-API-Key: YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test","question":"test"}'
done
```

Kết quả mong đợi: sau khi vượt ngưỡng, response trả HTTP 429.

## Biến môi trường đã cấu hình
- PORT
- REDIS_URL
- AGENT_API_KEY
- JWT_SECRET
- RATE_LIMIT_PER_MINUTE
- MONTHLY_BUDGET_USD
- ENVIRONMENT=production
- DEBUG=false

## Ảnh minh chứng
- [Bảng điều khiển triển khai](screenshots/dashboard.png)
- [Dịch vụ đang chạy](screenshots/running.png)
- [Kết quả kiểm thử API](screenshots/test.png)

## Ghi chú
API key và secret đã được set trên Railway, không commit vào repo.

Để lấy API key kiểm thử khi cần:

```bash
cd 06-lab-complete
railway variables --service Lab12-QuachGiaDuoc-2A202600423
```

Copy giá trị `AGENT_API_KEY` để chạy các lệnh test có xác thực.
