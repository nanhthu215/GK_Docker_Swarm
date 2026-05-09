# 6. Chiến lược vận hành: Cập nhật cuốn chiếu và khôi phục tự động (Rolling Updates & Rollbacks)

Trong các hệ thống kinh doanh liên tục, việc tạm dừng toàn bộ ứng dụng để cập nhật phiên bản phần mềm mới là không thể chấp nhận được do gây ra sự gián đoạn dịch vụ. Docker Swarm cung cấp một giải pháp thiết kế sẵn để giải quyết triệt để bài toán này thông qua cơ chế Cập nhật cuốn chiếu (Rolling Updates) và Khôi phục tự động (Rollbacks).

---

## 6.1. Phương pháp cập nhật truyền thống và những hạn chế

Theo phương pháp cập nhật phần mềm truyền thống, tiến trình diễn ra theo dạng tuần tự:
- Bước 1: Dừng toàn bộ hệ thống hoặc các tiến trình container hiện tại.
- Bước 2: Tải xuống phiên bản mã nguồn mới (Image) về hệ thống lưu trữ máy chủ.
- Bước 3: Khởi động lại toàn bộ hệ thống với phiên bản mới.

Hạn chế cốt lõi: Quy trình này chắc chắn gây ra một khoảng thời gian chết (Downtime). Trong khoảng thời gian này, khách hàng không thể kết nối tới ứng dụng, dẫn đến ảnh hưởng tiêu cực tới trải nghiệm người dùng và làm tổn thất doanh thu của doanh nghiệp.

---

## 6.2. Cơ chế cập nhật cuốn chiếu (Rolling Updates)

Khái niệm: 
Cập nhật cuốn chiếu là chiến lược thay thế dần dần từng nhóm nhỏ các bản sao của ứng dụng thay vì thay thế toàn bộ cùng một lúc.

Mục đích: 
Đảm bảo tại bất kỳ thời điểm nào trong suốt quá trình cập nhật, hệ thống vẫn luôn duy trì một số lượng bản sao hoạt động ổn định để tiếp nhận và xử lý yêu cầu từ người dùng. Quá trình này giúp doanh nghiệp đạt được trạng thái lý tưởng trong vận hành phần mềm: Triển khai không gián đoạn (Zero-downtime deployment).

Minh họa cơ chế hoạt động (Ví dụ: cập nhật với `parallelism=1` trên hệ thống có 3 bản sao):
Hệ thống sẽ tiến hành gỡ bỏ và cập nhật bản sao số 1, trong lúc đó bản sao số 2 và 3 vẫn tiếp tục hoạt động và gánh tải. Sau khi bản sao số 1 cập nhật thành công, hệ thống mới tiếp tục với bản sao số 2, và cuối cùng là số 3. Kết quả là luôn có ít nhất 2/3 lượng tác vụ gánh vác lưu lượng truy cập, tuyệt đối không xảy ra hiện tượng từ chối dịch vụ.

Nguyên lý hoạt động và tham số cấu hình:
Quá trình cập nhật được kiểm soát chặt chẽ thông qua khối cấu hình update_config trong tệp khai báo YAML.

```yaml
deploy:
  replicas: 4
  update_config:
    parallelism: 1
    delay: 15s
    failure_action: rollback
    monitor: 30s
    order: start-first
```

Phân tích các thuộc tính quan trọng:
- Thuộc tính parallelism: Quy định số lượng tác vụ (Task) được phép cập nhật đồng thời trong một chu kỳ. Ví dụ, thiết lập thông số này là 1 nghĩa là hệ thống sẽ thực hiện gỡ bỏ và cập nhật tuần tự từng container một.
- Thuộc tính delay: Khoảng thời gian hệ thống bắt buộc phải chờ giữa các chu kỳ cập nhật. Thời gian này cho phép ứng dụng bên trong container mới có đủ thời gian khởi động, tải cấu hình và sẵn sàng nhận tải trước khi hệ thống tiếp tục thao tác với container tiếp theo.
- Thuộc tính order: Xác định trình tự vòng đời thao tác. Giá trị start-first chỉ định hệ thống phải khởi động thành công bản sao mới trước khi tiến hành dừng và xóa bản sao cũ. Thiết lập này đảm bảo mức độ an toàn cao hơn so với giá trị mặc định (stop-first), giúp duy trì trọn vẹn 100% năng lực phục vụ của hệ thống trong suốt quá trình triển khai, bù lại sẽ tiêu tốn thêm một phần tài nguyên tính toán tạm thời.

