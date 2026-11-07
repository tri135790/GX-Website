# Gánh Xiếc — Không gian quản trị

Website quản lý lịch dạy 1–1, nhân sự, học sinh, phụ huynh và tiến trình tuần. React/TypeScript, Vite, FullCalendar và Supabase PostgreSQL/Auth.

## Chạy local

```sh
npm ci
npm run dev
```

Mở http://localhost:5173. Khi chưa cấu hình Supabase, ứng dụng hiện **bản xem thử** có nhãn rõ ràng. Dữ liệu mẫu chỉ nằm trong bộ nhớ trình duyệt, mất khi tải lại. Không nhập hồ sơ thật vào bản này. Khi có cấu hình Supabase, bản mẫu tự tắt và người dùng phải đăng nhập.

## Kết nối Supabase

Xem hướng dẫn từng bước, kiểm thử và deploy trong [docs/DEPLOY.md](docs/DEPLOY.md).

1. Database: chạy các migration 001, 002, 003 trong `supabase/migrations/` theo thứ tự, mỗi file một lần. Project đã có database chỉ chạy migration còn thiếu; 003 bổ sung hồ sơ cá nhân.
2. Frontend: copy `.env.example` thành `.env.local`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`).
3. Supabase Auth: cấu hình Site URL/Redirect URLs, OAuth và SMTP.
4. Deploy Edge Function `invitations`, đặt `APP_URL` bằng URL website. Secret chỉ ở Supabase.
5. GitHub: thêm hai variables công khai như bước 2, chọn Pages → GitHub Actions, push `main`. Workflow đã có sẵn.

Xem [hướng dẫn deploy đầy đủ](docs/DEPLOY.md), gồm cả domain gốc và project path.

### Tài khoản và mật khẩu

- Email có profile không thể mời lại; admin chỉnh role/khóa trong Tài khoản.
- Email mời xác thực tài khoản rồi mở trang đặt mật khẩu và xác nhận → nhập họ tên, số điện thoại, địa chỉ → hoàn tất. Áp dụng cho admin, employee và parents. Tên tự nhập được dùng trong giao diện tài khoản.
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
