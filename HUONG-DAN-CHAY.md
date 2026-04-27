# 🚀 Hướng Dẫn Chạy Chi Tiết – Docker Swarm Labs

> **Hệ điều hành:** Windows  
> **Yêu cầu:** Docker Desktop đã được cài đặt và đang chạy

---

## ✅ Kiểm tra trước khi bắt đầu

Mở **PowerShell** hoặc **Command Prompt**, chạy lệnh:

```powershell
docker --version
# Docker version 24.x.x, build ...  ← phải có dòng này

docker info
# Phải thấy "Server: Docker Engine" và không có lỗi
```

> ⚠️ Nếu Docker chưa chạy → mở **Docker Desktop** và chờ đến khi icon ở taskbar chuyển sang màu xanh.

---

## 📁 Di chuyển vào thư mục dự án

```powershell
cd "C:\Users\PC1\Documents\Downloads\GK"
```

---

---

# 🔵 LAB 1 – Nginx 3 Replicas

## Bước 1: Khởi tạo Docker Swarm

```powershell
docker swarm init
```

**Kết quả mong đợi:**
```
Swarm initialized: current node (abc123xyz) is now a manager.

To add a worker to this swarm, run the following command:
    docker swarm join --token SWMTKN-1-... 192.168.65.3:2377

To add a manager to this swarm, run 'docker swarm join-token manager' and follow the instructions.
```

> ✅ Thấy dòng "Swarm initialized" là thành công!  
> ⚠️ Nếu báo lỗi "This node is already part of a swarm" → Swarm đã init rồi, bỏ qua bước này.

## Bước 2: Kiểm tra Swarm đang hoạt động

```powershell
docker node ls
```

**Kết quả mong đợi:**
```
ID                            HOSTNAME    STATUS    AVAILABILITY   MANAGER STATUS
abc123xyz *   DESKTOP-XXXXX   Ready     Active         Leader
```

> ✅ Thấy STATUS = `Ready` và MANAGER STATUS = `Leader` là OK.

## Bước 3: Di chuyển vào thư mục Lab 1

```powershell
cd "C:\Users\PC1\Documents\Downloads\GK\labs\lab1-nginx-replicas"
```

## Bước 4: Triển khai Stack

```powershell
docker stack deploy -c docker-compose.yml webstack
```

**Kết quả mong đợi:**
```
Creating network webstack_webnet
Creating service webstack_nginx
```

## Bước 5: Chờ các replicas khởi động (30-60 giây)

```powershell
docker service ls
```

**Lúc đầu có thể thấy:**
```
ID             NAME              MODE         REPLICAS   IMAGE
abc123         webstack_nginx    replicated   0/3        nginx:1.24-alpine
```

**Chờ ~30 giây rồi chạy lại, đến khi thấy:**
```
ID             NAME              MODE         REPLICAS   IMAGE
abc123         webstack_nginx    replicated   3/3        nginx:1.24-alpine
```
> ✅ `3/3` = tất cả 3 replicas đã sẵn sàng!

## Bước 6: Xem 3 tasks đang chạy

```powershell
docker service ps webstack_nginx
```

**Kết quả mong đợi:**
```
ID          NAME               IMAGE              NODE            DESIRED STATE   CURRENT STATE
t1abcdef    webstack_nginx.1   nginx:1.24-alpine  DESKTOP-XXXXX   Running         Running 1 minute ago
t2ghijkl    webstack_nginx.2   nginx:1.24-alpine  DESKTOP-XXXXX   Running         Running 1 minute ago
t3mnopqr    webstack_nginx.3   nginx:1.24-alpine  DESKTOP-XXXXX   Running         Running 1 minute ago
```

> ✅ 3 dòng đều `Running` → Lab 1 thành công!

## Bước 7: Kiểm tra truy cập web

Mở trình duyệt và truy cập: **http://localhost:80**

Hoặc dùng PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost:80" -UseBasicParsing | Select-Object StatusCode
# StatusCode: 200  ← thành công!
```

## Dọn dẹp Lab 1

```powershell
docker stack rm webstack
```

---

---

# 🟢 LAB 2 – Load Balancing Demo

> **Mục tiêu:** Gửi 10 requests, quan sát hostname của container thay đổi → chứng minh load balancing.

## Bước 1: Di chuyển vào thư mục Lab 2

```powershell
cd "C:\Users\PC1\Documents\Downloads\GK\labs\lab2-load-balancing"
```

## Bước 2: Build Docker image

```powershell
docker build -t swarm-lb-demo:1.0 ./app
```

**Kết quả mong đợi (quá trình build):**
```
[+] Building 15.2s (9/9) FINISHED
 => [internal] load build definition from Dockerfile
 => [1/4] FROM docker.io/library/node:18-alpine
 => [2/4] WORKDIR /app
 => [3/4] COPY package.json ./
 => [4/4] RUN npm install --only=production
 => exporting to image
 => => naming to docker.io/library/swarm-lb-demo:1.0
