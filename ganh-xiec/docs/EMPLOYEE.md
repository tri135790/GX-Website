# Triển khai giao diện Employee

## Thứ tự triển khai

1. Mở Supabase SQL Editor trên project `passgmewpovbjybpyxko`.
2. Chạy toàn bộ `supabase/migrations/002_employee.sql` **một lần**, sau migration 001 đã có. Không chạy lại 001. Migration không sửa/xóa dữ liệu hiện có.
3. Commit/push frontend và chờ workflow GitHub Pages deploy thành công. Không cần deploy lại Edge Function lời mời cho tính năng Employee.
4. Trong UI admin, tạo hồ sơ nhân sự, phân công học sinh (chính hoặc phối hợp), mời tài khoản role Employee và chọn đúng hồ sơ nhân sự. Tài khoản đang tồn tại có thể đổi role/liên kết tại Tài khoản.
5. Đăng nhập Employee trên cửa sổ riêng: mở mặc định Lịch dạy. Tài khoản và hồ sơ nhân sự đều phải active.

## Quyền

- Xem lịch tất cả giáo viên; không tạo, kéo thả, đổi giờ, hủy hoặc xác nhận kết quả.
- Ngoài phân công: chỉ biết tên học sinh/giáo viên, thời gian, hình thức, trạng thái và số phút thực dạy; không nhận note, nội dung, địa điểm/link hoặc lý do.
- Trong phân công: xem hồ sơ, các buổi học, mục tiêu và tiến trình. Giáo viên chính/phối hợp cùng quyền sửa lưu ý, mục tiêu và tiến trình tuần chung.
- Chỉ sửa nội dung/note buổi mình dạy. Không sửa số phút, trạng thái hoặc thông tin cơ bản học sinh.
- Học sinh inactive: chỉ đọc lịch sử. Gỡ phân công/khóa tài khoản được kiểm tra lại tại server khi đọc/ghi. Giao diện làm mới khi focus, mỗi 30 giây và sau lưu; quyền bị thu hồi thì xóa phần dữ liệu liên quan.
- Nếu người khác sửa trước: form giữ nội dung nhập; nút đối chiếu hiển thị bản mới, chỉ đổi phiên bản sau khi người dùng chủ động chọn giữ nội dung của mình.

## API mới

- `employee_calendar(p_start, p_end)`: projection lịch tối thiểu, tối đa 100 ngày mỗi khoảng; client phân trang 1.000 bản ghi.
- `employee_workspace()`: dữ liệu học sinh đang được phân công; tên giáo viên/người cập nhật không kèm thông tin liên hệ. Trả JSON để tránh giới hạn số hàng cho các mảng con; khi quy mô lớn cần phân trang hồ sơ riêng.
- `employee_save(p_table, p_record)`: whitelist trường, version bắt buộc, xác định Employee từ phiên đăng nhập. Không nhận employee_id để xác định quyền. Dùng cùng transaction lock với admin và giữ audit.
- RLS bổ sung cho học sinh, phân công, buổi học, mục tiêu, tiến trình. Employee không có quyền ghi trực tiếp lên bảng và không dùng được save_bundle của admin.

## Kiểm thử

```sh
npm run typecheck
npm run lint
npm test
npm run build
PGLITE_ROOT=/path/to/node_modules/@electric-sql/pglite node tests/database.mjs
PGLITE_ROOT=/path/to/node_modules/@electric-sql/pglite node tests/employee-database.mjs
```

Test PostgreSQL dùng database tạm, không gọi Supabase thật. Bộ Employee kiểm tra projection/RLS, trường cấm, sửa buổi người khác, version cũ, bản tuần trùng, snapshot, audit, khóa tài khoản/nhân sự, học sinh inactive và gỡ phân công.

Nghiệm thu trên cloud sau deploy: dùng admin và hai Employee A/B; một học sinh chung, một học sinh chỉ B. A xem được lịch B nhưng không mở chi tiết học sinh riêng B; A/B cập nhật được học sinh chung, chỉ sửa note buổi mình. Thử sửa cùng bản tuần, xác nhận chặn ghi đè. Admin vẫn tạo/sửa lịch và xác nhận giờ bình thường. Kiểm tra điện thoại, chuyển tuần/tháng, tổng giờ theo lọc và danh sách lịch sử tuần.

Giao diện Parents không thay đổi. Chưa thể xác nhận end-to-end trên Supabase thật trước khi migration được áp dụng và có tài khoản Employee thử nghiệm.

## Kết quả kiểm tra local (08/11/2026)

- TypeScript, lint và production build: đạt. Bộ test ứng dụng hiện tại: 20/20 đạt.
- PostgreSQL tạm: 10 nhóm kiểm tra admin/nghiệp vụ và 6 nhóm Employee đạt.
- Trình duyệt dữ liệu mẫu: lịch desktop, danh sách đúng phân công, sửa lưu ý bằng bàn phím, điện thoại 390px mặc định lịch danh sách và tablet 820px mặc định tuần; không tràn ngang toàn trang.
- Chưa áp dụng migration lên Supabase thật, chưa push hoặc xuất bản. Cần nghiệm thu cloud bằng tài khoản thật theo mục trên.
