# Hồ sơ giáo viên và một Incharge

Áp dụng `supabase/migrations/008_teachers_incharge_profiles.sql` sau 001–007 và trước frontend mới. Chạy nguyên file trong một transaction; không chạy từng đoạn hoặc chạy lại sau khi đã thành công. Migration có thông báo tải lại schema PostgREST.

Giáo viên khách hàng được lưu riêng trong teachers; không tự chuyển nhân sự sang giáo viên. Nhập hồ sơ khách hàng từ tab Hồ sơ → Giáo viên. Bảng mới có quyền đọc và RPC ghi theo vai trò. Học sinh và giáo viên đều có ngày bắt đầu tham gia; tổng giờ chỉ tính buổi hoàn thành đã kết thúc từ ngày này. Tư vấn nhóm tính toàn bộ thời lượng cho mỗi giáo viên tham gia, nhưng chỉ tính một lần cho Incharge.

Nhân sự phụ cũ được lưu vào legacy_support_archive dành cho admin rồi loại khỏi phân công đang dùng. Lịch nhóm cũ chưa có Incharge vẫn cần chọn rõ người phụ trách trước khi tính giờ. Màu nhân sự cũ được giữ trong database, lịch dùng màu loại công việc.

Xóa hồ sơ là thao tác riêng có xác nhận, chỉ admin được thực hiện. Hệ thống giữ bản ghi hồ sơ ẩn, xóa lịch và báo cáo riêng, mục tiêu, tiến trình và liên kết phụ huynh. Tổng giờ nhân sự giảm theo các buổi đã xóa. Với tư vấn nhóm, bỏ giáo viên khỏi danh sách và giữ buổi cùng báo cáo chung cho những người còn lại. Audit quản trị vẫn được giữ. Thao tác xóa không có nút hoàn tác.

Kiểm tra phát hành: typecheck và production build. Không chạy bộ test tự động theo yêu cầu. Migration chưa được thực thi trên Supabase trong phiên sửa mã; cần áp dụng và kiểm tra quyền/CRUD trên database trước khi đưa vào sử dụng.
