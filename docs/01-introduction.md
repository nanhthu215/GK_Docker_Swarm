# 1. Giới thiệu Docker Swarm & Container Orchestration

## 1.1 Container Orchestration là gì?

**Container Orchestration** (điều phối container) là quá trình **tự động hóa** việc triển khai, quản lý, mở rộng và kết nối mạng cho các container trong môi trường sản xuất.

Khi số lượng container tăng lên (hàng chục → hàng trăm), việc quản lý thủ công trở nên:
- ❌ Không thể mở rộng (không scalable)
- ❌ Dễ xảy ra lỗi con người
- ❌ Không có khả năng tự phục hồi (self-healing)
- ❌ Khó cân bằng tải

**Container Orchestration giải quyết:**

| Vấn đề | Giải pháp |
|--------|-----------|
| Container bị chết | Tự động khởi động lại |
| Lưu lượng tăng cao | Tự động scale thêm bản sao |
| Cập nhật phiên bản | Rolling update không gián đoạn |
| Phân phối tải | Load balancing tự động |
| Quản lý tài nguyên | Giới hạn CPU/RAM theo service |

---

## 1.2 Docker Swarm là gì?

**Docker Swarm** là công cụ điều phối container **tích hợp sẵn** trong Docker Engine. Nó biến nhiều máy chủ Docker (hosts) thành một **cụm (cluster) thống nhất** gọi là *Swarm*.

```
┌─────────────────────────────────────────────┐
│              DOCKER SWARM CLUSTER           │
│                                             │
│  ┌──────────────┐    ┌──────────────┐       │
│  │  Manager Node │    │  Worker Node │       │
│  │  (Điều phối)  │◄──►│  (Thực thi) │       │
│  └──────────────┘    └──────────────┘       │
│                                             │
│  ┌──────────────┐    ┌──────────────┐       │
│  │  Worker Node │    │  Worker Node │       │
│  │  (Thực thi)  │    │  (Thực thi) │       │
│  └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────┘
```

### Tính năng nổi bật:
- ✅ **Tích hợp Docker Engine** – không cần cài thêm tool
- ✅ **Khai báo declarative** – mô tả trạng thái mong muốn, Swarm tự thực hiện
- ✅ **TLS mã hóa** tự động giữa các node
- ✅ **Distributed state** với Raft consensus
- ✅ **Rolling updates** không downtime

---

## 1.3 So sánh: Docker Compose (single-host) vs Docker Swarm (multi-host)

| Tiêu chí | Docker Compose | Docker Swarm |
|----------|---------------|--------------|
| **Phạm vi** | 1 máy (single-host) | Nhiều máy (multi-host cluster) |
| **Khả năng mở rộng** | Giới hạn tài nguyên 1 máy | Scale ngang qua nhiều máy |
| **Tự phục hồi** | ❌ Không | ✅ Có (desired state reconciliation) |
| **Load balancing** | Chỉ trong 1 host | Ingress Routing Mesh toàn cluster |
| **Rolling update** | ❌ Không tích hợp | ✅ Có sẵn |
| **Độ phức tạp** | Đơn giản | Trung bình |
| **Use case** | Dev / Testing | Production / Staging |

### Minh họa:

```
Docker Compose (single-host):          Docker Swarm (multi-host):

┌─────────────── Host ───────────────┐  ┌─── Host A ───┐  ┌─── Host B ───┐
│  Container 1 │ Container 2         │  │  Container 1 │  │  Container 2 │
│  Container 3 │ Container 4         │  └──────────────┘  └──────────────┘
└────────────────────────────────────┘                ▲
         ❌ Nếu Host chết → mất tất cả              ✅ Swarm tự tái phân bổ
```

---

## 1.4 Use-case thực tế

| Use-case | Mô tả |
|----------|-------|
| **Web Application** | Chạy 5 bản sao web server, tự cân bằng tải |
| **Microservices** | Điều phối hàng chục service độc lập |
| **CI/CD Pipeline** | Deploy tự động khi có code mới |
| **Zero-downtime deploy** | Cập nhật app mà không làm gián đoạn user |
| **Auto-scaling** | Tăng số replica khi traffic tăng |
| **High Availability API** | API luôn online dù 1 node bị lỗi |

---

## 1.5 Docker Swarm vs Kubernetes

| Tiêu chí | Docker Swarm | Kubernetes |
|----------|-------------|------------|
| **Độ phức tạp** | Thấp | Cao |
| **Tích hợp** | Docker Engine | Cần cài riêng |
| **Hệ sinh thái** | Nhỏ hơn | Rất lớn |
| **Auto-scaling** | Thủ công | Tự động (HPA) |
| **Phù hợp** | Team nhỏ, dự án vừa | Enterprise, microservices lớn |

> 💡 **Docker Swarm** là lựa chọn tốt khi team đã quen Docker và cần orchestration nhanh, đơn giản mà không muốn overhead của Kubernetes.
