# Lab 1 – Web Service với 3 Replicas (Nginx)

## Mục tiêu

1. Viết `docker-compose.yml` cho Nginx với **3 replicas** và đầy đủ cấu hình `deploy`
2. Khởi tạo Docker Swarm trên máy local (single-node)
3. Triển khai stack lên Swarm
4. Dùng CLI để xem danh sách 3 tasks đang chạy

---

## File cấu hình

📄 `docker-compose.yml` – xem bên dưới

---

## Các lệnh thực hành

```bash
# ──────────────────────────────────────────────────
# BƯỚC 1: Khởi tạo Docker Swarm (single-node)
# ──────────────────────────────────────────────────
docker swarm init

# Output mẫu:
# Swarm initialized: current node (xyz123) is now a manager.
# To add a worker: docker swarm join --token SWMTKN-1-... <manager-ip>:2377

# ──────────────────────────────────────────────────
# BƯỚC 2: Kiểm tra Swarm đã hoạt động
# ──────────────────────────────────────────────────
docker node ls
# ID          HOSTNAME    STATUS  AVAILABILITY  MANAGER STATUS
# xyz123 *   my-laptop   Ready   Active        Leader

# ──────────────────────────────────────────────────
# BƯỚC 3: Triển khai Stack lên Swarm
# ──────────────────────────────────────────────────
docker stack deploy -c docker-compose.yml webstack

# Output:
# Creating network webstack_webnet
# Creating service webstack_nginx

# ──────────────────────────────────────────────────
# BƯỚC 4: Kiểm tra service
# ──────────────────────────────────────────────────
docker service ls
# ID           NAME             MODE       REPLICAS  IMAGE
# abc123456    webstack_nginx   replicated 3/3       nginx:1.24-alpine

# ──────────────────────────────────────────────────
# BƯỚC 5: Xem 3 tasks đang chạy
# ──────────────────────────────────────────────────
docker service ps webstack_nginx
# ID        NAME              IMAGE              NODE       DESIRED  CURRENT
# t1abc     webstack_nginx.1  nginx:1.24-alpine  my-laptop  Running  Running
# t2def     webstack_nginx.2  nginx:1.24-alpine  my-laptop  Running  Running
# t3ghi     webstack_nginx.3  nginx:1.24-alpine  my-laptop  Running  Running
# → 3 tasks đang chạy ✅

# ──────────────────────────────────────────────────
# BƯỚC 6: Kiểm tra truy cập
# ──────────────────────────────────────────────────
curl http://localhost:80
# Trả về trang default nginx ✅

# ──────────────────────────────────────────────────
# BƯỚC 7 (tùy chọn): Xem chi tiết stack
# ──────────────────────────────────────────────────
docker stack ps webstack

# ──────────────────────────────────────────────────
# DỌN DẸP
# ──────────────────────────────────────────────────
docker stack rm webstack
# docker swarm leave --force   # (nếu muốn thoát Swarm)
```

---

## Kết quả mong đợi

✅ `docker service ls` hiển thị `3/3` replicas  
✅ `docker service ps webstack_nginx` hiển thị 3 dòng với trạng thái `Running`  
✅ `curl http://localhost:80` trả về trang Nginx  
✅ Không có task nào ở trạng thái `Failed` hoặc `Shutdown`
