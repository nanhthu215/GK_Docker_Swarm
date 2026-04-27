# 🐳 Docker Swarm & Advanced Deployment

> **Môn học:** Triển khai ứng dụng  
> **Đề tài:** Tìm hiểu về Docker Swarm và Triển khai nâng cao

---

## 📚 Nội dung

| #  | Chủ đề |
|----|--------|
| 1  | [Giới thiệu Docker Swarm & Container Orchestration](docs/01-introduction.md) |
| 2  | [Kiến trúc Swarm (Swarm Architecture)](docs/02-architecture.md) |
| 3  | [Services và Tasks](docs/03-services-tasks.md) |
| 4  | [Scaling & Load Balancing](docs/04-scaling-load-balancing.md) |
| 5  | [Deploying a Stack](docs/05-deploy-stack.md) |
| 6  | [Rolling Updates & Rollbacks](docs/06-rolling-updates.md) |
| 7  | [High Availability & Fault Tolerance](docs/07-ha-fault-tolerance.md) |

---

## 🛠 Bài tập thực hành

| #  | Bài tập | Thư mục |
|----|---------|---------|
| 1  | Web service 3 replicas (Nginx) | [`labs/lab1-nginx-replicas/`](labs/lab1-nginx-replicas/) |
| 2  | Load Balancing demo (Node.js API) | [`labs/lab2-load-balancing/`](labs/lab2-load-balancing/) |
| 3  | Rolling Update demo | [`labs/lab3-rolling-update/`](labs/lab3-rolling-update/) |

---

## ⚡ Quick Start

```bash
# 1. Khởi tạo Swarm (single-node, chạy local)
docker swarm init

# 2. Triển khai Lab 1 – Nginx 3 replicas
docker stack deploy -c labs/lab1-nginx-replicas/docker-compose.yml webstack

# 3. Kiểm tra trạng thái
docker stack ps webstack
docker service ls
```

---

## 📂 Cấu trúc dự án

```
GK/
├── README.md
├── docs/                        # Tài liệu lý thuyết từng chủ đề
│   ├── 01-introduction.md
│   ├── 02-architecture.md
│   ├── 03-services-tasks.md
│   ├── 04-scaling-load-balancing.md
│   ├── 05-deploy-stack.md
│   ├── 06-rolling-updates.md
│   └── 07-ha-fault-tolerance.md
└── labs/                        # Bài tập thực hành
    ├── lab1-nginx-replicas/
    │   └── docker-compose.yml
    ├── lab2-load-balancing/
    │   ├── app/
    │   │   ├── server.js
    │   │   ├── package.json
    │   │   └── Dockerfile
    │   └── docker-compose.yml
    └── lab3-rolling-update/
        └── docker-compose.yml
```
