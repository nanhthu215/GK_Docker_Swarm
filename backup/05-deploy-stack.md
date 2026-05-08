# 5. Triển khai ứng dụng quy mô lớn: Khái niệm Stack và tệp cấu hình

Khi triển khai một ứng dụng hoàn chỉnh trong môi trường sản xuất, hệ thống hiếm khi chỉ bao gồm một dịch vụ đơn lẻ. Thay vào đó, một hệ thống thực tế thường bao gồm một chuỗi các thành phần có tính liên kết chặt chẽ như máy chủ giao diện web, giao diện lập trình ứng dụng (API), cơ sở dữ liệu và hệ thống lưu trữ đệm (Cache). Docker Swarm cung cấp khái niệm Stack để quản lý toàn bộ tập hợp phức tạp này.

---

## 5.1. Khái niệm Stack

Khái niệm:
Stack là một cấu trúc dữ liệu mô tả một tập hợp các dịch vụ có mối quan hệ tương hỗ, được định nghĩa và triển khai đồng thời thông qua một tệp cấu hình duy nhất (thường là tệp `docker-compose.yml`).
Thay vì phải khởi tạo từng dịch vụ riêng lẻ thông qua hàng loạt câu lệnh dòng lệnh thủ công, toàn bộ cấu trúc hạ tầng hệ thống được số hóa và khai báo minh bạch trong một tệp văn bản.

Mục đích và ưu điểm:
- Quản lý tập trung: Cho phép người quản trị hệ thống vận hành một chuỗi dịch vụ phức tạp như một thực thể duy nhất. Việc khởi động, cập nhật trạng thái hoặc gỡ bỏ ứng dụng chỉ yêu cầu một câu lệnh tác động lên toàn bộ Stack.
- Quản lý hạ tầng dưới dạng mã (Infrastructure as Code): Tệp cấu hình có thể được lưu trữ và quản lý trên các hệ thống kiểm soát phiên bản (như Git), hỗ trợ việc theo dõi lịch sử thay đổi và dễ dàng chia sẻ tiêu chuẩn cấu hình giữa các thành viên trong đội ngũ phát triển.
- Tính linh hoạt và tái sử dụng: Cùng một cấu trúc tệp có thể được áp dụng linh hoạt cho nhiều môi trường vận hành khác nhau (phát triển cục bộ, thử nghiệm, hoặc sản xuất thực tế) thông qua việc kết hợp với các biến môi trường đặc thù.

---

## 5.2. Cách sử dụng tệp docker-compose.yml trong môi trường Swarm

Để kích hoạt các tính năng của Docker Swarm, tệp `docker-compose.yml` bắt buộc phải khai báo sử dụng phiên bản định dạng (Compose file format) từ `3.0` trở lên (thông dụng nhất hiện nay là `version: "3.8"`). Việc khai báo phiên bản v3 này là điều kiện tiên quyết để hệ thống mở khóa thẻ cấu hình `deploy`. Thẻ này đóng vai trò là trung tâm điều khiển, chứa các thiết lập chuyên biệt chỉ dành riêng cho quá trình điều phối trên cụm máy chủ phân tán (các phiên bản v2 trở xuống sẽ hoàn toàn bỏ qua thẻ `deploy` này khi chạy thực tế).

Phân tích các thành phần trọng tâm trong thẻ deploy:

