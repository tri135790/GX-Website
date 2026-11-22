# Tư vấn & Trị liệu và kiểm tra lưu người tham gia

Chạy migration 009 nếu chưa áp dụng, rồi `010_consultation_therapy.sql`, trước frontend mới. Không chạy lại migration cũ. Chạy toàn bộ mỗi file trong transaction. Không tự áp dụng production khi commit/push code.

## Dữ liệu và quyền

Loại `consultation_therapy` (Tư vấn & Trị liệu), màu `#008d34`, gắn với một học sinh đang hoạt động và một địa điểm. Không dùng giáo viên khách hàng hoặc BM. Admin chọn nhiều nhân sự đang hoạt động; mỗi người có một vai `consultation` (Tư vấn ba mẹ) hoặc `therapy` (Trị liệu học sinh) trong `participant_roles`. Có thể chỉ có một vai. Không cần liên kết phụ huynh cụ thể.

Một lần làm việc là một bản ghi, sử dụng `employee_id` và `support_employee_ids`; bảng `lesson_participants` tiếp tục đồng bộ. Người kỹ thuật không quyết định vai trò. Mọi người tham gia được kiểm tra trùng lịch, lọc và xem lịch. Nhân sự tự tạo chỉ được tạo cho chính mình trong phạm vi học sinh hiện hành. Chỉ admin hoàn thành/báo cáo lịch nhiều người; lịch một người giữ quyền báo cáo hiện tại.

RPC `employee_calendar_v4` thêm `participant_roles`; v3 vẫn tồn tại cho frontend cũ. Workspace phụ huynh có loại kết hợp, người tham gia và vai trò nhưng không có báo cáo hoặc ghi chú nội bộ.

## Giờ làm

Buổi 60 phút: người tư vấn nhận 60 phút tư vấn, người trị liệu nhận 60 phút trị liệu. Nhiều người cùng vai vẫn mỗi người nhận đủ 60 phút. Hồ sơ học sinh thể hiện 60 phút tư vấn ba mẹ nếu có vai tư vấn và 60 phút trị liệu nếu có vai trị liệu, nhưng tổng thời lượng buổi chỉ 60 phút. Hai mục dịch vụ có thể diễn ra đồng thời, không cộng chúng để suy ra tổng thời lượng. Giữ các điều kiện hoàn thành, hủy và lịch sử hiện tại.

## Lỗi mất người tham gia Họp

Đã tái hiện cục bộ: trigger migration 008 tự đặt `support_employee_ids='{}'`, làm mất người dù RPC lưu thành công. Migration 009 bỏ hành vi này; 010 mở rộng cho loại kết hợp. Không coi đây là xác minh database production. Kiểm tra migration đã áp dụng trong môi trường đích và phiên bản frontend trước phát hành.

Frontend đọc lại các lịch nhiều người sau lưu, đối chiếu danh sách người và vai. Nếu sai hoặc không đọc lại được, hiển thị lỗi thay vì thông báo thành công. Lệnh lưu có thể đã ghi dữ liệu; cần tải lại trước khi sửa tiếp. Không tự khôi phục người tham gia đã mất trong lịch cũ.

## Kiểm tra

Chạy `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Với PGlite cài riêng, chạy `PGLITE_ROOT=/path/to/@electric-sql/pglite node tests/meeting-database.mjs`: test tái hiện lỗi 008, nâng cấp 009/010, lưu/tải lại, phân vai, trùng lịch, quyền nhân sự và projection phụ huynh.

Kiểm tra giao diện tạo loại kết hợp, chọn vai từng người, đổi loại, sửa chuỗi, lọc theo người. Lịch vắng chỉ hiển thị tên nhân sự, thời gian và trạng thái, không có địa điểm hoặc dòng “Chưa có địa điểm”.
