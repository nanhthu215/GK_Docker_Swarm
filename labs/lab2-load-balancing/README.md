# Lab 2 – Load Balancing Demo với Docker Swarm

## Mục tiêu

Chứng minh **Ingress Routing Mesh** của Docker Swarm phân phối requests đều qua **5 container** khác nhau, bằng cách mỗi container trả về **hostname** của chính nó.

---

## Cách thực hiện

### Bước 1: Build image

```bash
# Đứng trong thư mục lab2-load-balancing
docker build -t swarm-lb-demo:1.0 ./app

# Kiểm tra image đã được build
docker images swarm-lb-demo
```

### Bước 2: Triển khai stack

```bash
# Đảm bảo Swarm đã được khởi tạo
docker swarm init   # (bỏ qua nếu đã init từ Lab 1)

# Deploy stack
docker stack deploy -c docker-compose.yml lbstack

# Chờ tất cả replicas Ready
docker service ls
# NAME           MODE       REPLICAS  IMAGE
# lbstack_api   replicated  5/5      swarm-lb-demo:1.0
```

### Bước 3: Kiểm tra 5 tasks đang chạy

```bash
docker service ps lbstack_api
# ID      NAME          IMAGE              NODE       DESIRED  CURRENT
# t1abc   lbstack_api.1 swarm-lb-demo:1.0 my-laptop  Running  Running
# t2def   lbstack_api.2 swarm-lb-demo:1.0 my-laptop  Running  Running
# t3ghi   lbstack_api.3 swarm-lb-demo:1.0 my-laptop  Running  Running
# t4jkl   lbstack_api.4 swarm-lb-demo:1.0 my-laptop  Running  Running
# t5mno   lbstack_api.5 swarm-lb-demo:1.0 my-laptop  Running  Running
```

### Bước 4: Gửi 10 requests – Quan sát Load Balancing

#### Linux / macOS:
```bash
for i in $(seq 1 10); do
  curl -s http://localhost:3000 | python3 -m json.tool | grep hostname
  echo "---"
done
```

#### Windows PowerShell:
```powershell
1..10 | ForEach-Object {
    $response = Invoke-RestMethod -Uri "http://localhost:3000"
    Write-Host "Request $_`: hostname = $($response.hostname)"
}
```

#### Kết quả mẫu (chứng minh load balancing):
```
Request 1: hostname = a1b2c3d4e5f6   ← Container 1
Request 2: hostname = b2c3d4e5f6a1   ← Container 2
Request 3: hostname = c3d4e5f6a1b2   ← Container 3
Request 4: hostname = d4e5f6a1b2c3   ← Container 4
Request 5: hostname = e5f6a1b2c3d4   ← Container 5
Request 6: hostname = a1b2c3d4e5f6   ← Container 1 (quay lại)
Request 7: hostname = b2c3d4e5f6a1   ← Container 2
Request 8: hostname = c3d4e5f6a1b2   ← Container 3
Request 9: hostname = d4e5f6a1b2c3   ← Container 4
Request 10: hostname = e5f6a1b2c3d4  ← Container 5
```
> ✅ **Kết quả:** 10 requests được phân phối qua 5 containers khác nhau theo kiểu round-robin → **Ingress Routing Mesh hoạt động!**

### Bước 5: Xem header response

```bash
curl -v http://localhost:3000 2>&1 | grep "X-Container"
# X-Container-Hostname: a1b2c3d4e5f6
# X-Container-IP: 10.0.0.5
```

---

## Dọn dẹp

```bash
docker stack rm lbstack
```

---

## Giải thích kỹ thuật

```
Client → http://localhost:3000
             │
      ┌──────▼──────────────────────────────────────┐
      │  Ingress Routing Mesh (Docker Swarm)         │
      │                                              │
      │  Virtual IP (VIP) của service lbstack_api   │
      │         Round-Robin Load Balancer            │
      └──────┬──────────────────────────────────────┘
             │
     ┌───────┼───────┬───────┬───────┐
     ▼       ▼       ▼       ▼       ▼
  [C1]    [C2]    [C3]    [C4]    [C5]
hostname  hostname hostname hostname hostname
a1b2...  b2c3... c3d4... d4e5... e5f6...
```

Docker Swarm tự động phân phối request qua Virtual IP → không cần cấu hình thêm bất kỳ load balancer nào!
