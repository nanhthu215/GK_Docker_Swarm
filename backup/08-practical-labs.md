# 8. Thực hành ứng dụng: Các bài tập triển khai Docker Swarm

Để củng cố nền tảng lý thuyết đã phân tích trong các chương trước, chương này trình bày chi tiết ba bài tập thực hành mang tính thực tiễn cao (các mã nguồn tương ứng được lưu trữ tại thư mục `labs/` của dự án). Mỗi bài tập bao gồm mô tả yêu cầu, tệp cấu hình mã nguồn và giải thích logic chuyên sâu cùng các bước thực thi tuần tự (step-by-step).

---

## 8.1. Bài tập 1: Khởi tạo Swarm và triển khai Stack cơ bản (Thư mục: `labs/lab1-nginx-replicas`)

Mô tả bài tập: 
Xây dựng tệp cấu hình định nghĩa một dịch vụ máy chủ web Nginx, thiết lập hệ thống vận hành với 3 bản sao (replicas). Tiếp theo, tiến hành khởi tạo cụm Docker Swarm ở chế độ nút đơn (Single Node) trên thiết bị cục bộ, triển khai ứng dụng lên cụm và sử dụng các công cụ giám sát để xác minh sự tồn tại của 3 tác vụ (Task).

Logic giải quyết vấn đề:
1. Xây dựng tệp cấu hình khai báo số lượng bản sao, giới hạn tài nguyên nhằm thiết lập "trạng thái mong muốn".
2. Chuyển đổi môi trường Docker độc lập hiện tại thành Manager Node.
3. Kích hoạt lệnh triển khai theo dạng Stack để tự động hóa khâu tạo mạng nội bộ (`webnet`) và dịch vụ.
4. Truy xuất danh sách tác vụ để xác nhận tính chính xác của tiến trình.

Tệp cấu hình (`docker-compose.yml`):
```yaml
# =============================================================================
# Lab 1: Docker Swarm Stack – Nginx với 3 Replicas
# =============================================================================

version: "3.8"

services:
  nginx:
    image: nginx:1.24-alpine
    ports:
      - "80:80"
    networks:
      - webnet
    deploy:
      replicas: 3
      mode: replicated
      resources:
        limits:
          cpus: "0.50"
          memory: 64M
        reservations:
          cpus: "0.25"
          memory: 32M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        monitor: 30s
        max_failure_ratio: 0
        order: stop-first
      rollback_config:
        parallelism: 1
        delay: 5s
        failure_action: pause
        monitor: 20s

networks:
  webnet:
    driver: overlay
    attachable: true
```
Giải thích cấu trúc: 
Cổng mạng 80 của máy chủ vật lý được ánh xạ trực tiếp với cổng 80 của Nginx. Khối `deploy` ra chỉ thị hệ thống phải duy trì chính xác 3 bản sao hoạt động song song, giới hạn khắt khe việc sử dụng bộ xử lý (tối đa 50% của 1 lõi) và cấp cấu hình tự động khởi động lại nếu ứng dụng gặp sự cố.

Các bước thực thi (Step-by-step):

Bước 1: Khởi tạo kiến trúc Swarm:
```bash
docker swarm init
```
*Giải thích:* Lệnh này biến Docker Engine độc lập thành Swarm Manager, sẵn sàng tiếp nhận các tệp cấu hình dạng Stack.

Bước 2: Triển khai Stack ứng dụng:
```bash
cd labs/lab1-nginx-replicas
docker stack deploy -c docker-compose.yml webstack
```
*Giải thích:* Hệ thống khởi tạo một Stack mang tên `webstack`, tạo mạng overlay `webnet` và khởi chạy 3 bản sao của dịch vụ `nginx`.

Bước 3: Xác minh danh sách tác vụ đang vận hành:
```bash
docker service ps webstack_nginx
```
*Kết quả kỳ vọng (Minh chứng trực quan 3 Task Running):*
Giao diện dòng lệnh sẽ xuất thông tin hiển thị 3 tiến trình riêng biệt đạt trạng thái "Running" được phân bổ trên các node:
```text
ID             NAME               IMAGE               NODE      DESIRED STATE   CURRENT STATE            ERROR     PORTS
z1y2x3w4v5u6   webstack_nginx.1   nginx:1.24-alpine   worker1   Running         Running 12 seconds ago             
p9o8i7u6y5t4   webstack_nginx.2   nginx:1.24-alpine   worker2   Running         Running 12 seconds ago             
m1n2b3v4c5x6   webstack_nginx.3   nginx:1.24-alpine   worker3   Running         Running 12 seconds ago             
```

---

## 8.2. Bài tập 2: Minh chứng cơ chế Load Balancing (Thư mục: `labs/lab2-load-balancing`)

