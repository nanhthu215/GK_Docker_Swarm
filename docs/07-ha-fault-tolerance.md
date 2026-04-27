# 7. High Availability & Fault Tolerance

## 7.1 Desired State Reconciliation

Docker Swarm hoạt động theo mô hình **declarative** (khai báo): bạn nói với Swarm *"tôi muốn 3 bản sao nginx"*, và Swarm **liên tục đảm bảo** trạng thái thực tế khớp với trạng thái mong muốn.

```
Desired State:  replicas = 3
Actual State:   replicas = 3  ✅ OK

─── Nếu 1 container crash ───────────────────────

Desired State:  replicas = 3
Actual State:   replicas = 2  ❌ MISMATCH

→ Swarm Manager phát hiện → Tạo task mới → Deploy lên node phù hợp

Desired State:  replicas = 3
Actual State:   replicas = 3  ✅ RESTORED
```

**Quá trình này diễn ra tự động, liên tục, không cần can thiệp thủ công.**

---

## 7.2 Khi Container Crash

```
Scenario: Task đang chạy bị crash (OOM, process crash, etc.)

Before:
  Worker1: [Task 1 - RUNNING] [Task 2 - RUNNING]
  Worker2: [Task 3 - RUNNING]

Task 1 crashes:
  Worker1: [Task 1 - FAILED] [Task 2 - RUNNING]
  Worker2: [Task 3 - RUNNING]

Swarm detects (trong vài giây):
  Worker1: [Task 1 - SHUTDOWN] [Task 1_new - STARTING] [Task 2 - RUNNING]
  Worker2: [Task 3 - RUNNING]

After recovery:
  Worker1: [Task 1_new - RUNNING] [Task 2 - RUNNING]
  Worker2: [Task 3 - RUNNING]
  
✅ Service luôn có 3 replicas
```

### Xem lịch sử task (kể cả đã chết):

```bash
docker service ps my-web --no-trunc

# Output:
# ID       NAME       IMAGE   NODE     DESIRED  CURRENT    ERROR
# new123   my-web.1   nginx   worker1  Running  Running    
# old456   \_ my-web.1 nginx  worker1  Shutdown Failed    "task: non-zero exit (137)"
```

---

## 7.3 Khi Worker Node Crash

```
Cluster: 1 Manager + 3 Workers (9 tasks tổng)

Trước sự cố:
  Manager:  [API.1]
  Worker1:  [Web.1] [Web.2] [API.2]
  Worker2:  [Web.3] [API.3] [Redis.1]
  Worker3:  [Web.4] [Web.5] [API.4]

Worker2 sập:
  Manager:  [API.1]
  Worker1:  [Web.1] [Web.2] [API.2]
  Worker2:  ❌ OFFLINE
  Worker3:  [Web.4] [Web.5] [API.4]
  
  Missing: [Web.3] [API.3] [Redis.1]

Swarm tự phục hồi (trong vài giây đến phút):
  Manager:  [API.1] [Redis.1_new]    ← Redis.1 được tạo lại
  Worker1:  [Web.1] [Web.2] [API.2] [API.3_new]
  Worker3:  [Web.4] [Web.5] [API.4] [Web.3_new]
```

### Kiểm tra trạng thái node:

```bash
docker node ls
# ID          HOSTNAME   STATUS  AVAILABILITY  MANAGER STATUS
# abc123 *   manager1   Ready   Active        Leader
# def456     worker1    Ready   Active        
# ghi789     worker2    Down    Active        ← Node sập!
# jkl012     worker3    Ready   Active        
```

---

## 7.4 Khi Manager Node Crash

### Single Manager (không khuyến nghị cho production):

```
Manager crash → Cluster mất khả năng quản lý
→ Tasks đang chạy vẫn tiếp tục (containers không dừng)
→ Nhưng KHÔNG THỂ: scale, update, deploy mới
→ Cần phục hồi manager hoặc khởi tạo swarm mới
```

### Multi-Manager với Raft (recommended):

```
3 Managers: M1 (Leader), M2 (Follower), M3 (Follower)

M1 crash:
→ M2 và M3 phát hiện Leader mất (heartbeat timeout)
→ Bầu chọn Leader mới: M2 hoặc M3 trở thành Leader
→ Cluster tiếp tục hoạt động bình thường ✅

Cần 2/3 nodes alive → chịu được 1 manager crash
```

