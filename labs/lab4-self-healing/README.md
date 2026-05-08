# Lab 4 – Self-Healing & Fault Tolerance Demo

## Mục tiêu

Lab này minh họa trực tiếp nội dung ở mục **High Availability & Fault Tolerance**:

1. Service được khai báo chạy với **3 replicas**
2. Một container đang chạy bị **kill thủ công**
3. Docker Swarm phát hiện số replica thực tế bị giảm
4. Manager tự tạo **task mới** để đưa service quay lại trạng thái mong muốn

Nếu sau sự cố service quay lại `3/3`, đó chính là **desired state reconciliation** và **self-healing**.

## Bước 1: Khởi tạo Swarm

```bash
docker swarm init
```

Nếu máy đã ở trong Swarm thì bỏ qua bước này.

## Bước 2: Deploy stack

```bash
docker stack deploy -c docker-compose.yml healstack
```

## Bước 3: Chờ service sẵn sàng

```bash
docker service ls
```

Kết quả mong đợi:

```text
ID             NAME            MODE         REPLICAS   IMAGE
abc123         healstack_web   replicated   3/3        nginx:1.24-alpine
```

## Bước 4: Xem tasks của service

```bash
docker service ps healstack_web
```

Kết quả mẫu:

```text
ID          NAME             IMAGE               NODE          DESIRED STATE   CURRENT STATE
t1abc       healstack_web.1  nginx:1.24-alpine  DESKTOP-XXX   Running         Running 1m ago
t2def       healstack_web.2  nginx:1.24-alpine  DESKTOP-XXX   Running         Running 1m ago
t3ghi       healstack_web.3  nginx:1.24-alpine  DESKTOP-XXX   Running         Running 1m ago
```

## Bước 5: Xem container ID thực tế

```bash
docker ps --filter label=com.docker.swarm.service.name=healstack_web
```

Hoặc để nhìn gọn hơn:

```bash
docker ps --filter label=com.docker.swarm.service.name=healstack_web --format "table {{.ID}}\t{{.Names}}\t{{.Status}}"
```

Ví dụ:

```text
CONTAINER ID   NAMES              STATUS
111aaa222bbb   healstack_web.1.x  Up 1 minute
333ccc444ddd   healstack_web.2.y  Up 1 minute
555eee666fff   healstack_web.3.z  Up 1 minute
```

## Bước 6: Mở 2 cửa sổ theo dõi

### Terminal A – Theo dõi task của service

Linux/macOS:

```bash
watch -n 1 "docker service ps healstack_web"
```

Windows PowerShell:

```powershell
while ($true) {
    Clear-Host
    docker service ps healstack_web
    Start-Sleep 2
}
```

### Terminal B – Theo dõi khả năng truy cập service

Linux/macOS:

```bash
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081)
  echo "$(date '+%H:%M:%S') -> HTTP $STATUS"
  sleep 1
done
```

Windows PowerShell:

```powershell
while ($true) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing -TimeoutSec 3
        Write-Host "$(Get-Date -Format 'HH:mm:ss') -> HTTP $($r.StatusCode)"
    } catch {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') -> ERROR" -ForegroundColor Red
    }
    Start-Sleep 1
}
```

## Bước 7: Chủ động kill một container

Mở Terminal C và chọn một container ID ở Bước 5:

```bash
docker kill 111aaa222bbb
```

## Bước 8: Quan sát self-healing

Trong Terminal A, bạn sẽ thấy container cũ bị `Shutdown` và một task mới được tạo:

```text
ID          NAME               IMAGE               NODE          DESIRED STATE   CURRENT STATE
new789      healstack_web.1    nginx:1.24-alpine  DESKTOP-XXX   Running         Starting 2s ago
old123      \_ healstack_web.1 nginx:1.24-alpine  DESKTOP-XXX   Shutdown        Failed 3s ago
t2def       healstack_web.2    nginx:1.24-alpine  DESKTOP-XXX   Running         Running 2m ago
t3ghi       healstack_web.3    nginx:1.24-alpine  DESKTOP-XXX   Running         Running 2m ago
```

Sau vài giây, kiểm tra lại:

```bash
docker service ls
docker service ps healstack_web
```

Kết quả mong đợi:

```text
NAME            MODE         REPLICAS   IMAGE
healstack_web   replicated   3/3        nginx:1.24-alpine
```

## Bước 9: Giải thích kết quả

Điều vừa xảy ra là:

1. Bạn kill container nên trạng thái thực tế giảm từ `3 replicas` xuống còn `2 replicas`
2. Swarm Manager phát hiện trạng thái thực tế không còn khớp với trạng thái mong muốn
3. Manager tự tạo task mới
4. Service quay lại `3/3`

Đây chính là cơ chế:

- **Desired state reconciliation**
- **Self-healing**
- **Fault tolerance ở mức container**

## Bước 10: Mở rộng nếu có cluster nhiều node

Nếu bạn có thêm worker nodes thật, có thể làm demo nâng cao hơn:

1. Deploy cùng stack này lên cluster nhiều node
2. Ghi nhận task đang nằm trên worker nào bằng `docker service ps healstack_web`
3. Tắt worker đó hoặc chuyển node sang `drain`
4. Quan sát task được schedule lại sang node khác

Ví dụ:

```bash
docker node ls
docker node update --availability drain <worker-node-name>
docker service ps healstack_web
```

Lưu ý: bước `drain` này **không phù hợp** nếu bạn chỉ có 1 node local duy nhất.

## Dọn dẹp

```bash
docker stack rm healstack
```