Mô tả bài tập: 
Triển khai một ứng dụng giao diện lập trình ứng dụng (API) tự viết (mã nguồn đặt tại thư mục `./app`). Ứng dụng này có chức năng đặc thù: Phản hồi lại tên định danh (Hostname) của chính container đang xử lý yêu cầu. Cấu hình dịch vụ vận hành 5 bản sao. Thực hiện gửi liên tục 10 yêu cầu truy cập đến cổng đã mở để minh chứng trực quan khả năng phân phối tải luân phiên (Round-Robin) của mạng lưới Ingress.

Logic giải quyết vấn đề:
Tiến hành đóng gói (Build) ứng dụng API thành một gói phần mềm cục bộ mang tên `swarm-lb-demo:1.0`. Khi tính năng Routing Mesh hoạt động, các yêu cầu gửi vào cùng cổng mạng (3000) sẽ được bộ định tuyến nội tại phân phát đến 1 trong 5 bản sao. Việc thu được các kết quả Hostname khác nhau là bằng chứng xác thực tuyệt đối cho cơ chế cân bằng tải.

Tệp mã nguồn ứng dụng (`app/server.js`):
```javascript
const http = require("http");
const os = require("os");

const PORT = process.env.PORT || 3000;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "unknown";
}

let requestCount = 0;
const startTime = new Date().toISOString();

const server = http.createServer((req, res) => {
  requestCount++;
  const hostname = os.hostname();
  const ip = getLocalIP();
  const timestamp = new Date().toISOString();

  if (req.url === "/" || req.url === "") {
    const response = {
      hostname: hostname,
      container_ip: ip,
      timestamp: timestamp,
      request_count: requestCount,
      message: `Hello from container: ${hostname}`,
    };

    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Container-Hostname": hostname,
      "X-Container-IP": ip,
    });
    res.end(JSON.stringify(response, null, 2));
    console.log(`[${timestamp}] GET / → Container: ${hostname} (IP: ${ip}) | Total requests: ${requestCount}`);
  }
  else if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", hostname }));
  }
  else if (req.url === "/info") {
    const info = {
      hostname: hostname,
      container_ip: ip,
      platform: os.platform(),
      arch: os.arch(),
      node_version: process.version,
      uptime_seconds: Math.floor(process.uptime()),
      started_at: startTime,
      total_requests: requestCount,
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(info, null, 2));
  }
  else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found", path: req.url }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Container Hostname: ${os.hostname()}`);
  console.log(`🌐 Container IP: ${getLocalIP()}`);
  console.log(`⏰ Started at: ${startTime}`);
});
```

Tệp cấu hình phụ thuộc (`app/package.json`):
```json
{
  "name": "swarm-lb-demo",
  "version": "1.0.0",
  "description": "Load Balancing Demo for Docker Swarm",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": ">=18"
  }
}
```

Tệp thiết kế môi trường (`app/Dockerfile`):
```dockerfile
# Dùng Node.js 18 Alpine (nhỏ gọn, bảo mật)
FROM node:18-alpine

LABEL maintainer="Docker Swarm Lab"
LABEL description="Load Balancing Demo – trả về hostname của container"
LABEL version="1.0"

WORKDIR /app

# Copy package.json trước (tận dụng Docker layer cache)
COPY package.json ./

# Cài dependencies (không có dev dependencies)
RUN npm install --only=production

# Copy source code
COPY server.js ./

EXPOSE 3000

# Health check: kiểm tra server còn sống mỗi 30 giây
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Chạy app với user non-root (bảo mật)
USER node

# Lệnh khởi động
CMD ["node", "server.js"]
```

Tệp cấu hình triển khai (`docker-compose.yml`):
```yaml
version: "3.8"

services:
  api:
    image: swarm-lb-demo:1.0
    ports:
      - "3000:3000"
    networks:
      - lb-network
    environment:
      - PORT=3000
      - NODE_ENV=production
    deploy:
      replicas: 5
      mode: replicated
      resources:
        limits:
          cpus: "0.25"
          memory: 64M
        reservations:
          cpus: "0.10"
          memory: 32M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 60s
      update_config:
        parallelism: 2
        delay: 10s
        failure_action: rollback
        monitor: 30s
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 5s
        failure_action: pause

networks:
  lb-network:
    driver: overlay
    attachable: true
