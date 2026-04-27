# 2. Kiến trúc Docker Swarm (Swarm Architecture)

## 2.1 Tổng quan kiến trúc

Một **Swarm cluster** bao gồm nhiều máy chủ (nodes) Docker chạy ở hai chế độ:

```
                    ┌─────────────────────────────────────────────┐
                    │              DOCKER SWARM CLUSTER            │
                    │                                             │
  External          │  ┌──────────────────────────────────────┐  │
  Requests ────────►│  │          MANAGER NODES               │  │
                    │  │                                      │  │
                    │  │  ┌──────────┐  ┌──────────┐         │  │
                    │  │  │ Manager1 │  │ Manager2 │  ...    │  │
                    │  │  │ (Leader) │  │(Follower)│         │  │
                    │  │  └────┬─────┘  └──────────┘         │  │
                    │  │       │  Raft Consensus              │  │
                    │  └───────┼──────────────────────────────┘  │
                    │          │ Dispatch Tasks                   │
                    │  ┌───────▼──────────────────────────────┐  │
                    │  │          WORKER NODES                │  │
                    │  │                                      │  │
                    │  │  ┌──────────┐  ┌──────────┐         │  │
                    │  │  │ Worker1  │  │ Worker2  │  ...    │  │
                    │  │  │[Task][T] │  │[Task][T] │         │  │
                    │  │  └──────────┘  └──────────┘         │  │
                    │  └──────────────────────────────────────┘  │
                    └─────────────────────────────────────────────┘
```

---

## 2.2 Manager Node

**Manager Node** là trung tâm điều khiển của Swarm. Chịu trách nhiệm:

### Chức năng chính:
| Chức năng | Mô tả |
|-----------|-------|
| **Cluster state management** | Lưu trữ và duy trì trạng thái toàn bộ cluster |
| **Task scheduling** | Phân công tasks cho Worker nodes |
| **API endpoint** | Nhận lệnh từ `docker` CLI |
| **Service orchestration** | Tạo, cập nhật, xóa services |
| **Leader election** | Bầu chọn Manager chính (Leader) qua Raft |

### Số lượng Manager khuyến nghị:

| Số Manager | Khả năng chịu lỗi | Quorum cần thiết |
|------------|-------------------|------------------|
| 1 | 0 node | 1 |
| 3 | 1 node | 2 |
| 5 | 2 nodes | 3 |
| 7 | 3 nodes | 4 |

> ⚠️ **Quorum** = `(N/2) + 1` – số tối thiểu Manager cần đồng ý để cluster hoạt động.

```bash
# Xem danh sách nodes và role
docker node ls

# Promote worker thành manager
docker node promote <node-id>

# Demote manager về worker
docker node demote <node-id>
```

---

## 2.3 Worker Node

**Worker Node** là nơi thực thi các container (tasks). Đặc điểm:

- ✅ Nhận tasks được giao từ Manager
- ✅ Báo cáo trạng thái task về Manager
- ❌ Không tham gia vào quyết định cluster (không có Raft)
- ❌ Không thể chạy lệnh `docker service` trực tiếp

```bash
# Lấy token để thêm worker
docker swarm join-token worker

# Worker node chạy lệnh này để tham gia
docker swarm join --token SWMTKN-1-xxxx <manager-ip>:2377

# Kiểm tra trạng thái node
docker node inspect <node-id> --pretty
```

---

## 2.4 Giao thức Raft Consensus

**Raft** là thuật toán đồng thuận phân tán đảm bảo tất cả Manager nodes đều có **cùng trạng thái** (consistent state).

### Ý tưởng cơ bản:

```
Bình thường:
  Manager1 (Leader) ──write──► Manager2 (Follower)
                    ──write──► Manager3 (Follower)
                    Khi ≥ quorum đồng ý → commit

Khi Leader chết:
  Manager2, Manager3 bầu chọn Leader mới
  (cần ≥ quorum nodes còn sống)
```

### 3 vai trò trong Raft:

| Vai trò | Mô tả |
|---------|-------|
| **Leader** | Xử lý tất cả write requests; gửi log cho followers |
| **Follower** | Nhận và lưu log từ Leader |
| **Candidate** | Trạng thái tạm thời khi bầu chọn Leader mới |

### Ví dụ với 3 Manager:

```
Normal state:
  [M1-Leader] ──heartbeat──► [M2-Follower]
              ──heartbeat──► [M3-Follower]

M1 crashes:
  [M2] timeout → trở thành Candidate → bầu chọn
  [M3] vote cho M2 → M2 trở thành Leader mới
  Cluster vẫn hoạt động! ✅
```

> 💡 Đây là lý do tại sao số Manager nên là **số lẻ** (1, 3, 5, 7).

---

## 2.5 Các port quan trọng

| Port | Protocol | Mục đích |
|------|----------|----------|
| **2377** | TCP | Swarm management (giao tiếp cluster) |
| **7946** | TCP/UDP | Node discovery (giao tiếp giữa nodes) |
| **4789** | UDP | Overlay network (VXLAN traffic) |

```bash
# Mở firewall (Linux)
ufw allow 2377/tcp
ufw allow 7946/tcp
ufw allow 7946/udp
ufw allow 4789/udp
```

---

## 2.6 Overlay Network

Docker Swarm sử dụng **Overlay Network** để các container trên các node khác nhau giao tiếp với nhau.

```
Node A:                     Node B:
[Container 1] ─────────── [Container 2]
  10.0.0.2                   10.0.0.3
       │                         │
   ┌───┴─────────────────────────┴───┐
   │      Overlay Network (VXLAN)    │
   │         10.0.0.0/24            │
   └─────────────────────────────────┘
```

```bash
# Tạo overlay network
docker network create --driver overlay my-network

# Xem danh sách networks
docker network ls
```