Lệnh thực thi cập nhật trực tiếp:
Bên cạnh việc thay đổi file cấu hình và dùng lại lệnh deploy, quản trị viên có thể kích hoạt quá trình cập nhật cuốn chiếu ngay lập tức thông qua giao diện dòng lệnh:
```bash
docker service update \
  --image nginx:1.24-alpine \
  --update-parallelism 1 \
  --update-delay 15s \
  my-web-service
```

Minh chứng trực quan quá trình cập nhật (Zero-downtime):
Nếu dùng lệnh `watch docker service ps my-web-service` để giám sát thời gian thực, quản trị viên sẽ quan sát được các tác vụ chuyển trạng thái cực kỳ mượt mà:
```text
ID             NAME                 IMAGE               NODE      DESIRED STATE   CURRENT STATE            
a1b2c3d4e5f6   my-web-service.1     nginx:1.24-alpine   worker1   Running         Starting 2 seconds ago              
q1w2e3r4t5y6   \_ my-web-service.1  nginx:1.23-alpine   worker1   Shutdown        Shutdown 3 seconds ago              
z1x2c3v4b5n6   my-web-service.2     nginx:1.23-alpine   worker2   Running         Running 5 days ago                  
m1n2b3v4c5x6   my-web-service.3     nginx:1.23-alpine   worker3   Running         Running 5 days ago                  
```
Màn hình trên minh chứng: Tác vụ số 1 phiên bản cũ vừa bị ngắt (`Shutdown`), phiên bản mới đang khởi động (`Starting`). Trong lúc đó, tác vụ 2 và 3 vẫn ở nguyên trạng thái `Running` để tiếp tục gánh tải người dùng, hoàn toàn không gây ra thời gian chết (downtime).

Điều kiện bắt buộc để "Zero-Downtime" thực sự xảy ra:
Chỉ thiết lập `update_config` thôi là chưa đủ. Trong môi trường sản xuất thực tế, hệ thống phải đồng thời thỏa mãn các điều kiện sau:
1. Số lượng bản sao phải từ 2 trở lên (`replicas >= 2`): Để khi một tác vụ đang bị gỡ bỏ, vẫn còn tác vụ khác gánh tải lưu lượng.
2. Bắt buộc cấu hình `healthcheck`: Để Swarm biết chính xác khi nào ứng dụng mới thực sự sẵn sàng trước khi ngắt ứng dụng cũ.
3. Ưu tiên `order: start-first`: Bản mới sẽ được khởi động và đạt trạng thái healthy trước khi bản cũ bị ngắt, giúp không làm sụt giảm năng lực xử lý tạm thời.
4. Xử lý tắt an toàn (Graceful Shutdown): Mã nguồn ứng dụng phải bắt được tín hiệu `SIGTERM` để hoàn thành các request đang xử lý dở dang trước khi bị hệ điều hành đóng cửa hoàn toàn.

Kịch bản ứng dụng thực tế:
Một hệ thống thanh toán trực tuyến đang vận hành song song 4 bản sao. Khi cần phát hành tính năng bảo mật mới, quản trị viên áp dụng cấu hình cập nhật từng bản sao một (parallelism = 1). Người dùng đang thực hiện thanh toán sẽ được hệ thống định tuyến thông minh chuyển tiếp sang 3 bản sao còn lại đang hoạt động bình thường, hoàn toàn không nhận thức được việc cơ sở hạ tầng đang tiến hành nâng cấp lõi phần mềm.

---

## 6.3. Cơ chế khôi phục phiên bản (Rollbacks)

Mặc dù quy trình kiểm thử trước khi phát hành (QA/Testing) có thể được thực hiện kỹ lưỡng, rủi ro phát sinh lỗi phần mềm khi tiếp xúc với môi trường sản xuất thực tế vẫn luôn hiện hữu. Cơ chế khôi phục tự động là giải pháp bảo vệ hệ thống trước tình huống bản cập nhật mới gặp sự cố sụp đổ.

