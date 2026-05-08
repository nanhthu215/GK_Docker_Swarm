# 4. Scaling & Load Balancing

## 4.1 Scaling trong Docker Swarm

**Scaling** là khả năng thay đổi số lượng bản sao (replicas) hoặc tài nguyên của một dịch vụ để đáp ứng nhu cầu sử dụng thực tế.

### Phân loại Scaling
* **Horizontal Scaling (Scaling Out/In):** Đây là cơ chế chính của Swarm. Tăng hoặc giảm số lượng **replicas** (container) chạy cùng một image. Khi tải tăng, ta thêm container (Scale out); khi tải giảm, ta bớt container (Scale in).
* **Vertical Scaling (Scaling Up/Down):** Thay đổi **tài nguyên** (CPU, RAM) cho các container hiện có. Trong Swarm, việc này thường yêu cầu cập nhật lại cấu hình dịch vụ thông qua lệnh `docker service update --limit-cpu...`.

### Mục đích và Lợi ích
* **Khả năng chịu tải (High Availability):** Khi có nhiều bản sao, nếu một container bị lỗi (crash), các bản sao còn lại vẫn tiếp tục phục vụ người dùng, giúp hệ thống không bị gián đoạn.
* **Tối ưu tài nguyên:** Giúp hệ thống không bị lãng phí tài nguyên khi thấp điểm và tránh tình trạng nghẽn cổ chai khi cao điểm.
* **Cân bằng tải (Load Balancing):** Kết hợp chặt chẽ với Routing Mesh để phân phối lưu lượng truy cập đều cho các bản sao đang hoạt động.

### Trạng thái mong muốn (Desired State)
Docker Swarm hoạt động theo mô hình quản lý trạng thái. Khi ta scale lên 5 replicas, Swarm sẽ duy trì "trạng thái mong muốn" này bằng mọi giá. Nếu người dùng vô tình xóa mất 1 container hoặc 1 node bị sập, Swarm sẽ tự động nhận diện sự sai lệch và khởi tạo lại container mới trên các tài nguyên còn lại để luôn đảm bảo đủ số lượng 5.

### Docker Swarm có auto-scaling built-in không?

**Không theo nghĩa metric-based như Kubernetes HPA.** Docker Swarm cho phép thay đổi số replicas rất nhanh, nhưng bản thân Swarm **không tự theo dõi CPU/RAM để tự động scale ngang** nếu không có công cụ hỗ trợ bên ngoài.

| Kiểu scaling | Docker Swarm hỗ trợ thế nào? |
|--------------|------------------------------|
| **Manual scaling** | Hỗ trợ trực tiếp qua CLI / API |
| **Scheduled scaling** | Hỗ trợ gián tiếp qua cron, CI/CD, script |
| **Metric-based auto scaling** | Cần công cụ ngoài như Prometheus + script / webhook / pipeline |

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

### Chiến lược scale tự động trong thực tế

Trong production, một luồng auto-scaling khả thi với Swarm thường là:

1. Thu thập metric bằng Prometheus, cAdvisor, Node Exporter hoặc monitoring khác.
2. Đặt ngưỡng, ví dụ CPU trung bình > 70% trong 5 phút.
3. Khi vượt ngưỡng, một script hoặc pipeline gọi Docker API / CLI:

```bash
docker service update --replicas 6 my-web
```

4. Khi tải giảm ổn định trong một khoảng thời gian, automation scale-in về mức thấp hơn:

```bash
docker service update --replicas 3 my-web
```

Ví dụ pseudo-flow:

```text
Prometheus alert -> webhook -> script autoscale.sh
  if cpu > 70% for 5m -> scale out +2 replicas
  if cpu < 25% for 10m -> scale in -1 replica
```

> Kết luận quan trọng: Docker Swarm **hỗ trợ scale rất tốt**, nhưng nếu đề cập đến **tự động** scale theo tải thì phải nói rõ rằng cần thêm lớp automation bên ngoài.

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

> Lưu ý: Routing Mesh thường phân phối khá đều giữa các replicas, nhưng trong thực tế không nên cam kết cứng rằng mỗi container sẽ nhận đúng số request bằng nhau ở mọi lần chạy. Kết quả còn phụ thuộc thời điểm task sẵn sàng, kiểu client, keep-alive và việc kết nối có được tái sử dụng hay không.

### Ví dụ:

```bash
# Publish port 80
docker service create --name web --replicas 3 -p 80:80 nginx

# Dù request đến Worker1, Worker2, hay Manager đều OK!
curl http://worker1-ip:80   
curl http://worker2-ip:80   
curl http://manager-ip:80   
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

>**Chứng minh:** Routing Mesh phân phối request qua nhiều container khác nhau; khi lặp lại đủ nhiều lần sẽ quan sát được nhiều hostname/instance cùng tham gia xử lý.

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
