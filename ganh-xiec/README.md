# Gánh Xiếc — Không gian quản trị

Website quản lý lịch dạy 1–1, nhân sự, học sinh, phụ huynh và tiến trình tuần. React/TypeScript, Vinext, FullCalendar và Supabase PostgreSQL/Auth.

## Chạy local

```sh
npm ci
npm run dev
```

Mở http://localhost:5173. Khi chưa cấu hình Supabase, ứng dụng hiện **bản xem thử** có nhãn rõ ràng. Dữ liệu mẫu chỉ nằm trong bộ nhớ trình duyệt, mất khi tải lại. Không nhập hồ sơ thật vào bản này. Khi có cấu hình Supabase, bản mẫu tự tắt và người dùng phải đăng nhập.

## Kết nối Supabase

Xem hướng dẫn từng bước, kiểm thử và deploy trong [docs/DEPLOY.md](docs/DEPLOY.md).

1. Tạo một project Supabase mới. Không dùng project đang chứa hệ thống khác: migration thiết lập quyền cho các bảng của ứng dụng.
2. Trong SQL Editor, chạy `supabase/migrations/001_ganh_xiec.sql` một lần. File tạo bảng, RLS, transaction RPC, ràng buộc lịch và audit.
3. Sao chép `.env.example` thành `.dev.vars` và đặt URL cùng anon/publishable key. Đặt service-role/secret key **chỉ ở server**. Không commit file môi trường và không đưa secret vào frontend.
4. Đặt `APP_URL` bằng địa chỉ website (local là http://localhost:5173). Trong Supabase Auth URL Configuration, cấu hình Site URL và allowlist redirect đúng origin local/production.
5. Cấu hình SMTP riêng trong Supabase Auth để gửi email mời/khôi phục. Bản ghi lời mời ứng dụng hết hạn sau 7 ngày; link email có thời hạn riêng theo Email OTP Expiration của Supabase (mặc định 1 giờ). Các cơ chế chống spam và rate limits vẫn do Supabase quản lý.
6. Bật Google provider, nhập client ID/secret từ Google Cloud. Thêm callback do Supabase cấp vào Google. Làm tương tự với Facebook/Meta, cấu hình quyền email và chuyển app sang trạng thái cho phép người dùng mục tiêu đăng nhập. Website chỉ xác nhận OAuth hoạt động sau khi kiểm thử trên provider thật.
7. Đăng nhập bằng Google với **tranthanhtrivn@gmail.com** đã xác minh. Trigger database cấp admin lần đầu đúng một lần. Nếu dùng email/mật khẩu, mời email này từ Supabase Auth Dashboard, đặt mật khẩu và xác minh email. Không tạo user có `email_confirmed_at` bằng dữ liệu giả trong production.
8. Các tài khoản khác phải có lời mời hợp lệ. Một danh tính Supabase Auth không có lời mời có thể được tạo bởi OAuth nhưng **không có profile ứng dụng và không được đọc dữ liệu**. Không tự gán role từ user metadata.
9. Trên Sites, lưu các biến `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` bằng công cụ quản lý environment của Sites rồi deploy lại. Không lưu secret trong hosting manifest.

### Tài khoản và mật khẩu

- Email có profile không thể mời lại; admin chỉnh role/khóa trong Tài khoản.
- Email mời mở ứng dụng để xác thực. Người dùng có thể dùng “Quên mật khẩu” để đặt mật khẩu sau khi xác thực, hoặc đăng nhập Google/Facebook cùng email.
- Nếu Supabase từ chối gửi lại vì danh tính Auth đã tồn tại nhưng chưa có profile, quản trị viên cần kiểm tra danh tính đó trong Supabase Dashboard, xác minh tình trạng và gửi lại email xác thực/khôi phục. Endpoint trả lỗi rõ ràng, không báo gửi thành công giả.
- Employee/parents chỉ có màn hình chào; chỉ đọc profile của chính họ. UI và quyền truy cập hồ sơ của các role đó sẽ được làm ở giai đoạn sau.

## Chức năng

- Mở trực tiếp lịch dạy; tổng giờ theo bộ lọc, chi tiết thu gọn và danh sách việc cần xử lý.
- Lịch ngày/tuần/tháng/danh sách; lọc nhân sự, học sinh, hình thức, trạng thái. Kéo thả mở form xác nhận.
- Lặp theo các ngày trong tuần, tối đa một năm mỗi lần tạo. Thay đổi riêng một buổi hoặc các buổi chưa hoàn thành tiếp theo trong chuỗi, lưu nguyên tử.
- Giờ kế hoạch không gồm buổi hủy; giờ thực dạy chỉ gồm hoàn thành. Vắng tính 0 thực dạy. Thay đổi thời lượng cần lý do.
- Tạo/sửa/ngừng hoạt động employee/student/parent; phân công chính/phối hợp; gia đình nhiều–nhiều.
- Mục tiêu, nhật ký từng buổi và bản tổng hợp theo tuần. Snapshot mục tiêu độc lập giữa các tuần.
- Lời mời qua server, role trong database, chống ghi đè bằng version, audit cho mọi thay đổi, bảo vệ admin cuối cùng.

## Kiểm tra

```sh
npm run test
npm run typecheck
npm run build
```

Test domain kiểm tra mốc tuần theo Việt Nam, cộng giờ và trùng lịch. Test database bổ sung trong `tests/database.mjs` chạy bằng PostgreSQL WASM (PGlite); xem hướng dẫn trong file. Kiểm thử OAuth, SMTP và restore backup phải được thực hiện trên project thật sau cấu hình.

## Vận hành

Tách project thử nghiệm và production. Chọn chính sách backup phù hợp gói Supabase, xuất backup trước migration và thử khôi phục vào project thử nghiệm trước khi nhập hồ sơ thật. Kiểm tra lỗi đăng nhập/gửi email trong Supabase Logs; audit nghiệp vụ nằm trong `audit_log`, chỉ admin được đọc. App không ghi token hoặc ghi chú học sinh vào console.

Bản đầu tải toàn bộ dữ liệu admin theo từng trang 1.000 hàng; phù hợp triển khai ban đầu. Khi dữ liệu lớn, chuyển lịch/hồ sơ sang truy vấn theo khoảng ngày và phân trang UI trước khi mở rộng sử dụng.