Khái niệm: 
Khôi phục (Rollback) là quá trình đảo ngược thao tác cập nhật, ra lệnh đưa toàn bộ dịch vụ trở về trạng thái của phiên bản phát hành ổn định ngay trước đó.

Cấu hình tự động khôi phục:
Sự kết hợp giữa thuộc tính phản ứng lỗi (failure_action) và khối cấu hình khôi phục (rollback_config) tạo nên một cơ chế phản ứng tự động bảo vệ hệ thống.

```yaml
deploy:
  replicas: 4
  update_config:
    parallelism: 1
    failure_action: rollback
    monitor: 30s
    max_failure_ratio: 0.2
  
  rollback_config:
    parallelism: 2
    delay: 5s
    failure_action: pause
```

Quy trình hệ thống tự động xử lý rủi ro:
- Bước 1: Hệ thống triển khai bản cập nhật phần mềm mới lên một container đầu tiên theo đúng quy tắc cuốn chiếu.
- Bước 2: Thông qua thuộc tính monitor, hệ thống hệ thống sẽ giám sát trạng thái sức khỏe của container mới này trong khung thời gian 30 giây.
- Bước 3: Nếu phát hiện container liên tục báo lỗi kết nối hoặc khởi động lại, dẫn đến vượt quá giới hạn tỷ lệ lỗi cho phép (max_failure_ratio), hệ thống tự động gắn cờ thất bại cho toàn bộ tiến trình cập nhật.
- Bước 4: Do giá trị failure_action được thiết lập là rollback, Swarm lập tức dừng thao tác cập nhật đối với các container còn lại và kích hoạt quy trình đảo ngược.
- Bước 5: Quá trình lùi phiên bản tuân thủ theo các quy tắc khai báo riêng biệt trong phần rollback_config (ví dụ: cho phép lùi nhanh đồng thời 2 container mỗi chu kỳ) để nhanh chóng đưa hệ thống phục hồi về trạng thái ổn định ban đầu.

Tổng hợp các trường hợp thất bại (Failures) và phản ứng của Swarm:
| Trường hợp sự cố | Phản ứng của hệ thống | Cấu hình kiểm soát tương ứng |
|----------|---------|-----------|
| Container tự crash sau khi update | Auto-rollback (Tự động lùi về bản cũ) | `failure_action: rollback` |
| Healthcheck liên tục báo lỗi | Tạm dừng quá trình update | `failure_action: pause` |
| Quá trình rollback cũng bị lỗi | Tạm dừng quá trình rollback | `rollback_config.failure_action: pause` |
| Image không tồn tại trên kho | Task chuyển trạng thái FAILED → rollback | Cơ chế xử lý mặc định của Swarm |

Để phân tích sự cố chuyên sâu, quản trị viên có thể truy xuất tệp log lịch sử cập nhật thông qua định dạng JSON:
```bash
docker service inspect my-web-service --format '{{json .UpdateStatus}}'
# Kết quả mẫu:
# {
#   "State": "rollback_completed",
#   "StartedAt": "2024-05-15T10:00:00Z",
#   "CompletedAt": "2024-05-15T10:00:45Z",
#   "Message": "rollback completed"
# }
```

Khôi phục thủ công (Manual Rollback):
Trong trường hợp phát hiện lỗi nghiệp vụ trễ (không gây rớt tiến trình nhưng sai logic) và cơ chế tự động chưa kích hoạt, quản trị viên có thể ra lệnh cưỡng chế lùi phiên bản lập tức bằng tay:
```bash
docker service rollback my-web-service
```
Lệnh này sẽ chỉ thị Swarm lùi toàn bộ cấu hình của dịch vụ về đúng trạng thái ngay trước đợt cập nhật gần nhất.

Lợi ích cốt lõi:
Sự kết hợp hoàn hảo giữa phương pháp cập nhật cuốn chiếu và cơ chế khôi phục tự động tạo ra một mạng lưới an toàn tuyệt đối cho kiến trúc dịch vụ. Các kỹ sư hệ thống có thể triển khai phần mềm liên tục (CI/CD) nhiều lần trong ngày với sự tự tin cao độ, bởi mọi phiên bản phát hành chứa lỗi nghiêm trọng đều sẽ bị hệ thống tự động phát hiện sớm, cách ly và tiêu hủy tự động trước khi nó kịp gây thiệt hại trên diện rộng.