```

Các bước thực thi (Step-by-step):

Bước 1: Đóng gói mã nguồn ứng dụng:
```bash
cd labs/lab2-load-balancing
docker build -t swarm-lb-demo:1.0 ./app
```

Bước 2: Triển khai cấu hình lên hệ thống:
```bash
docker stack deploy -c docker-compose.yml lbstack
```

Bước 3: Tự động hóa gửi 10 yêu cầu truy cập và lọc thông tin Hostname:
*Trên hệ điều hành Linux/macOS (hoặc Git Bash):*
```bash
for i in $(seq 1 10); do curl -s http://localhost:3000 | grep hostname; done
```
*Trên hệ điều hành Windows (PowerShell):*
```powershell
1..10 | ForEach-Object { (Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing).Content | Select-String "hostname" }
```

*Kết quả kỳ vọng (Minh chứng Ingress Load Balancing):*
Hệ thống sẽ in ra màn hình 10 chuỗi Hostname có giá trị mã băm (hash) hoàn toàn khác nhau. Hiện tượng này cung cấp minh chứng rõ nét Ingress Routing Mesh đang âm thầm thu thập toàn bộ lưu lượng tại cổng 3000 và chia đều cho 5 tiến trình xử lý theo thuật toán điều phối thông minh (Round-Robin):
```text
{"hostname":"c1f2a3b4c5d6", "request_count":1}
{"hostname":"m9n8b7v6c5x4", "request_count":1}
{"hostname":"l1k2j3h4g5f6", "request_count":1}
{"hostname":"q1w2e3r4t5y6", "request_count":1}
{"hostname":"p0o9i8u7y6t5", "request_count":1}
{"hostname":"c1f2a3b4c5d6", "request_count":2}
{"hostname":"m9n8b7v6c5x4", "request_count":2}
...
```

---

## 8.3. Bài tập 3: Thực thi quy trình Cập nhật cuốn chiếu (Thư mục: `labs/lab3-rolling-update`)

Mô tả bài tập: 
Tiến hành nâng cấp trực tiếp phiên bản phần mềm cho dịch vụ Nginx từ phiên bản `1.23` lên `1.24-alpine`. Sử dụng lệnh điều khiển để kích hoạt quá trình cập nhật và giám sát cách hệ thống Swarm tự động thu hồi/khởi tạo tuần tự từng tác vụ nhằm đảm bảo duy trì tuyệt đối năng lực phục vụ (Zero-downtime).

Logic giải quyết vấn đề:
Tạo một Stack mới mang tên `rollstack` với phiên bản ban đầu là `1.23`. Can thiệp cấu hình thời gian trễ cập nhật (`update_config: delay: 15s`) để làm chậm tiến trình một cách có chủ đích. Thao tác này giúp người quan sát có thể nhìn rõ vòng đời thực thi của tác vụ: ngắt tiến trình cũ (Shutdown) và song song khởi động tiến trình mới (Starting).

Tệp cấu hình (`docker-compose.yml`):
```yaml
version: "3.8"
services:
  web:
    image: nginx:1.23-alpine
    ports:
      - "80:80"
    networks:
      - rollnet
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    deploy:
      replicas: 3
      mode: replicated
      resources:
        limits:
          cpus: "0.30"
          memory: 64M
        reservations:
          cpus: "0.10"
          memory: 32M
      update_config:
        parallelism: 1
        delay: 15s
        failure_action: rollback
        monitor: 30s
        max_failure_ratio: 0
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 10s
        failure_action: pause
        monitor: 20s
        max_failure_ratio: 0
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s

networks:
  rollnet:
    driver: overlay
    attachable: true
