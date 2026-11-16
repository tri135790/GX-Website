# Lịch làm việc — migration 005

## Quy tắc đã triển khai

- Ngày làm việc T2–T6, 6 giờ/ngày/người; cuối tuần định mức 0.
- Tổng giờ làm = Tư vấn + Trị liệu + Khác (họp, báo cáo đánh giá, dữ liệu cũ chưa phân loại).
- Vắng không cộng giờ, không giảm định mức. Một ngày vắng hoàn toàn vẫn có 6 giờ trống.
- Trống = tổng max(0, 6 giờ − giờ làm) theo từng ngày làm việc và từng nhân sự. Giờ vượt tính riêng; làm thêm hôm khác hoặc của người khác không xóa giờ trống của ngày vắng.
- Định mức theo nhân sự đang hoạt động hiện tại. Chưa có lịch sử hợp đồng/ngày vào-nghỉ việc, nên không dùng chỉ số này thay bảng công lịch sử khi nhân sự đã đổi trạng thái.
- Lọc thời gian/nhân sự thay đổi định mức; lọc học sinh/địa điểm/loại/trạng thái chỉ đổi các nhóm giờ hiển thị. Giờ trống luôn dựa trên tất cả công việc của nhân sự trong khoảng thời gian.
- Giờ mới lưu không cần duyệt. Khi hết giờ, tự được cộng theo thời lượng; giờ tương lai chưa cộng. Không có tác vụ nền: RPC/read adapter tính trạng thái và số phút tại thời điểm tải. Trong bảng SQL gốc, bản ghi tự tính có thể vẫn là scheduled/0 phút; các màn hình ứng dụng dùng phép tính thống nhất. Tải lại khi cần cập nhật tại thời điểm vừa kết thúc.
- Giờ admin xác nhận/điều chỉnh từ trước giữ thời lượng thực tế đã ghi. Khi chỉnh thời lượng khác khung giờ, vẫn cần lý do.

## Nhập lịch

- Admin: chọn loại công việc, nội dung, thời gian. Tư vấn/trị liệu cần học sinh và địa điểm; họp/vắng cho chọn nhiều nhân sự. Mỗi người có một bản giờ riêng cùng nhóm, lưu nguyên khối. Khi sửa sau đó, form ghi rõ đang sửa phần giờ của một nhân sự; không âm thầm sửa người khác.
- Employee: tự tạo tư vấn/trị liệu/họp/báo cáo của chính mình. Tự gán danh tính từ phiên đăng nhập. Tư vấn/trị liệu chỉ dành cho học sinh đang được phân công; cần chọn học sinh và địa điểm. Họp/báo cáo chỉ cần loại, nội dung và thời gian; có tùy chọn lặp.
- Employee không tự thêm người khác vào họp và không tạo lịch vắng; admin quản lý hai việc đó. Quyền sửa lịch cũ vẫn thuộc admin, Employee giữ quyền ghi nội dung/note đã có.
- Vắng cả ngày lưu khoảng 00:00–00:00 ngày kế tiếp, hiển thị dòng Cả ngày và chặn trùng giờ trong ngày. Có chọn nhiều nhân sự và lặp nhiều ngày.
- Giữ tạo lịch lặp, chọn ngày trong tuần, sửa các buổi chưa hoàn thành tiếp theo và kéo thả rồi xác nhận bằng form. Hủy yêu cầu lý do.

## Địa điểm và nhận diện

- Logo tải từ URL người dùng cung cấp, lưu `public/logo.png`. Favicon SVG nhúng nguyên ảnh gốc và chỉ hiển thị vùng biểu tượng; không phụ thuộc máy chủ WordPress khi chạy.
- Cài đặt chỉ dành admin: thêm/đổi tên/ngừng dùng địa điểm, phân loại offline/online. Bốn lựa chọn đầu tiên: NƯƠNG, NEO, NÂNG, ONL.
- Link online là trường riêng, không đưa lên lịch toàn tổ chức. Lịch hiển thị tên địa điểm thay ON/OFF. Tên địa điểm đã ghi được giữ làm lịch sử khi đổi tên phòng.
- Parent chỉ nhận tư vấn/trị liệu và lịch cũ có liên kết con; không nhận họp, báo cáo hay lịch vắng nội bộ.

## Chuyển dữ liệu cũ

- Migration không đoán loại công việc cũ: đánh dấu legacy/Chưa phân loại, tổng giờ cũ vẫn giữ trong Khác và có chỉ báo. Admin mở từng giờ để chọn tư vấn/trị liệu và địa điểm mới.
- Trạng thái Học sinh vắng cũ được chuyển sang Hủy, giữ lý do và audit. UI không còn lựa chọn Học sinh vắng.
- Giờ cũ chưa hoàn thành và chưa bật tự ghi nhận vẫn cần xử lý như trước; không tự cộng toàn bộ lịch quá khứ.

## Triển khai

1. Sao lưu database trước khi thay đổi. Kiểm tra đã áp dụng migrations 001–004.
2. Chạy toàn bộ `supabase/migrations/005_work_hours.sql` **một lần** trong Supabase SQL Editor. Không chạy lại 001–004.
3. Deploy frontend sau migration (commit/push GitHub Pages). Không cần deploy lại Edge Function lời mời.
4. Admin kiểm tra Cài đặt, bốn địa điểm, phân loại các giờ cũ khi cần.
5. Dùng admin, Employee và Parent thật để kiểm tra một giờ trị liệu, tư vấn, họp hai người, vắng cả ngày và quyền truy cập. Xác nhận Parent không thấy công việc nội bộ.

Chưa áp dụng migration, push hoặc deploy production trong đợt làm local này. Bản khôi phục từ GitHub không có `.env.local`; tạo từ `.env.example` và điền URL/publishable key của project khi chạy với dữ liệu thật. Không đặt secret key vào frontend.

## Kiểm tra

```sh
npm run typecheck
npm run lint
npm test
npm run build
PGLITE_ROOT=/path/to/node_modules/@electric-sql/pglite node tests/work-database.mjs
```

Bộ PostgreSQL kiểm tra migration trên dữ liệu cũ có học sinh vắng; quyền tạo giờ của chính mình; chống giả mạo nhân sự; học sinh ngoài phân công; số phút tự tính; chặn trùng; rollback nhóm; tổng giờ họp; vắng cả ngày; dữ liệu Parent; phiên bản địa điểm; phòng ngừng dùng; giờ tương lai; quyền bị thu hồi và audit.