```

**Kiểm tra image đã build:**
```powershell
docker images swarm-lb-demo
# REPOSITORY      TAG   IMAGE ID       CREATED         SIZE
# swarm-lb-demo   1.0   abc123xyz      10 seconds ago  135MB
```

## Bước 3: Đảm bảo Swarm đang chạy

```powershell
docker node ls
# Nếu báo lỗi → chạy: docker swarm init
```

## Bước 4: Triển khai Stack (5 replicas)

```powershell
docker stack deploy -c docker-compose.yml lbstack
```

**Kết quả mong đợi:**
```
Creating network lbstack_lb-network
Creating service lbstack_api
```

## Bước 5: Chờ 5 replicas sẵn sàng

```powershell
# Chạy lại đến khi thấy 5/5
docker service ls
```

**Khi sẵn sàng:**
```
NAME          MODE         REPLICAS   IMAGE
lbstack_api   replicated   5/5        swarm-lb-demo:1.0
```

**Xem 5 tasks:**
```powershell
docker service ps lbstack_api
```

## Bước 6: ⭐ Demo Load Balancing – Gửi 10 requests

Chạy lệnh này trong PowerShell:

```powershell
Write-Host "=== DEMO LOAD BALANCING ===" -ForegroundColor Cyan
Write-Host "Gửi 10 requests đến http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

$hostnames = @{}

for ($i = 1; $i -le 10; $i++) {
    $response = Invoke-RestMethod -Uri "http://localhost:3000" -Method Get
    $hostname = $response.hostname
    
    # Đếm số lần mỗi container được gọi
    if ($hostnames.ContainsKey($hostname)) {
        $hostnames[$hostname]++
    } else {
        $hostnames[$hostname] = 1
    }
    
    Write-Host "Request $i  →  Container: $hostname" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== KẾT QUẢ PHÂN PHỐI ===" -ForegroundColor Cyan
foreach ($key in $hostnames.Keys) {
    Write-Host "  Container $key : $($hostnames[$key]) requests" -ForegroundColor Yellow
}
```

**Kết quả mong đợi:**
```
=== DEMO LOAD BALANCING ===
Gửi 10 requests đến http://localhost:3000

Request 1  →  Container: a1b2c3d4e5f6
Request 2  →  Container: b2c3d4e5f6a1
Request 3  →  Container: c3d4e5f6a1b2
Request 4  →  Container: d4e5f6a1b2c3
Request 5  →  Container: e5f6a1b2c3d4
Request 6  →  Container: a1b2c3d4e5f6
Request 7  →  Container: b2c3d4e5f6a1
Request 8  →  Container: c3d4e5f6a1b2
Request 9  →  Container: d4e5f6a1b2c3
Request 10 →  Container: e5f6a1b2c3d4

=== KẾT QUẢ PHÂN PHỐI ===
  Container a1b2c3d4e5f6 : 2 requests
  Container b2c3d4e5f6a1 : 2 requests
  Container c3d4e5f6a1b2 : 2 requests
  Container d4e5f6a1b2c3 : 2 requests
  Container e5f6a1b2c3d4 : 2 requests
```

> ✅ **5 container khác nhau, mỗi cái nhận 2 requests → Load Balancing hoạt động!**

**Hoặc thử trình duyệt:** Mở http://localhost:3000 và nhấn F5 nhiều lần → thấy `hostname` thay đổi.

## Dọn dẹp Lab 2

```powershell
docker stack rm lbstack
```

---

---

# 🟠 LAB 3 – Rolling Update Demo

> **Mục tiêu:** Cập nhật từ `nginx:1.23` → `nginx:1.24`, quan sát service không bị gián đoạn.

## Bước 1: Di chuyển vào thư mục Lab 3

```powershell
cd "C:\Users\PC1\Documents\Downloads\GK\labs\lab3-rolling-update"
```

## Bước 2: Đảm bảo Swarm đang chạy

```powershell
docker node ls
```

## Bước 3: Deploy Stack với nginx:1.23

```powershell
docker stack deploy -c docker-compose.yml rollstack
```

**Chờ 3/3 replicas ready:**
```powershell
docker service ls
# NAME             MODE         REPLICAS   IMAGE
# rollstack_web    replicated   3/3        nginx:1.23
```

## Bước 4: Xác nhận đang chạy nginx:1.23

```powershell
docker service ps rollstack_web
# Tất cả 3 tasks đều IMAGE = nginx:1.23
```

## Bước 5: Mở 2 PowerShell windows riêng

### 🖥️ Window A – Theo dõi tasks (real-time):

```powershell
# Chạy liên tục mỗi 2 giây
while ($true) {
    Clear-Host
    Write-Host "=== Docker Service Tasks ===" -ForegroundColor Cyan
    docker service ps rollstack_web
    Start-Sleep 2
}
```

### 🖥️ Window B – Kiểm tra uptime (không được có lỗi):

```powershell
# Gửi request mỗi giây, hiển thị HTTP status
while ($true) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:80" -UseBasicParsing -TimeoutSec 3
        $time = Get-Date -Format "HH:mm:ss"
        Write-Host "$time → HTTP $($r.StatusCode) ✅" -ForegroundColor Green
    } catch {
        $time = Get-Date -Format "HH:mm:ss"
        Write-Host "$time → LỖI ❌ $_" -ForegroundColor Red
    }
    Start-Sleep 1
}
```

## Bước 6: ⭐ Thực hiện Rolling Update

### 🖥️ Window C (mới) – Chạy lệnh update:

```powershell
cd "C:\Users\PC1\Documents\Downloads\GK\labs\lab3-rolling-update"