```

Các bước thực thi (Step-by-step):

Bước 1: Triển khai phiên bản ban đầu (1.23):
```bash
cd labs/lab3-rolling-update
docker stack deploy -c docker-compose.yml rollstack
```

Bước 2: Ban hành chỉ thị nâng cấp phần mềm:
```bash
docker service update --image nginx:1.24-alpine rollstack_web
```
*Giải thích kỹ thuật:* Lệnh này can thiệp trực tiếp vào cấu hình đang vận hành, chỉ thị tải và sử dụng Image phiên bản 1.24-alpine.

Bước 3: Giám sát toàn trình vòng đời cập nhật (Mở một cửa sổ Terminal thứ 2):
```bash
watch docker service ps rollstack_web
```

Bước 4: Kiểm chứng tính sẵn sàng (Zero-downtime) (Mở một cửa sổ Terminal thứ 3):
```bash
while true; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:80; sleep 1; done
```
*(Lệnh này liên tục gọi tới cổng 80 và chỉ in ra mã trạng thái HTTP).*

*Kết quả kỳ vọng (Minh chứng Zero-Downtime tại Màn hình 3):*
Hệ thống liên tục trả về mã `200` (Thành công), không hề xuất hiện lỗi `502 Bad Gateway` hay `503 Service Unavailable`, minh chứng dịch vụ chưa từng bị gián đoạn dù chỉ một giây:
```text
200
200
200
```

*Kết quả kỳ vọng (Minh chứng cuốn chiếu tại Màn hình 2):*
Quản trị viên nhìn thấy bản sao số 1 chuyển trạng thái thành `Shutdown`, và một bản sao mới (dùng bản 1.24-alpine) chuyển sang `Starting`. Sau 15 giây chờ đợi (delay), chu trình này lặp lại với bản sao 2 và 3, chứng minh hoàn hảo cho cơ chế cập nhật an toàn của Swarm:
```text
ID             NAME            IMAGE               NODE      DESIRED STATE   CURRENT STATE            
a1b2c3d4e5f6   rollstack_web.1 nginx:1.24-alpine   worker1   Running         Starting 2 seconds ago              
q1w2e3r4t5y6   \_ rollstack_web.1 nginx:1.23       worker1   Shutdown        Shutdown 3 seconds ago              
z1x2c3v4b5n6   rollstack_web.2 nginx:1.23          worker2   Running         Running 5 days ago                  
m1n2b3v4c5x6   rollstack_web.3 nginx:1.23          worker3   Running         Running 5 days ago                  
```

---

## 8.4. Bài tập 4: Kiểm chứng cơ chế tự phục hồi (Self-Healing)

Mô tả bài tập:
Kiểm chứng khả năng tự động khôi phục trạng thái (Desired State Reconciliation) của Docker Swarm khi một tiến trình ứng dụng (Task) bất ngờ bị sập (Crash) hoặc bị xóa ngoài ý muốn.

Logic giải quyết vấn đề:
Sử dụng một Stack Nginx chuyên biệt mang tên `healstack` với cấu hình đặt sẵn 3 bản sao. Quản trị viên sẽ cố tình "phá hoại" bằng cách ra lệnh tiêu diệt (kill) trực tiếp một tiến trình container đang chạy. Ngay lập tức, hệ thống Swarm sẽ phát hiện sự thiếu hụt so với trạng thái mong muốn (`replicas: 3`) và tự động tạo ra một Task hoàn toàn mới để bù đắp, duy trì tính sẵn sàng cao.

Tệp cấu hình (`docker-compose.yml`):
```yaml
version: "3.8"

services:
  web:
    image: nginx:1.24-alpine
    ports:
      - "8081:80"
    networks:
      - healnet
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    deploy:
      replicas: 3
      mode: replicated
      resources:
        limits:
          cpus: "0.30"
          memory: 64M
        reservations:
          cpus: "0.10"
          memory: 32M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 5
        window: 60s

networks:
  healnet:
    driver: overlay
    attachable: true
```

Các bước thực thi (Step-by-step):

Bước 0: Triển khai hệ thống tự phục hồi:
```bash
cd labs/lab4-self-healing
docker stack deploy -c docker-compose.yml healstack
```

Bước 1: Liệt kê danh sách các tiến trình hiện tại:
```bash
docker service ps healstack_web
```
*Ghi nhận lại ID của một Task đang ở trạng thái Running trên máy chủ hiện hành (Ví dụ: `z1y2x3w4v5u6`).*

Bước 2: Tìm kiếm Container thực tế tương ứng:
```bash
docker ps | grep healstack_web
```
*Ghi nhận lại mã Container ID do Docker Engine quản lý (Ví dụ: `a1b2c3d4e5f6`).*

Bước 3: Cố tình tiêu diệt tiến trình Container:
```bash
docker rm -f <Container ID>
```
*Giải thích:* Lệnh cưỡng chế xóa bỏ container, mô phỏng tình huống ứng dụng bị crash đột ngột hoặc lỗi phần cứng.

Bước 4: Nhanh chóng giám sát lại hệ thống Swarm:
```bash
watch docker service ps healstack_web
```

*Kết quả kỳ vọng (Minh chứng Self-Healing):*
Chỉ vài giây sau khi thao tác phá hoại diễn ra, hệ thống tự động sinh ra một Task mới toanh để thay thế cho Task vừa chết:
```text
ID             NAME                   IMAGE               NODE      DESIRED STATE   CURRENT STATE            
j9k8l7m6n5b4   healstack_web.1       nginx:1.24-alpine   worker1   Running         Starting 1 seconds ago              
z1y2x3w4v5u6   \_ healstack_web.1    nginx:1.24-alpine   worker1   Shutdown        Failed 3 seconds ago              
p9o8i7u6y5t4   healstack_web.2       nginx:1.24-alpine   worker2   Running         Running 2 hours ago             
m1n2b3v4c5x6   healstack_web.3       nginx:1.24-alpine   worker3   Running         Running 2 hours ago             
```
Kết quả trên chứng minh đanh thép: Swarm phát hiện Task 1 bị lỗi (`Failed 3 seconds ago`), nên lập tức loại bỏ nó (`Shutdown`) và cấp phát một Task mới hoàn toàn để thay thế (`Starting 1 seconds ago`) nhằm bảo vệ vẹn toàn con số 3 bản sao đã được định nghĩa.