- Thuộc tính replicas: Xác định chính xác số lượng bản sao của dịch vụ cần được hệ thống duy trì. Thuộc tính này chỉ có hiệu lực khi dịch vụ hoạt động ở chế độ phân bổ ngẫu nhiên (replicated).
- Thuộc tính resources: Định nghĩa các ngưỡng giới hạn về tài nguyên phần cứng (chẳng hạn như năng lực CPU, dung lượng bộ nhớ RAM). Việc thiết lập này nhằm ngăn chặn hiện tượng một dịch vụ tiêu thụ quá mức tài nguyên của máy chủ vật lý, từ đó bảo vệ sự ổn định của toàn hệ thống.
- Thuộc tính restart_policy: Định nghĩa chính sách tự động khởi động lại khi dịch vụ gặp sự cố, bao gồm điều kiện kích hoạt, số lần thử lại tối đa và thời gian chờ giữa các chu kỳ.
- Thuộc tính placement: Hỗ trợ thiết lập các bộ quy tắc ràng buộc vị trí (constraints). Tính năng này điều hướng hệ thống chỉ phân bổ các tác vụ xuống những máy chủ vật lý đáp ứng đúng các tiêu chí được chỉ định, ví dụ như quy định chỉ phân bổ cơ sở dữ liệu vào Manager Node hoặc chỉ phân bổ các tác vụ tính toán nặng nề vào các Worker Node.

Cú pháp minh họa tập trung vào thẻ cấu hình deploy:
```yaml
version: "3.8"

services:
  web-frontend:
    image: nginx:1.24-alpine
    ports:
      - "80:80"
    networks:
      - app-network
    
    deploy:
      mode: replicated
      replicas: 3
      
      resources:
        limits:
          cpus: "0.50"
          memory: 128M
        reservations:
          cpus: "0.25"
          memory: 64M
      
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      
      placement:
        constraints:
          - node.role == worker
```
Phân tích ứng dụng: 
Trong cấu hình ví dụ trên, hệ thống nhận yêu cầu duy trì 3 bản sao của ứng dụng máy chủ Nginx. Mỗi bản sao bị giới hạn tiêu thụ tối đa 50% năng lực của một lõi CPU và 128MB bộ nhớ RAM. Đặc biệt, thông qua quy tắc placement, hệ thống bị ép buộc chỉ được phép khởi tạo các tiến trình này trên các máy chủ mang vai trò thực thi (worker), nhằm cách ly tải xử lý ra khỏi máy chủ quản lý trung tâm.

---

## 5.3. Chuỗi lệnh quy trình triển khai thực tế

Để đưa hệ thống vào hoạt động, quản trị viên cần thực thi một chuỗi các thao tác tuần tự: từ khâu khởi tạo môi trường, triển khai ứng dụng cho đến khâu kiểm tra trạng thái.

Bước 1: Khởi tạo môi trường Swarm
Trước khi có thể triển khai Stack, thiết bị hiện tại cần được thiết lập làm Manager Node bằng lệnh khởi tạo:
```bash
docker swarm init
```
Lệnh này kích hoạt kiến trúc Swarm trên Docker Engine, tự động tạo ra bộ khóa bảo mật mạng nội bộ và cấp phát chuỗi mã thông báo (Token) để các thiết bị khác (Worker Node) có thể xác thực và tham gia vào cụm.

Bước 2: Triển khai Stack ứng dụng
Sau khi môi trường đã sẵn sàng và tệp cấu hình hoàn tất, hệ thống cung cấp công cụ lệnh docker stack để kích hoạt ứng dụng:
```bash
docker stack deploy -c docker-compose.yml my-app-stack
```
Phân tích câu lệnh triển khai:
- Cờ tham số -c: Được sử dụng để chỉ định đường dẫn tuyệt đối hoặc tương đối tới tệp cấu hình định nghĩa ứng dụng.
- Chuỗi định danh my-app-stack: Đại diện cho tên của Stack. Quá trình triển khai sẽ tự động ghép tên định danh này làm tiền tố cho toàn bộ các dịch vụ và mạng nội bộ được sinh ra (ví dụ: my-app-stack_web-frontend).

Bước 3: Kiểm tra và giám sát trạng thái
Quản trị viên cần thực hiện lệnh sau để đảm bảo quá trình triển khai diễn ra thành công và các bản sao đang được phân bổ đúng máy chủ:

```bash
docker stack ps my-app-stack
```

