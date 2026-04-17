# Day 12 Lab - Báo Cáo Cá Nhân

Học viên: Quách Gia Được 2A202600423 
Ngày: 2026-04-17

## Phần 1: Localhost vs Production

### Bài tập 1.1: Các anti-pattern đã tìm thấy
Mã nguồn đã xem: `01-localhost-vs-production/develop/app.py`

1. Thông tin bí mật được khai báo trực tiếp trong mã nguồn (`OPENAI_API_KEY`, `DATABASE_URL`).
2. Ứng dụng ghi log lộ secret (dùng `print` và in ra API key).
3. Chế độ debug bị cố định trong code (`DEBUG = True`).
4. Không có endpoint health để nền tảng tự động kiểm tra sống/chết và restart.
5. Chỉ bind host `localhost` (không thân thiện với container).
6. Port bị cố định là `8000` (bỏ qua biến môi trường `PORT` của nền tảng).
7. Auto-reload bật trong luồng chạy chính, không an toàn cho production.

### Bài tập 1.2: Chạy phiên bản basic
Các lệnh đã chuẩn bị:

```bash
cd 01-localhost-vs-production/develop
pip install -r requirements.txt
python app.py

curl http://localhost:8000/ask -X POST \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
```

Kết quả mong đợi: dịch vụ có phản hồi, nhưng chưa đạt chuẩn production vì các anti-pattern ở trên.

### Bài tập 1.3: Bảng so sánh

| Tiêu chí | Basic | Production | Vì sao quan trọng? |
|---------|-------|------------|--------------------|
| Cấu hình | Hardcode trong source | Nạp từ environment | An toàn hơn cho secrets, dễ đổi môi trường |
| Health check | Thiếu | `GET /health` | Nền tảng phát hiện lỗi và tự khởi động lại |
| Readiness | Thiếu | `GET /ready` | Load balancer không đẩy traffic vào instance chưa sẵn sàng |
| Logging | `print()` | JSON có cấu trúc | Dễ tìm kiếm, phân tích, giám sát |
| Shutdown | Tắt đột ngột | Xử lý SIGTERM graceful | Tránh rơi request đang xử lý |
| Bind/port | localhost + cố định 8000 | 0.0.0.0 + env `PORT` | Chạy tốt trong container và cloud |

---

## Phần 2: Docker

### Bài tập 2.1: Câu hỏi về Dockerfile
Mã nguồn đã xem: `02-docker/develop/Dockerfile`

1. Base image: `python:3.11`
2. Working directory: `/app`
3. Lý do copy requirements trước: tận dụng cache layer Docker để chỉ cài lại dependency khi requirements thay đổi.
4. CMD và ENTRYPOINT:
   - CMD: lệnh mặc định, có thể override khi chạy container.
   - ENTRYPOINT: điểm vào cố định của container, thường kết hợp thêm tham số từ CMD.

### Bài tập 2.2: Build và chạy container basic
Các lệnh:

```bash
docker build -f 02-docker/develop/Dockerfile -t my-agent:develop .
docker run -p 8000:8000 my-agent:develop
curl http://localhost:8000/ask -X POST \
  -H "Content-Type: application/json" \
  -d '{"question": "What is Docker?"}'
```

### Bài tập 2.3: So sánh multi-stage build
Mã nguồn đã xem: `02-docker/production/Dockerfile`

- Stage 1 (`builder`): cài build dependency và package Python.
- Stage 2 (`runtime`): chỉ copy artifact cần chạy, dùng user không phải root, base image slim.

Tác động mong đợi: image nhỏ hơn và an toàn hơn (thường giảm khoảng 50-70%).

### Bài tập 2.4: Kiến trúc Docker Compose
Mã nguồn đã xem: `02-docker/production/docker-compose.yml`

Kiến trúc:

```text
Client -> Nginx -> Agent -> Redis
                     \-> Qdrant
```

Các service gồm: `agent`, `redis`, `qdrant`, `nginx`.

---

## Phần 3: Cloud Deployment

### Bài tập 3.1: Deploy Railway
Cấu hình đã xem: `03-cloud-deployment/railway/railway.toml`

Các lệnh:

```bash
cd 03-cloud-deployment/railway
npm i -g @railway/cli
railway login
railway init
railway variables set PORT=8000
railway variables set AGENT_API_KEY=<your-key>
railway up
railway domain
```

Public URL: https://lab12-quachgiaduoc-2a202600423-production.up.railway.app