```bash
# Kiểm tra trạng thái manager
docker node ls
# MANAGER STATUS: Leader / Reachable / Unreachable
```

---

## 7.5 Restart Policy

Cấu hình chi tiết cách Swarm xử lý khi task bị lỗi:

```yaml
deploy:
  restart_policy:
    condition: on-failure   # Điều kiện restart
    delay: 5s               # Chờ trước khi thử lại
    max_attempts: 3         # Số lần thử tối đa trong window
    window: 120s            # Cửa sổ thời gian đánh giá
```

### `condition` options:

| Giá trị | Mô tả |
|---------|-------|
| `none` | Không bao giờ restart |
| `on-failure` | Chỉ restart khi exit code ≠ 0 |
| `any` | Luôn restart (kể cả exit code = 0) |

### Ví dụ logic:

```
restart_policy:
  condition: on-failure
  delay: 5s
  max_attempts: 3
  window: 120s

Timeline khi task lỗi:
  T=0:   Task FAILED (exit 1)
  T=5s:  Retry 1 → FAILED
  T=10s: Retry 2 → FAILED  
  T=15s: Retry 3 → FAILED
  T=15s: max_attempts đạt → Swarm dừng retry
         Task ở trạng thái FAILED
         
  Nếu sau 120s (window) task vẫn lỗi → báo cáo health degraded
```

---

## 7.6 Health Checks

Swarm có thể tích hợp với Docker HEALTHCHECK để xác định container thực sự "healthy":

```dockerfile
# Trong Dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost/health || exit 1
```

```yaml
# Hoặc trong docker-compose.yml
services:
  api:
    image: myapi:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s    # Chờ 40s trước khi bắt đầu health check
    deploy:
      replicas: 3
```

```
Task States with Healthcheck:
  STARTING → RUNNING (unhealthy) → RUNNING (healthy) ✅
                                 → FAILED (nếu max retries exceeded)
```

---

## 7.7 Best Practices cho High Availability

### Cluster setup:
- ✅ Dùng **số lẻ managers** (3 hoặc 5)
- ✅ Manager nodes trên **máy vật lý khác nhau** hoặc **availability zones** khác nhau
- ✅ Manager nodes chỉ làm quản lý (không chạy app tasks)

```bash
# Ngăn manager chạy application tasks
docker node update --availability drain manager1
```

### Service configuration:
- ✅ Luôn đặt `restart_policy`
- ✅ Luôn đặt resource `limits` và `reservations`
- ✅ Sử dụng `healthcheck` để phát hiện app hung
- ✅ Dùng `update_config.failure_action: rollback`
- ✅ `min_replicas ≥ 2` cho production services

### Data persistence:
- ✅ Database dùng volume, gắn với node cố định (`placement constraints`)
- ✅ Hoặc dùng external storage (NFS, cloud volumes)
- ✅ Backup định kỳ volumes

---

## 7.8 Drain và Availability

```bash
# Drain: Ngăn node nhận task mới + di chuyển tasks hiện có đi nơi khác
docker node update --availability drain worker1
# → Tasks trên worker1 được schedule lại sang nodes khác
# → Dùng khi cần bảo trì node

# Active: Node bình thường, nhận tasks
docker node update --availability active worker1

# Pause: Ngăn node nhận task mới (tasks hiện tại vẫn chạy)
docker node update --availability pause worker1
```

---

## 7.9 Tổng kết: Bảng so sánh độ tin cậy

| Scenario | Kết quả | Thời gian phục hồi |
|----------|---------|-------------------|
| 1 container crash | Tự tạo lại | < 30 giây |
| 1 worker node crash | Tasks di chuyển sang node khác | 1-2 phút |
| 1/3 manager crash | Bầu Leader mới, tiếp tục hoạt động | < 10 giây |
| 2/3 manager crash | **Cluster mất quorum, ngừng hoạt động** | Cần can thiệp |
| Tất cả manager crash | **Cluster ngừng hoạt động** | Cần can thiệp |