*Kết quả minh họa trực quan (Minh chứng 3 Task Running):*
```text
ID             NAME                          IMAGE               NODE      DESIRED STATE   CURRENT STATE            ERROR     PORTS
r1x2y3z4a5b6   my-app-stack_web-frontend.1   nginx:1.24-alpine   worker1   Running         Running 2 minutes ago              
m7n8p9q0r1s2   my-app-stack_web-frontend.2   nginx:1.24-alpine   worker2   Running         Running 2 minutes ago              
h3j4k5l6m7n8   my-app-stack_web-frontend.3   nginx:1.24-alpine   worker3   Running         Running 2 minutes ago              
```
Bảng kết quả trên là minh chứng rõ ràng nhất cho thấy 3 tác vụ đã được chia đều xuống các Node, đáp ứng đúng yêu cầu `replicas: 3` của cấu hình.

Các câu lệnh quản trị Stack bổ trợ trong quá trình vận hành:
- Liệt kê danh sách các Stack đang hoạt động trên hệ thống:
```bash
docker stack ls
```
- Kiểm tra danh sách chi tiết các dịch vụ đang cấu thành nên một Stack cụ thể:
```bash
docker stack services my-app-stack
```
- Giám sát trạng thái hoạt động thực tế của các tác vụ (Tasks) bên trong Stack:
```bash
docker stack ps my-app-stack
```
- Gỡ bỏ hoàn toàn một Stack khỏi hệ thống cụm:
```bash
docker stack rm my-app-stack
```
Thao tác gỡ bỏ này sẽ ngay lập tức yêu cầu Manager Node phát tín hiệu điều khiển tới toàn bộ Worker Node để dừng và gỡ bỏ tất cả các container, đồng thời dọn dẹp các mạng ảo nội bộ liên quan đến Stack đó một cách triệt để và an toàn.

Sự khác biệt mang tính bản chất so với Docker Compose truyền thống:
Khi thực thi lệnh triển khai dạng Stack, hệ thống Docker Swarm sẽ hoàn toàn bỏ qua các chỉ thị yêu cầu xây dựng mã nguồn (thuộc tính `build:`). Nguyên lý vận hành của cụm phân tán đòi hỏi các gói phần mềm (Image) phải được đóng gói sẵn và lưu trữ trên một kho chứa tập trung (Registry) trước khi tiến hành quá trình triển khai. Các Node tham gia vào cụm sẽ tự động kết nối và tải Image từ kho chứa này thay vì cố gắng tự biên dịch mã nguồn một cách cục bộ. Bất kỳ sự thiếu hụt Image nào trên các Worker Node đều sẽ khiến tác vụ bị từ chối với lỗi `Rejected` hoặc `No such image`.

---

## 5.4. Phụ lục: Ví dụ cấu hình ứng dụng đa dịch vụ (Full Stack)

Để minh họa sức mạnh thực sự của Docker Swarm, dưới đây là một cấu hình `docker-compose.yml` đạt chuẩn môi trường sản xuất. Cấu hình này mô phỏng một hệ thống hoàn chỉnh bao gồm máy chủ Web (Nginx), giao diện lập trình ứng dụng (API) và cơ sở dữ liệu (PostgreSQL), kết hợp quản lý bảo mật thông qua Docker Secrets:

```yaml
version: "3.8"

services:
  # ── Web Server (Chạy trên Worker) ────────────────────
  nginx:
    image: nginx:1.24-alpine
    ports:
      - "80:80"
    networks:
      - frontend
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      placement:
        constraints:
          - node.role == worker

  # ── API Service (Chạy trên Worker) ───────────────────
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
        order: start-first       # Khởi động bản mới trước khi tắt bản cũ
      placement:
        constraints:
          - node.role == worker

  # ── Database (Chạy trên Manager) ─────────────────────
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
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager  # Đảm bảo dữ liệu không bị phân tán ngẫu nhiên

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay

secrets:
  db_password:
    external: true
```
