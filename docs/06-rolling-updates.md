# 6. Rolling Updates & Rollbacks

## 6.1 Vấn đề: Cập nhật ứng dụng truyền thống

```
Cách cũ (downtime):
  1. Dừng tất cả containers
  2. Pull image mới
  3. Khởi động lại
  
  Timeline: ────── RUNNING ──────|── DOWNTIME ──|── RUNNING v2 ──
                                              ↑
                                         Users bị lỗi!
```

---

## 6.2 Rolling Update là gì?

**Rolling Update** (cập nhật cuốn chiếu) là kỹ thuật cập nhật từng nhóm nhỏ containers một lúc, đảm bảo **luôn có đủ bản sao đang chạy** trong suốt quá trình cập nhật.

```
Rolling Update với parallelism=1:

Step 1: [v1] [v1] [v1]   ← Tất cả v1
Step 2: [v2] [v1] [v1]   ← Cập nhật task 1 → v2
Step 3: [v2] [v2] [v1]   ← Cập nhật task 2 → v2
Step 4: [v2] [v2] [v2]   ← Cập nhật task 3 → v2

→ Luôn có ít nhất 2/3 tasks running ✅
→ Zero downtime ✅
```

---

## 6.3 Cấu hình `update_config`

```yaml
deploy:
  replicas: 3
  update_config:
    parallelism: 1        # Số task cập nhật cùng lúc
    delay: 10s            # Chờ 10s giữa các batch
    failure_action: rollback   # rollback | pause | continue
    monitor: 30s          # Theo dõi 30s sau update mỗi task
    max_failure_ratio: 0  # Tỉ lệ lỗi cho phép (0 = không chấp nhận)
    order: stop-first     # stop-first | start-first
```

### Giải thích các tham số:

| Tham số | Mô tả | Ví dụ |
|---------|-------|-------|
| `parallelism` | Bao nhiêu task cập nhật cùng lúc | `1` = từng cái một |
| `delay` | Thời gian chờ giữa các batch | `10s`, `1m` |
| `failure_action` | Làm gì khi update thất bại | `rollback`, `pause`, `continue` |
| `monitor` | Thời gian quan sát sau mỗi task | `30s` |
| `max_failure_ratio` | Tỉ lệ task lỗi được phép | `0.2` = 20% |
| `order` | Thứ tự dừng/khởi động | `stop-first`, `start-first` |

### `stop-first` vs `start-first`:

```
stop-first (mặc định):
  Dừng task cũ → Khởi động task mới
  Nhược điểm: capacity giảm tạm thời trong lúc update

start-first:
  Khởi động task mới → Chờ healthy → Dừng task cũ
  Ưu điểm: Không giảm capacity, an toàn hơn
  Nhược điểm: Cần thêm tài nguyên tạm thời
```

---

## 6.4 Thực hiện Rolling Update

```bash
# Cập nhật image của service
docker service update \
  --image nginx:1.25 \
  --update-parallelism 1 \
  --update-delay 10s \
  my-web

# Quan sát quá trình update
watch docker service ps my-web

# Output mẫu trong khi update:
# ID      NAME        IMAGE       NODE     DESIRED  CURRENT
# abc1    my-web.1    nginx:1.25  worker1  Running  Running 5s ago
# abc2    my-web.2    nginx:1.24  worker2  Running  Running 1h ago  ← chưa update
# xyz2    my-web.2    nginx:1.24  worker2  Shutdown Shutdown 5s ago ← đang update
# abc3    my-web.3    nginx:1.24  worker3  Running  Running 1h ago  ← chưa update
```

### Cập nhật qua docker-compose:

```bash
# Sửa image trong docker-compose.yml, sau đó:
docker stack deploy -c docker-compose.yml my-stack
# Swarm tự nhận diện thay đổi và thực hiện rolling update
```

---

## 6.5 Rollback – Khôi phục phiên bản cũ

### Rollback thủ công:

```bash
# Rollback ngay lập tức về version trước
docker service rollback my-web

# Xem trạng thái rollback
docker service ps my-web
```

### Cấu hình `rollback_config`:

```yaml
deploy:
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
    failure_action: rollback    # ← Tự động rollback khi lỗi!
    monitor: 30s
    max_failure_ratio: 0.2
  
  rollback_config:
    parallelism: 1       # Rollback từng task
    delay: 5s            # Chờ giữa các batch rollback
    failure_action: pause  # rollback | pause | continue
    monitor: 20s
    max_failure_ratio: 0
    order: stop-first
```

### Luồng tự động rollback:

```
Scenario: Deploy image lỗi

  Step 1: Deploy nginx:broken (không start được)
  Step 2: Task fails → Swarm chờ "monitor" (30s)
  Step 3: Vượt quá max_failure_ratio → trigger rollback
  Step 4: Swarm tự động rollback về nginx:1.24
  Step 5: Service khôi phục ✅

  Timeline:
  ─── nginx:1.24 ──── deploy broken ──┤ detect fail │── rollback ──► nginx:1.24 ───
                                       30s monitor window
```

---

## 6.6 Demo thực hành: Rolling Update

```bash
# Bước 1: Tạo service với nginx:1.23
docker service create \
  --name demo-web \
  --replicas 3 \
  -p 8080:80 \
  --update-parallelism 1 \
  --update-delay 10s \
  nginx:1.23

# Bước 2: Verify version cũ
docker service inspect demo-web --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
# Output: nginx:1.23@sha256:...

# Bước 3: Cập nhật lên nginx:1.24
docker service update --image nginx:1.24 demo-web

# Bước 4: Theo dõi (trong terminal khác)
watch -n 1 "docker service ps demo-web"

# Bước 5: Kiểm tra service không bị downtime
while true; do curl -s -o /dev/null -w "%{http_code}" http://localhost:8080; sleep 1; done
# Phải luôn trả về 200 ✅

# Bước 6: Confirm version mới
docker service inspect demo-web --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
# Output: nginx:1.24@sha256:...

# Bước 7: Rollback nếu cần
docker service rollback demo-web
```

---

## 6.7 Các trường hợp failure và xử lý

| Scenario | Hành vi | Cấu hình |
|----------|---------|-----------|
| Container crash sau update | Auto-rollback | `failure_action: rollback` |
| Health check fail | Tạm dừng update | `failure_action: pause` |
| Rollback cũng lỗi | Pause rollback | `rollback_config.failure_action: pause` |
| Image không tồn tại | Task = FAILED → rollback | Tự động |

```bash
# Xem lịch sử cập nhật
docker service inspect demo-web --format '{{json .UpdateStatus}}' | jq
# {
#   "State": "completed",
#   "StartedAt": "2024-01-15T10:00:00Z",
#   "CompletedAt": "2024-01-15T10:00:45Z",
#   "Message": "update completed"
# }
```
