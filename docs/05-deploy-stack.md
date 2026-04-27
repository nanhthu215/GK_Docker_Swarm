# 5. Deploying a Stack

## 5.1 Stack là gì?

**Stack** là một tập hợp các **services có liên quan** được định nghĩa và triển khai cùng nhau bằng một tệp `docker-compose.yml`.

```
Stack: my-app
├── Service: web      (nginx, 3 replicas)
├── Service: api      (node.js, 2 replicas)
├── Service: db       (postgres, 1 replica)
└── Service: redis    (redis, 1 replica)
```

### Tại sao dùng Stack?
- ✅ Quản lý nhiều services như một đơn vị
- ✅ Khai báo toàn bộ infrastructure trong 1 file
- ✅ Version control được
- ✅ Tái sử dụng cùng file cho nhiều môi trường

---

## 5.2 Cấu trúc docker-compose.yml cho Swarm

### Cú pháp đầy đủ:

```yaml
version: "3.8"           # Phải là version 3.x cho Swarm

services:
  <service-name>:
    image: <image>:<tag>
    ports:
      - "<host-port>:<container-port>"
    networks:
      - <network-name>
    environment:
      - KEY=VALUE
    volumes:
      - <volume-name>:<container-path>
    
    # ↓ Phần quan trọng nhất cho Swarm ↓
    deploy:
      mode: replicated          # hoặc global
      replicas: 3               # số bản sao (chỉ dùng với replicated)
      
      labels:
        - "app=web"
      
      update_config:            # Cấu hình rolling update
        parallelism: 1          # Cập nhật 1 task mỗi lần
        delay: 10s              # Chờ 10s giữa các batch
        failure_action: rollback
        order: start-first      # start-first hoặc stop-first
      
      rollback_config:          # Cấu hình tự động rollback
        parallelism: 1
        delay: 10s
        failure_action: pause
      
      restart_policy:           # Khi nào restart task
        condition: on-failure   # always | on-failure | none
        delay: 5s               # Chờ trước khi restart
        max_attempts: 3         # Số lần thử tối đa
        window: 120s            # Thời gian đánh giá
      
      resources:                # Giới hạn tài nguyên
        limits:
          cpus: "0.50"
          memory: 128M
        reservations:
          cpus: "0.25"
          memory: 64M
      
      placement:                # Ràng buộc vị trí
        constraints:
          - node.role == worker
        preferences:
          - spread: node.labels.zone

networks:
  <network-name>:
    driver: overlay             # Bắt buộc dùng overlay cho Swarm
    attachable: true

volumes:
  <volume-name>:
    driver: local
```

---

## 5.3 Ví dụ thực tế: Full Stack Application

```yaml
# docker-compose.yml – Production Stack
version: "3.8"

services:
  # ── Web Server ──────────────────────────────────────
  nginx:
    image: nginx:1.24-alpine
    ports:
      - "80:80"
      - "443:443"
    networks:
      - frontend
    volumes:
      - nginx-config:/etc/nginx/conf.d
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        max_attempts: 3
      resources:
        limits:
          cpus: "0.30"
          memory: 64M
      placement:
        constraints:
          - node.role == worker

  # ── API Service ─────────────────────────────────────
  api:
    image: myapp/api:1.0.0
    networks:
      - frontend
      - backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://db:5432/mydb
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 15s
        failure_action: rollback
        order: start-first       # Khởi động bản mới trước
      rollback_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      resources:
        limits:
          cpus: "0.50"
          memory: 256M
        reservations:
          cpus: "0.25"
          memory: 128M
      placement:
        constraints:
          - node.role == worker

  # ── Database ─────────────────────────────────────────
  db:
    image: postgres:15-alpine
    networks:
      - backend
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - db-data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 5
      resources:
        limits:
          cpus: "1.00"
          memory: 512M
        reservations:
          memory: 256M
      placement:
        constraints:
          - node.role == manager  # DB thường gắn với node cố định

# ── Networks ─────────────────────────────────────────────
networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay

# ── Volumes ──────────────────────────────────────────────
volumes:
  db-data:
  nginx-config:

# ── Secrets ──────────────────────────────────────────────
secrets:
  db_password:
    external: true
```

---

## 5.4 Các lệnh quản lý Stack

```bash
# ── Khởi tạo Swarm ──────────────────────────────────────
docker swarm init
# Hoặc chỉ định IP nếu có nhiều interface:
docker swarm init --advertise-addr 192.168.1.100

# ── Triển khai / Cập nhật Stack ─────────────────────────
docker stack deploy -c docker-compose.yml my-stack
# -c: chỉ định file compose
# my-stack: tên stack (sẽ prefix vào tên service)

# ── Kiểm tra Stack ──────────────────────────────────────
docker stack ls                    # Danh sách stacks
docker stack ps my-stack           # Danh sách tasks trong stack
docker stack services my-stack     # Danh sách services trong stack

# ── Xem logs ────────────────────────────────────────────
docker service logs my-stack_api
docker service logs -f my-stack_api  # Follow (real-time)

# ── Scale một service trong stack ───────────────────────
docker service scale my-stack_api=5

# ── Xóa Stack ───────────────────────────────────────────
docker stack rm my-stack
```

---

## 5.5 Khác biệt: docker-compose.yml cho Compose vs Swarm

| Tính năng | Compose | Swarm Stack |
|-----------|---------|-------------|
| `build:` | ✅ Hỗ trợ | ❌ Bị bỏ qua |
| `deploy:` | ❌ Bị bỏ qua | ✅ Hỗ trợ |
| `depends_on:` | ✅ | ❌ Bị bỏ qua |
| Networks | bridge | overlay |
| Secrets | Volume mount | Docker Secrets |

> ⚠️ **Lưu ý:** Khi dùng `docker stack deploy`, phần `build:` trong compose file bị **bỏ qua hoàn toàn**. Image phải được build sẵn và push lên registry trước.
