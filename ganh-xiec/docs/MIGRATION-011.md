# Hồ sơ học sinh, báo cáo và đánh giá

Áp dụng toàn bộ `supabase/migrations/011_student_profiles.sql` sau 001–010, trong transaction, trước khi phát hành frontend tương ứng. Không sửa hoặc chạy lại migration cũ. Commit/push không tự áp dụng database production.

## Dữ liệu và quyền

- `student_weekly_notes`: một lưu ý mỗi học sinh/tuần thứ Hai. `consultation_reports`: một báo cáo có cấu trúc mỗi buổi Tư vấn hoặc buổi kết hợp có vai Tư vấn. Lưu là chia sẻ ngay; admin và nhân sự được `employee_assigned` cho phép nhập/sửa. Giữ nguyên định nghĩa quyền phân công hiện hành, không mở cho toàn bộ nhân sự.
- `save_student_report(p_kind,p_record)` kiểm tra trường, giới hạn nội dung 20.000 ký tự mỗi trường, phiên bản kỳ vọng, học sinh đang hoạt động và quan hệ với buổi. Tạo mới dùng version 0; cập nhật dùng phiên bản đã đọc. Có audit và chống ghi đè.
- Buổi có báo cáo không được đổi học sinh/loại hoặc bỏ hết vai Tư vấn; FK chặn xóa buổi. Vì vậy xóa hồ sơ học sinh có dữ liệu mới cũng bị chặn thay vì âm thầm mất lịch sử; dùng ngừng hoạt động khi cần giữ hồ sơ. Thời gian/địa điểm/nhân sự hiển thị theo lịch hiện hành, người tham gia bổ sung là nội dung của báo cáo.
- `student_assessments`: các lần nộp bất biến qua API, lưu lựa chọn theo chỉ số **0-based** trong phiên bản biểu mẫu 1. Chỉ phụ huynh liên kết được nộp; danh tính, điểm và thời điểm do máy chủ ghi. Không có quyền INSERT/UPDATE/DELETE trực tiếp, kể cả admin ứng dụng.
- `submit_student_assessment(p_id,p_student,p_kind,p_form_version,p_answers)` yêu cầu đủ 77/30 lựa chọn. Cùng UUID + danh tính + payload trả lại kết quả cũ; cùng UUID với payload khác bị từ chối. Mỗi bài mới tạo UUID mới; thử lại do lỗi mạng giữ UUID.
- `student_profile(p_student)` cung cấp hồ sơ cho admin, nhân sự có quyền và phụ huynh liên kết. Quyền đọc bao gồm thông tin hỗ trợ, chẩn đoán, nội dung/ghi chú buổi, giờ làm và thông tin liên hệ các phụ huynh liên kết. Không trả báo cáo công việc nháp hoặc dữ liệu tài khoản. Các bảng hồ sơ gốc tiếp tục hạn chế đọc trực tiếp; API có kiểm tra quyền riêng.
- Giữ nguyên `weekly`, `goals`, `family_reports`, `family_updates`. Giao diện mới chỉ đọc lịch sử cũ: phụ huynh thấy báo cáo `published=true` và cập nhật gia đình; nhân sự thấy thêm bản nháp trong khu vực riêng. Không tự công khai hoặc chuyển đổi nội dung.
- ATEC nhắc theo học sinh; Stress theo cặp học sinh–hồ sơ phụ huynh. Lần đầu dùng `start_date`; sau đó dùng thời điểm nộp gần nhất + 56 ngày. Chỉ nhắc trong ứng dụng; học sinh ngừng hoạt động chỉ xem lịch sử. Nhật ký/Bài tập chưa có dữ liệu hay CRUD.

## Biểu mẫu

`lib/gx/assessment-definitions.ts` là nội dung phiên bản 1, trích nguyên văn câu hỏi và lựa chọn từ `atec (updated).txt` / `stress (updated).txt`. Không sửa phiên bản đã có kết quả; lần thay đổi nội dung sau này phải có phiên bản và quy tắc đọc lịch sử tương ứng. Không đưa HTML, script, CDN hoặc xuất PDF/ảnh của tệp nguồn vào ứng dụng.

ATEC phần I/III chấm ngược thứ tự lựa chọn; phần II chấm 0–2; phần IV chấm 0–3. Stress chấm 1–5, tổng tối thiểu 30, tối đa 150. Cả hai lưu cả lựa chọn và điểm từng phần. Giao diện không suy diễn chẩn đoán từ điểm.

## Kiểm tra và triển khai

1. Chạy `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
2. Với PGlite cài riêng, chạy `PGLITE_ROOT=/path/to/@electric-sql/pglite node tests/student-profile-database.mjs`. Test áp dụng 001–010, tạo dữ liệu cũ rồi nâng cấp 011; không kết nối production.
3. Chạy các bộ database hồi quy hiện có: `database.mjs`, `employee-database.mjs`, `parent-database.mjs`, `work-database.mjs`, `profile-database.mjs`, `meeting-database.mjs`. Một số kiểm tra cố ý dùng phiên bản migration lịch sử; bộ mới kiểm tra 011.
4. Sau khi áp dụng SQL trong môi trường đích, xác nhận API `student_profile`, `save_student_report`, `submit_student_assessment` xuất hiện, đăng nhập từng vai trò và kiểm tra học sinh liên kết/không liên kết, bản nháp, giờ buổi kết hợp và gửi lại bài khi lỗi mạng.
5. Phát hành frontend sau SQL. Nếu thiếu migration, giao diện báo cần cập nhật hệ thống; không dùng dữ liệu giả thay thế. Nếu cần quay lui frontend, giữ migration và dữ liệu mới, không DROP bảng để rollback.

Kiểm thử trình duyệt cục bộ sử dụng fixture và client giả để kiểm tra thao tác/layout; kiểm thử quyền và lưu trữ thực dùng PostgreSQL trong PGlite. Cần kiểm tra smoke với tài khoản thật sau triển khai môi trường đích.