docker service update `
    --image nginx:1.24-alpine `
    --update-parallelism 1 `
    --update-delay 15s `
    rollstack_web
```

> ⚠️ Lệnh này sẽ mất khoảng **45-60 giây** để hoàn thành (3 tasks × 15s delay).

## Bước 7: Quan sát (Window A)

Bạn sẽ thấy từng task được cập nhật lần lượt:

```
=== Docker Service Tasks ===
ID          NAME               IMAGE          NODE          STATE
NEW001      rollstack_web.1    nginx:1.24     DESKTOP-XXX   Starting    ← đang update
OLD001      \_ rollstack_web.1 nginx:1.23     DESKTOP-XXX   Shutdown    ← task cũ
OLD002      rollstack_web.2    nginx:1.23     DESKTOP-XXX   Running     ← chưa update
OLD003      rollstack_web.3    nginx:1.23     DESKTOP-XXX   Running     ← chưa update

... 15 giây sau ...

NEW001      rollstack_web.1    nginx:1.24     DESKTOP-XXX   Running   ✅
NEW002      rollstack_web.2    nginx:1.24     DESKTOP-XXX   Starting    ← đang update
OLD002      \_ rollstack_web.2 nginx:1.23     DESKTOP-XXX   Shutdown
OLD003      rollstack_web.3    nginx:1.23     DESKTOP-XXX   Running

... 15 giây sau ...

NEW001      rollstack_web.1    nginx:1.24     DESKTOP-XXX   Running   ✅
NEW002      rollstack_web.2    nginx:1.24     DESKTOP-XXX   Running   ✅
NEW003      rollstack_web.3    nginx:1.24     DESKTOP-XXX   Running   ✅  ← hoàn thành!
```

## Bước 8: Quan sát Window B

Window B phải chỉ hiện `HTTP 200 ✅` trong suốt quá trình → **Zero Downtime!**

```
10:05:01 → HTTP 200 ✅
10:05:02 → HTTP 200 ✅
10:05:03 → HTTP 200 ✅   ← lúc này task 1 đang update
10:05:04 → HTTP 200 ✅   ← vẫn ok nhờ task 2, 3 vẫn chạy
...
```

## Bước 9: Xác nhận version mới

```powershell
docker service inspect rollstack_web --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"
# Output: nginx:1.24-alpine@sha256:...  ← đã cập nhật thành công!
```

## Bước 10 (Tùy chọn): Rollback về nginx:1.23

```powershell
docker service rollback rollstack_web

# Xem quá trình rollback
docker service ps rollstack_web
```

## Dọn dẹp Lab 3

```powershell
# Dừng monitoring loops bằng Ctrl+C trong Window A và B

# Xóa stack
docker stack rm rollstack
```

---

---

# 🧹 Dọn dẹp toàn bộ

Sau khi demo xong, nếu muốn reset hoàn toàn:

```powershell
# Xóa tất cả stacks (nếu còn)
docker stack rm webstack lbstack rollstack

# Chờ 10 giây để containers dừng
Start-Sleep 10

# Rời khỏi Swarm
docker swarm leave --force

# (Tùy chọn) Xóa image đã build
docker rmi swarm-lb-demo:1.0

# Kiểm tra không còn containers nào chạy
docker ps
```

---

# ❓ Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `docker: command not found` | Docker chưa cài | Cài Docker Desktop |
| `Cannot connect to Docker daemon` | Docker Desktop chưa chạy | Mở Docker Desktop |
| `This node is already part of a swarm` | Đã init rồi | Bỏ qua `docker swarm init` |
| `image not found: swarm-lb-demo:1.0` | Chưa build image | Chạy `docker build` trước |
| `port is already allocated` | Port đang bị dùng | Đổi port hoặc dừng ứng dụng đang chiếm port |
| Replicas mãi ở `0/3` | Image lỗi hoặc port conflict | Chạy `docker service ps <name>` để xem lý do |

### Lệnh debug:

```powershell
# Xem lý do task bị lỗi
docker service ps <service-name> --no-trunc

# Xem logs của service
docker service logs <service-name>

# Xem chi tiết service
docker service inspect <service-name> --pretty
```
