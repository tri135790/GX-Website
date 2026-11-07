# Triển khai Gánh Xiếc: Supabase → đăng nhập → website online

Tài liệu dành cho mã nguồn trong thư mục `ganh-xiec`. UI admin đã được triển khai; database thật, SMTP, Google/Facebook và hosting cần được cấu hình theo các bước dưới đây. Đây là hướng dẫn, không phải thông báo đã deploy hoặc đã kiểm thử trên project Supabase của bạn.

## 1. Chuẩn bị thông tin của project Supabase đã tạo

Trong Dashboard của đúng project, mở **Connect** hoặc **Project Settings → API / API Keys** và lấy:

| Biến ứng dụng đang dùng | Giá trị cần điền | Phạm vi |
|---|---|---|
| `SUPABASE_URL` | Project URL dạng `https://PROJECT_REF.supabase.co` | Public |
| `SUPABASE_ANON_KEY` | Publishable key `sb_publishable_...`, hoặc legacy anon key | Public, RLS bảo vệ dữ liệu |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key `sb_secret_...`, hoặc legacy service_role key | Chỉ server; dùng gửi lời mời |
| `APP_URL` | Origin website, không có path phía sau | Local: `http://localhost:5173`; production: URL HTTPS thật |

Tên biến giữ nguyên như bảng dù bạn dùng loại key mới. Không dùng password database thay cho API key. Không gửi secret key vào chat, ảnh chụp, Git hoặc file public. [Tài liệu API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 2. Khởi tạo database đúng một lần

1. Mở **SQL Editor → New query** trong project Supabase.
2. Kiểm tra project chưa có schema Gánh Xiếc:

```sql
select to_regclass('public.bootstrap') as bootstrap,
       to_regclass('public.profiles') as profiles,
       to_regclass('public.lessons') as lessons;
```

3. Với project mới, cả ba giá trị phải là `NULL`. Nếu đã có bảng từ một ứng dụng khác hoặc đã chạy migration này, dừng và kiểm tra; không chạy lại hoặc xóa bảng để thử.
4. Mở `supabase/migrations/001_ganh_xiec.sql` trong mã nguồn, sao chép **toàn bộ file** vào SQL Editor và Run. File đã có transaction `begin/commit`.
5. Kiểm tra kết quả:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('employees','students','parents','assignments','families',
    'lessons','goals','weekly','profiles','invitations','audit_log','bootstrap')
order by tablename;

select email, claimed_by from public.bootstrap;
```

Phải có 12 bảng, tất cả bật RLS (`rowsecurity = true`). Bootstrap có email `tranthanhtrivn@gmail.com`, `claimed_by` còn trống trước lần xác thực đầu tiên. Không tắt RLS để xử lý lỗi truy cập.

Migration tạo bảng, liên kết, chống trùng lịch, hàm lưu nguyên tử `save_bundle`, version chống ghi đè, audit và trigger cấp quyền cho danh tính đã xác minh. Không tạo hồ sơ học sinh mẫu trên database thật.

## 3. Kết nối bản local

Mở Terminal trong thư mục dự án:

```sh
cd "/Users/thanhtritran/Documents/ChatGPT/GX Website/ganh-xiec"
cp -n .env.example .dev.vars
```

Mở `.dev.vars` bằng trình soạn thảo và điền bốn biến ở bước 1. Ví dụ dưới đây chỉ là placeholder:

```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SECRET_KEY
APP_URL=http://localhost:5173
```

Dùng `.dev.vars` cho runtime Cloudflare local của dự án. File này đã được Git ignore. Không điền cả `.dev.vars` và `.env.local` với giá trị khác nhau. [Cách Cloudflare nạp biến local](https://developers.cloudflare.com/workers/local-development/environment-variables/).

Nếu server cũ đang chạy, dừng nó trong terminal bằng Ctrl+C trước khi chạy lại:

```sh
npm ci
npm run dev
```

Mở `http://localhost:5173`. Khi kết nối đúng, website hiện màn hình đăng nhập và **không còn nhãn dữ liệu mẫu**. Có thể xem `/api/config`: `configured` phải là `true`, URL đúng project; phản hồi chỉ chứa public key, tuyệt đối không có server secret. `configured=true` xác nhận đã nạp cấu hình, chưa chứng minh migration hay đăng nhập hoạt động.

## 4. Cấu hình Supabase Auth, email và admin đầu tiên

### URL và email

1. Trong **Authentication → URL Configuration**:
   - Site URL khi thử local: `http://localhost:5173`.
   - Redirect URLs: thêm `http://localhost:5173` và `http://localhost:5173/`.
   - Khi có URL production, thêm chính xác origin production, cả dạng có/không dấu `/` cuối; đổi Site URL sang production.
2. Trong **Authentication → Sign In / Providers**, bật Email và xác minh email. Giữ khả năng tạo danh tính Auth mới nếu muốn Google/Facebook có thể đăng nhập lần đầu. Ứng dụng không có form đăng ký mở: quyền được cấp bởi bảng lời mời/trigger, không phải chỉ vì có một `auth.users`.
3. Trong **Authentication → Email / SMTP Settings**, bật custom SMTP. Điền sender, host, port, username, password theo nhà cung cấp email của bạn; hoàn thành xác thực domain gửi email theo yêu cầu nhà cung cấp. Giữ mẫu link xác thực mặc định dùng `{{ .ConfirmationURL }}` để client xử lý token.
4. Gửi thử tới một email ngoài đội ngũ quản trị Supabase. Dịch vụ email mặc định của Supabase không phù hợp để mời phụ huynh/giáo viên bên ngoài. [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

**Hai thời hạn khác nhau:** bản ghi lời mời của Gánh Xiếc tồn tại 7 ngày; link trong email hết hạn theo **Email OTP Expiration** của Supabase, mặc định 1 giờ. Không đặt 604800 giây trong Dashboard theo README cũ. Giữ thời hạn link ngắn và mở ngay khi nhận. Link hết hạn không đồng nghĩa bản ghi lời mời đã hết hạn. [Invitation links](https://supabase.com/docs/guides/auth/users), [Email OTP expiration](https://supabase.com/docs/guides/auth/auth-email-passwordless).

### Admin đầu tiên

Chọn một trong hai cách:

- **Google:** hoàn thành bước Google bên dưới rồi đăng nhập bằng đúng `tranthanhtrivn@gmail.com`.
- **Email/mật khẩu:** trong Supabase **Authentication → Users → Invite user**, mời đúng `tranthanhtrivn@gmail.com`. Người sở hữu email mở link, đặt mật khẩu và xác minh. Không tự sửa `email_confirmed_at` để bỏ qua xác minh.

Sau khi đăng nhập, chạy truy vấn đọc trong SQL Editor:

```sql
select email, role, active from public.profiles
where lower(email) = 'tranthanhtrivn@gmail.com';
select email, claimed_by from public.bootstrap;
```

Kết quả mong đợi: `role = admin`, `active = true`, `claimed_by` đã có UUID. Nếu email này từng được tạo trong Auth trước khi chạy migration, đăng xuất và đăng nhập lại để trigger xử lý lần đăng nhập mới.

### Google

1. Tạo OAuth web client trong Google Cloud / Google Auth Platform của bạn, cấu hình consent screen và test users nếu app đang ở chế độ thử nghiệm.
2. Trong Supabase provider Google, sao chép **Callback URL** được hiển thị.
3. Trong Google OAuth client, đặt callback đó làm **Authorized redirect URI**. Dạng thường gặp: `https://PROJECT_REF.supabase.co/auth/v1/callback` — không thay nó bằng URL website.
4. Điền Client ID và Client Secret vào Supabase Google provider, bật provider và lưu.
5. Thử nút Google từ website; sau xác thực phải quay về đúng origin website. [Hướng dẫn Google chính thức](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

### Facebook

1. Tạo/cấu hình Facebook Login app trong Meta for Developers.
2. Thêm callback Supabase vào **Valid OAuth Redirect URIs**.
3. Cấu hình quyền email; nhập App ID và App Secret vào provider Facebook trên Supabase, bật provider.
4. Thử bằng tài khoản có quyền test app; hoàn tất yêu cầu đưa app sang Live và các yêu cầu review/URL chính sách theo giao diện Meta trước khi mời người ngoài.
5. Thử với email trùng lời mời. Nếu provider không trả email hợp lệ, dùng email/mật khẩu hoặc Google cùng email đã mời. [Hướng dẫn Facebook chính thức](https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook).

## 5. Kiểm thử database thật trước khi deploy

Dùng dữ liệu giả có nhãn TEST cho vòng kiểm tra này:

1. Đăng nhập admin → tạo employee `TEST Giáo viên`.
2. Tạo học sinh `TEST Học sinh`, chọn employee đó làm người phụ trách chính; tạo phụ huynh TEST và liên kết với học sinh.
3. Tạo buổi offline và online; tạo một chuỗi lặp. Tải lại trang: hồ sơ và buổi học phải còn nguyên.
4. Thử tạo buổi trùng giáo viên/học sinh: phải bị từ chối. Buổi liền kề phải lưu được.
5. Mở buổi, xác nhận hoàn thành 60 phút: tổng thực dạy tăng 1 giờ. Đổi thành 45 phút phải nhập lý do; hủy/vắng tính 0 giờ thực dạy.
6. Thêm mục tiêu, ghi tiến trình tuần; chuyển tuần rồi quay lại: nội dung cũ giữ nguyên. Kiểm tra người cập nhật và thời điểm.
7. Mời một email thử thật với role employee, gắn hồ sơ employee. Mở email và xác minh trong cửa sổ trình duyệt khác. Người này chỉ thấy màn hình chào, không đọc được hồ sơ admin.
8. Thử email Google chưa được mời: có thể có danh tính Auth nhưng không có quyền ứng dụng.
9. Thử khóa một tài khoản test; kiểm tra phiên đang đăng nhập không còn đọc được dữ liệu. Không dùng admin cuối cùng cho thử nghiệm khóa.
10. Đối chiếu dữ liệu trong Table Editor và `audit_log` để xác nhận thao tác đã ghi lên PostgreSQL, không chỉ ở bộ nhớ UI.

**Giới hạn hiện có:** gửi lại lời mời có thể bị Supabase từ chối nếu danh tính Auth đã tồn tại; endpoint hiện báo lỗi rõ ràng. Khi gặp trường hợp đó, quản trị viên kiểm tra lời mời và danh tính trong Dashboard rồi xử lý link xác thực/khôi phục phù hợp. Không xóa user có profile để thử lại. Tính năng gửi lại tự động cho mọi trường hợp cần được cải tiến riêng trước khi cam kết toàn bộ luồng mời là production-ready. UI employee/parents vẫn thuộc giai đoạn sau; bản này kiểm thử end-to-end cho admin.

## 6. Deploy website lên Sites với Supabase đã cấu hình

Dự án đang dùng **Vinext + Cloudflare Worker** và có Sites ID trong `.openai/hosting.json`. Không deploy thư mục này như trang HTML tĩnh hay chọn mặc định Next.js trên Vercel.

Site đã được đăng ký nhưng **chưa xuất bản**. Origin dự kiến được trả về khi tạo site:

`https://ganh-xiec-admin-tri.grandalto3.chatgpt.site`

Đây chưa phải link live. Trước khi triển khai cần đọc lại trạng thái Sites để xác nhận origin còn đúng.

Thứ tự triển khai qua Codex/Sites:

1. Hoàn thành các bước 1–5 và giữ key trong `.dev.vars` ở máy. Chỉ cung cấp URL/public key trong chat nếu cần; server secret không gửi vào chat.
2. Xác nhận riêng việc đưa mã nguồn, dữ liệu mẫu và email bootstrap lên Sites. Lần trước kiểm duyệt tự động đã chặn vì chưa có xác nhận cụ thể; việc viết hướng dẫn hoặc chỉnh UI không tự thay thế xác nhận đó.
3. Sau khi được phép, Codex dùng Site hiện có, lưu bốn biến môi trường bằng công cụ Sites; đánh dấu `SUPABASE_SERVICE_ROLE_KEY` là secret. `APP_URL` lúc này bằng origin production, không phải localhost. Không lưu các giá trị này vào `.openai/hosting.json` hay source.
4. Cập nhật Supabase Site URL / Redirect URLs sang origin production như bước 4. Google/Meta vẫn trỏ về callback Supabase, không đổi sang origin production.
5. Chạy `npm run test`, `npm run typecheck`, build; đồng bộ đúng mã nguồn, đóng gói Worker và lưu/deploy phiên bản đó. Chờ trạng thái `succeeded` và URL trả về mới xác nhận online.
6. Deploy riêng tư trước để admin kiểm thử production. Sites có cổng truy cập riêng ngoài Supabase: người được mời trong ứng dụng không tự có quyền vào một Site owner-private. Trước khi đưa cho employee/parents, cần quyết định cấu hình người xem của Sites riêng; không tự đổi site thành public.
7. Lặp lại các bước kiểm thử chính trên URL production: admin login, tạo/sửa dữ liệu rồi reload, gửi lời mời, Google/Facebook callback, từ chối tài khoản không quyền.

Nếu muốn tự deploy bằng tài khoản Cloudflare của bạn hoặc hosting khác thay vì Sites, cần chuẩn bị cấu hình hosting tương ứng riêng; đừng dùng lệnh deploy giả định của Next.js/Vercel cho bản mã hiện tại.

## 7. Chẩn đoán lỗi nhanh

| Triệu chứng | Kiểm tra |
|---|---|
| Vẫn thấy dữ liệu mẫu | Thiếu URL/public key trong runtime; restart local sau khi sửa `.dev.vars`, deploy lại sau khi sửa env Sites |
| `configured=true` nhưng không tải được hồ sơ | Sai project/key, chưa chạy migration, hoặc lỗi trong Supabase Logs |
| Đã đăng nhập nhưng không có quyền | Email chưa xác minh, không trùng bootstrap/lời mời, lời mời hết hạn/thu hồi; kiểm tra `profiles` |
| `Database error saving new user` | Kiểm tra trigger `claim_identity`, bảng liên kết và Postgres Logs; không tắt trigger/RLS để chữa tạm |
| Email không đến | SMTP, domain gửi, rate limit, Spam và Auth Logs |
| Link quay về localhost ở production | Sửa `APP_URL`, Supabase Site URL và allowlist redirect; gửi lại link sau cấu hình |
| Facebook lỗi | Provider chưa bật, callback sai, thiếu quyền email hoặc app chưa cho người ngoài đăng nhập |
| Báo chưa cấu hình gửi lời mời | Thiếu `SUPABASE_SERVICE_ROLE_KEY` hoặc `APP_URL` trong runtime server |
| Save bị từ chối | Đọc lỗi nghiệp vụ: trùng giờ, thiếu phụ trách chính, version cũ hoặc admin cuối cùng; không chỉnh trực tiếp bảng để bỏ ràng buộc |
| Có lời mời 7 ngày nhưng link email hết hạn | Hai thời hạn khác nhau; xem bước 4 và kiểm tra tình trạng danh tính trước khi gửi lại |

Trước khi nhập hồ sơ thật: xác nhận backup phù hợp gói Supabase và thử khôi phục vào project thử nghiệm. Website chỉ được coi là hoạt động end-to-end khi các bước kiểm thử ở môi trường production đã đạt, không chỉ khi build thành công.
