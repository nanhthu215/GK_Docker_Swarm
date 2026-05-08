# Lab 3 – Rolling Update & Rollback Demo

## Mục tiêu

Quan sát Docker Swarm thực hiện **rolling update** từ `nginx:1.23-alpine` → `nginx:1.24-alpine`, chứng minh service **không bị downtime** trong suốt quá trình cập nhật.

---

## Quy trình thực hiện

### Bước 1: Deploy Stack với nginx:1.23-alpine

```bash
# Đảm bảo Swarm đã init
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml rollstack

# Chờ 3/3 replicas Running
docker service ls
# NAME             MODE       REPLICAS  IMAGE
# rollstack_web   replicated  3/3      nginx:1.23-alpine
```

### Bước 2: Xác nhận version cũ đang chạy

```bash
docker service ps rollstack_web
# ID      NAME             IMAGE             NODE       DESIRED  CURRENT
# t1abc   rollstack_web.1  nginx:1.23-alpine my-laptop  Running  Running
# t2def   rollstack_web.2  nginx:1.23-alpine my-laptop  Running  Running
# t3ghi   rollstack_web.3  nginx:1.23-alpine my-laptop  Running  Running
```

### Bước 3: Mở terminal theo dõi (2 terminals riêng)

**Terminal A – Theo dõi service tasks:**
```bash
# Linux/macOS
watch -n 1 "docker service ps rollstack_web"

# Windows PowerShell
while ($true) { 
    Clear-Host
    docker service ps rollstack_web
    Start-Sleep 2
}
```

**Terminal B – Theo dõi uptime (kiểm tra không downtime):**
```bash
# Linux/macOS
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80)
  echo "$(date '+%H:%M:%S') → HTTP $STATUS"
  sleep 1
done

# Windows PowerShell
while ($true) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:80" -UseBasicParsing
        Write-Host "$(Get-Date -Format 'HH:mm:ss') → HTTP $($r.StatusCode)"
    } catch {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') → ERROR!" -ForegroundColor Red
    }
    Start-Sleep 1
}
```

### Bước 4: Thực hiện Rolling Update

**Terminal C – Thực hiện update:**
```bash
# Cập nhật image từ nginx:1.23-alpine → nginx:1.24-alpine
docker service update \
  --image nginx:1.24-alpine \
  --update-parallelism 1 \
  --update-delay 15s \
  rollstack_web
```

**Hoặc cách bám sát stack file hơn:**

1. Sửa dòng `image:` trong `docker-compose.yml` từ `nginx:1.23-alpine` thành `nginx:1.24-alpine`
2. Chạy lại:

```bash
docker stack deploy -c docker-compose.yml rollstack
```

Swarm vẫn sẽ nhận diện thay đổi và thực hiện rolling update theo `update_config`.

### Bước 5: Quan sát quá trình update (Terminal A)

```
Thời điểm bắt đầu (tất cả nginx:1.23-alpine):
ID      NAME             IMAGE      STATE
t1abc   rollstack_web.1  nginx:1.23-alpine Running
t2def   rollstack_web.2  nginx:1.23-alpine Running
t3ghi   rollstack_web.3  nginx:1.23-alpine Running

Sau ~5s (task 1 đang cập nhật):
ID      NAME               IMAGE          STATE
NEW1    rollstack_web.1    nginx:1.24-alpine     Starting  ← TASK MỚI
t1abc   \_ rollstack_web.1 nginx:1.23-alpine Shutdown  ← task cũ
t2def   rollstack_web.2    nginx:1.23-alpine Running
t3ghi   rollstack_web.3    nginx:1.23-alpine Running

Sau ~20s (task 1 xong, task 2 đang cập nhật):
ID      NAME               IMAGE          STATE
NEW1    rollstack_web.1    nginx:1.24-alpine     Running   ✅
NEW2    rollstack_web.2    nginx:1.24-alpine     Starting  ← đang cập nhật
t2def   \_ rollstack_web.2 nginx:1.23-alpine Shutdown
t3ghi   rollstack_web.3    nginx:1.23-alpine Running

Sau ~35s (hoàn thành):
ID      NAME             IMAGE          STATE
NEW1    rollstack_web.1  nginx:1.24-alpine     Running   ✅
NEW2    rollstack_web.2  nginx:1.24-alpine     Running   ✅
NEW3    rollstack_web.3  nginx:1.24-alpine     Running   ✅
```

### Kết quả Terminal B (không có downtime):

```
10:00:01 → HTTP 200
10:00:02 → HTTP 200
10:00:03 → HTTP 200  ← lúc này đang update task 1
10:00:04 → HTTP 200  ← service vẫn phản hồi từ task 2, 3
10:00:05 → HTTP 200
...tất cả đều 200, không có lỗi!
```

> ✅ **Chứng minh:** Service luôn trả về HTTP 200 trong suốt quá trình rolling update. Vì file compose dùng `healthcheck` và `order: start-first`, mỗi task mới có cơ hội sẵn sàng trước khi task cũ bị gỡ xuống.

---

## Bước 6 (Tùy chọn): Thực hiện Rollback

```bash
# Rollback về nginx:1.23-alpine
docker service rollback rollstack_web

# Xem quá trình rollback
docker service ps rollstack_web

# Sau khi rollback:
docker service inspect rollstack_web --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
# Output: nginx:1.23-alpine@sha256:...
```

## Bước 7 (khuyến nghị): Kiểm tra trạng thái update/rollback

```bash
docker service inspect rollstack_web --format '{{json .UpdateStatus}}'
```

Nếu update thành công, trường `State` thường là `completed`. Nếu update lỗi và `failure_action: rollback` được kích hoạt, bạn sẽ thấy thông tin rollback trong `UpdateStatus`.

---

## Dọn dẹp

```bash
docker stack rm rollstack
```

---

## Tổng kết Timeline

```
─────────────── Rolling Update Timeline ─────────────────────────────────────

v1.23: ──[T1]──[T2]──[T3]──────────────────────────────────────────────────
                              ↓ docker service update --image nginx:1.24-alpine
       ──[T1]──[T2]──[T3]──[update T1]──────────────────────────────────────
                                          ↓ T1 done, chờ 15s
v1.24:                              ──[T1]──[update T2]──────────────────────
                                                           ↓ T2 done, chờ 15s
                                                ──[T1]──[T2]──[update T3]───
                                                                       ↓ Done
                                                            ──[T1]──[T2]──[T3]

HTTP: 200  200  200  200  200  200  200  200  200  200  200  200  200  200
          ✅ Không một request nào bị lỗi trong suốt quá trình!
```
