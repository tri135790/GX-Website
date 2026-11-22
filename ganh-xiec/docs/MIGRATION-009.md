# Phân công lịch và người tham gia Họp

Áp dụng `009_meeting_participants.sql` sau 001–008 và trước frontend tương ứng. Chạy nguyên file trong một transaction. Migration không khôi phục danh sách người phụ cũ đã được 008 lưu vào archive. Không chạy lại migration đã áp dụng.

Admin có thể chọn mọi nhân sự đang hoạt động cho lịch học sinh; phân công trong hồ sơ không đổi. Nhân sự tự tạo lịch vẫn chỉ được tạo cho chính mình và trong phạm vi hồ sơ hiện được phép truy cập. Lịch vắng giữ hành vi hiện tại.

Họp nhiều người lưu một bản ghi mỗi lần họp. `employee_id` giữ người hiện tại nếu còn tham gia; nếu cần thay thế dùng ID nhỏ nhất theo thứ tự từ điển. Những người còn lại lưu trong `support_employee_ids`, đồng bộ vào `lesson_participants`. Đây là cách lưu kỹ thuật, không cần chọn người chính trên giao diện. Loại công việc khác không được lưu danh sách này.

Mỗi người tham gia Họp giữ khung giờ và nhận toàn bộ số phút thực tế sau khi hoàn thành. Họp 60 phút với ba người là 60 phút trên tổng thời lượng lịch và 180 phút tổng công khi cộng thống kê của ba người. Lịch hủy, lịch vắng và lịch cũ chưa xác nhận người phụ trách không được tính giờ thực tế. Không có thời lượng riêng từng người.

Họp nhiều người do admin xác nhận hoàn thành và nhập/nộp một báo cáo chung. Nhân sự tham gia có quyền xem nhưng không cập nhật báo cáo qua RPC. Họp một người giữ quyền hiện tại. Sửa/xóa chuỗi Họp không phụ thuộc người lưu ở `employee_id`; các giới hạn bảo vệ lịch hoàn thành và báo cáo riêng từng lần được giữ lại.

Kiểm tra cục bộ: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Chạy riêng `PGLITE_ROOT=/path/to/@electric-sql/pglite node tests/meeting-database.mjs` để xác minh toàn bộ migration và quyền. Các script `tests/*-database.mjs` khác kiểm tra các phiên bản lịch sử của database, không thay thế kiểm thử 009.

Sau khi quản trị áp dụng migration, kiểm tra tạo Họp hai người, lọc theo từng người, thống kê giờ, trùng lịch với người thứ hai và quyền báo cáo. Chưa áp dụng migration lên production trong lần triển khai code này.
