# 3. Services và Tasks trong Docker Swarm

## 3.1 Từ `docker run` đến Swarm Service

### Docker run (container độc lập):
```bash
docker run -d -p 80:80 nginx
```
- Chạy **1 container** trên **1 host** cụ thể
- Nếu container crash → **phải tự khởi động lại thủ công**
- Không có load balancing
- Không scale được

### Docker Service (Swarm):
```bash
docker service create --name web --replicas 3 -p 80:80 nginx
```
- Định nghĩa **trạng thái mong muốn** (desired state)
- Swarm **tự duy trì** số lượng replica
- Tự **cân bằng tải** giữa các bản sao
- Tự **phân phối** lên các node phù hợp

---

## 3.2 Service là gì?

**Service** là đơn vị triển khai trong Docker Swarm. Nó mô tả:

| Thuộc tính | Ví dụ |
|------------|-------|
| Image sử dụng | `nginx:1.24` |
| Số bản sao | `3 replicas` |
| Cổng publish | `80:80` |
| Tài nguyên | CPU 0.5, RAM 128MB |
| Network | `my-overlay-network` |
| Restart policy | `any` |

```bash
# Tạo service
docker service create \
  --name my-web \
  --replicas 3 \
  --publish published=80,target=80 \
  --limit-cpu 0.5 \
  --limit-memory 128m \
  nginx:1.24

# Xem danh sách services
docker service ls

# Xem chi tiết service
docker service inspect my-web --pretty

# Xem logs của service
docker service logs my-web
```

---

## 3.3 Task là gì?

**Task** là đơn vị nhỏ nhất trong Swarm – tương đương với **1 container** đang chạy trên **1 node** cụ thể.

```
Service: my-web (replicas=3)
├── Task 1 → Container trên Worker Node 1
├── Task 2 → Container trên Worker Node 2
└── Task 3 → Container trên Manager Node
```

### Vòng đời của một Task:

```
NEW → PENDING → ASSIGNED → ACCEPTED → PREPARING → STARTING → RUNNING
                                                              ↓
                                                         (nếu lỗi)
                                                         FAILED → Swarm tạo Task mới
```

```bash
# Xem tasks của service
docker service ps my-web

# Output mẫu:
# ID        NAME       IMAGE    NODE      DESIRED STATE  CURRENT STATE
# abc123    my-web.1   nginx    worker1   Running        Running 2 hours ago
# def456    my-web.2   nginx    worker2   Running        Running 2 hours ago
# ghi789    my-web.3   nginx    manager   Running        Running 2 hours ago
```

---

## 3.4 Replicated Services vs Global Services

### 3.4.1 Replicated Service (mặc định)

Chạy **số lượng bản sao chỉ định** trên các node tùy ý trong cluster.

```bash
# Tạo service với 3 replicas
docker service create \
  --name web \
  --replicas 3 \
  --mode replicated \   # đây là mặc định
  nginx
```

```
Cluster (3 workers):
  Worker1: [Task] [Task]
  Worker2: [Task]
  Worker3: (không có task)
  
  Tổng: 3 tasks = 3 replicas ✅
```

**Khi nào dùng:** Web servers, API services, workers – bất kỳ service nào cần số bản sao cố định.

---

### 3.4.2 Global Service

Chạy **đúng 1 bản sao trên mỗi node** trong cluster. Khi có node mới tham gia → tự động thêm task.

```bash
# Tạo global service
docker service create \
  --name node-exporter \
  --mode global \
  prom/node-exporter
```

```
Cluster (3 workers):
  Worker1: [Task]
  Worker2: [Task]
  Worker3: [Task]
  Manager: [Task]
  
  Tổng: 4 tasks (1 per node) ✅
```

**Khi nào dùng:** Monitoring agents (Prometheus Node Exporter), logging agents (Fluentd), security scanners – các service cần chạy trên **mọi** node.

---

### 3.4.3 So sánh

| Tiêu chí | Replicated | Global |
|----------|-----------|--------|
| Số lượng task | Chỉ định (N replicas) | 1 per node |
| Thêm node mới | Không thay đổi | Tự thêm task |
| Scale thủ công | ✅ Có | ❌ Không (tự động) |
| Use case | Web, API, workers | Agents, collectors |

---

## 3.5 Placement Constraints

Kiểm soát **node nào** được phép chạy task.

```bash
# Chỉ chạy trên worker nodes (không chạy trên manager)
docker service create \
  --name web \
  --replicas 3 \
  --constraint "node.role==worker" \
  nginx

# Chỉ chạy trên node có label region=us-east
docker service create \
  --name api \
  --replicas 2 \
  --constraint "node.labels.region==us-east" \
  myapi:latest
```

Trong `docker-compose.yml`:
```yaml
deploy:
  replicas: 3
  placement:
    constraints:
      - node.role == worker
      - node.labels.region == us-east
```

---

## 3.6 Tổng kết: Mối quan hệ

```
STACK (docker stack deploy)
 └── SERVICE (docker service create)
      └── TASK × N (1 task = 1 container trên 1 node)
           └── CONTAINER (docker container)
```
