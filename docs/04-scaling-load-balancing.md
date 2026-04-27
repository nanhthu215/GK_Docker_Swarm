# 4. Scaling & Load Balancing

## 4.1 Scaling trong Docker Swarm

**Scaling** là khả năng tăng hoặc giảm số lượng bản sao (replicas) của một service.

### Scaling thủ công:

```bash
# Tăng lên 5 replicas
docker service scale my-web=5

# Scale nhiều services cùng lúc
docker service scale my-web=5 my-api=3

# Hoặc dùng update
docker service update --replicas 5 my-web
```

### Quan sát quá trình scale:

```bash
# Theo dõi real-time
watch docker service ps my-web

# Output:
# ID        NAME       IMAGE    NODE      DESIRED STATE  CURRENT STATE
# abc1      my-web.1   nginx    worker1   Running        Running
# abc2      my-web.2   nginx    worker2   Running        Running
# abc3      my-web.3   nginx    worker3   Running        Running
# abc4      my-web.4   nginx    worker1   Running        Starting ← mới thêm
# abc5      my-web.5   nginx    worker2   Running        Starting ← mới thêm
```

### Scale xuống:

```bash
# Giảm xuống 2 replicas
docker service scale my-web=2
# Swarm tự chọn task để xóa và dọn dẹp
```

---

## 4.2 Ingress Network (Routing Mesh)

**Ingress Routing Mesh** là cơ chế load balancing tích hợp sẵn của Docker Swarm. Đây là tính năng mạnh mẽ nhất:

### Cơ chế hoạt động:

```
                    Internet
                       │
                       ▼ port 80
        ┌──────────────────────────────┐
        │      BẤT KỲ NODE NÀO        │
        │    (kể cả không có task)     │
        └──────────┬───────────────────┘
                   │
              Ingress Network
                   │
         ┌─────────┼─────────┐
         ▼         ▼         ▼
     [Task 1]  [Task 2]  [Task 3]
     Worker1   Worker2   Worker3
```

### Đặc điểm quan trọng:

| Tính năng | Mô tả |
|-----------|-------|
| **Bất kỳ node** | Request đến node nào cũng được xử lý |
| **Round-robin** | Tự động phân phối đều giữa các replicas |
| **Transparent** | Client không cần biết task ở node nào |
| **Internal VIP** | Mỗi service có Virtual IP nội bộ |

### Ví dụ:

```bash
# Publish port 80
docker service create --name web --replicas 3 -p 80:80 nginx

# Dù request đến Worker1, Worker2, hay Manager đều OK!
curl http://worker1-ip:80   # ✅
curl http://worker2-ip:80   # ✅
curl http://manager-ip:80   # ✅
```

---

## 4.3 Ingress vs Host Mode

### Ingress Mode (mặc định):
```bash
# Port được publish trên TẤT CẢ nodes
docker service create -p 80:80 nginx
# Tương đương:
docker service create -p mode=ingress,published=80,target=80 nginx
```

### Host Mode:
```bash
# Port chỉ publish trên node ĐANG CHẠY TASK
docker service create -p mode=host,published=80,target=80 nginx
# Chỉ có node chứa task mới có thể nhận request trên port 80
```

| | Ingress | Host |
|--|---------|------|
| Load balancing | ✅ Tự động | ❌ Thủ công |
| Port conflicts | ❌ Không (node không task vẫn nghe) | ✅ Tránh được |
| External LB | Dễ dàng | Phức tạp hơn |

---

## 4.4 DNS Round-Robin (Service Discovery)

Ngoài Ingress, Docker Swarm còn hỗ trợ **DNS-based load balancing** cho internal services:

```bash
# Tạo service trong overlay network
docker service create \
  --name api \
  --replicas 3 \
  --network my-overlay \
  --endpoint-mode dnsrr \   # DNS Round Robin
  myapi:latest
```

```
Container A curl http://api/endpoint
    ↓
Docker DNS → api → [10.0.0.2, 10.0.0.3, 10.0.0.4]
                     Round Robin: mỗi request → IP khác nhau
```

---

## 4.5 Demo: Chứng minh Load Balancing

### Tình huống:
- Service `whoami` trả về hostname của container
- 3 replicas đang chạy
- Gửi nhiều request → thấy hostname khác nhau

```bash
# Tạo service
docker service create \
  --name whoami \
  --replicas 3 \
  -p 8080:80 \
  traefik/whoami

# Gửi 6 requests
for i in $(seq 1 6); do
  curl -s http://localhost:8080 | grep "Hostname"
done

# Kết quả mẫu:
# Hostname: 2a9f1b3c4d5e   ← container 1
# Hostname: 7f8e9a0b1c2d   ← container 2
# Hostname: 3b4c5d6e7f8a   ← container 3
# Hostname: 2a9f1b3c4d5e   ← container 1 (round-robin lại)
# Hostname: 7f8e9a0b1c2d   ← container 2
# Hostname: 3b4c5d6e7f8a   ← container 3
```

> ✅ **Chứng minh:** Routing Mesh phân phối đều request qua 3 container khác nhau.

---

## 4.6 Resource Limits

Kiểm soát tài nguyên để đảm bảo không có service nào chiếm hết tài nguyên:

```yaml
# Trong docker-compose.yml
deploy:
  resources:
    limits:           # Giới hạn tối đa
      cpus: '0.50'    # 50% của 1 CPU core
      memory: 128M
    reservations:     # Tài nguyên được đặt trước (reserved)
      cpus: '0.25'
      memory: 64M
```

```bash
# Xem resource usage
docker stats $(docker ps -q)
```