### Bài tập 3.2: Deploy Render / so sánh cấu hình
Cấu hình đã xem: `03-cloud-deployment/render/render.yaml`

- Cấu hình Railway (`railway.toml`) gọn, thiên về CLI.
- Cấu hình Render (`render.yaml`) tường minh theo kiểu IaC, thể hiện rõ topology service và env.

### Bài tập 3.3: Cloud Run (tùy chọn)
`cloudbuild.yaml` + `service.yaml` trong `03-cloud-deployment/production-cloud-run` mô tả pipeline build CI và triển khai Cloud Run.

---

## Phần 4: API Security

### Bài tập 4.1: API key authentication
Mã nguồn đã xem: `04-api-gateway/develop/app.py`

- API key được lấy từ header `X-API-Key`.
- Thiếu key -> HTTP 401.
- Key sai -> HTTP 403.
- Key đúng -> request được phép đi tiếp.

### Bài tập 4.2: JWT authentication
Mã nguồn đã xem: `04-api-gateway/production/auth.py` và `app.py`

Luồng hoạt động:
1. `POST /auth/token` với username/password.
2. Server tạo JWT (`sub`, `role`, `iat`, `exp`).
3. Client gọi endpoint bảo vệ với `Authorization: Bearer <token>`.
4. Server verify token và inject thông tin user.

### Bài tập 4.3: Rate limiting
Mã nguồn đã xem: `04-api-gateway/production/rate_limiter.py`

- Thuật toán: sliding window dùng deque timestamp.
- User thường: 10 req/phút.
- Admin: 100 req/phút.
- Vượt quota -> HTTP 429 kèm header rate limit.

### Bài tập 4.4: Cost guard
Mã nguồn đã xem: `04-api-gateway/production/cost_guard.py`

- Theo dõi token usage theo user và quy đổi chi phí USD.
- Kiểm tra ngân sách theo user theo ngày và ngân sách tổng toàn hệ thống theo ngày.
- User vượt ngân sách -> HTTP 402.
- Hệ thống vượt ngân sách tổng -> HTTP 503.

---

## Phần 5: Scaling & Reliability

### Bài tập 5.1: Health và readiness checks
Mã nguồn đã xem: `05-scaling-reliability/develop/app.py`

- `/health`: thông tin liveness (uptime, các check cơ bản).
- `/ready`: cổng readiness, trả 503 khi service chưa sẵn sàng nhận traffic.

### Bài tập 5.2: Graceful shutdown
Mã nguồn đã xem: `05-scaling-reliability/develop/app.py`

- Có đăng ký handler cho SIGTERM.
- Khi shutdown, app tắt readiness và chờ request đang xử lý hoàn tất rồi mới thoát.

### Bài tập 5.3: Stateless design
Mã nguồn đã xem: `05-scaling-reliability/production/app.py`

- Session state được lưu ở Redis, không lưu trong memory của process.
- Bất kỳ instance nào cũng có thể tiếp tục hội thoại vì dùng storage dùng chung.

### Bài tập 5.4: Load balancing
Mã nguồn đã xem: `05-scaling-reliability/production/docker-compose.yml` và `nginx.conf`

- Nginx là điểm vào.
- Agent có thể scale nhiều replica.
- Request được phân tán qua các instance.

### Bài tập 5.5: Kiểm thử stateless
Mã nguồn đã xem: `05-scaling-reliability/production/test_stateless.py`

- Script gửi nhiều lượt hội thoại liên tiếp.
- Xác minh history vẫn giữ được khi request đi qua các instance khác nhau.

---

## Trạng thái hiện tại

Đã hoàn thành trong workspace này:

- Đã rà soát và viết tài liệu cho tất cả bài tập dựa trên source thực tế.
- Đã cập nhật Part 6 theo hướng bám sát rubric chấm điểm.
- Đã chọn project BKAgent từ buổi trước và đóng gói lại theo chuẩn Lab12 trong `06-lab-complete`.
- Đã migrate dữ liệu và logic cốt lõi BKAgent vào API production (`06-lab-complete/app/vinagent_service.py` + `app/vinagent_data/`).
- Đã chạy `06-lab-complete/check_production_ready.py` và đạt 100% kiểm tra.

Các bước còn cần làm thủ công trước khi nộp:

- Chụp ảnh minh chứng (dashboard, service running, test result).
- Đối chiếu checklist nộp lần cuối rồi push repo.
