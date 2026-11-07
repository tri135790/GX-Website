# Deploy Gánh Xiếc: GitHub Pages + Supabase

Frontend hiện dùng React + Vite, build ra `dist/index.html`. GitHub Pages host giao diện; Supabase cung cấp PostgreSQL/Auth/RPC và Edge Function `invitations`. Không cần Vinext, Cloudflare Worker hoặc API server trên GitHub.

Bạn đã tạo repository và chạy migration: **bỏ qua việc tạo lại database; không chạy lại migration 001**.

## 1. Cấu hình frontend

Supabase → Project Settings/API Keys: lấy Project URL và **Publishable key** (`sb_publishable_...`). Không dùng secret key cho frontend.

Trong thư mục `ganh-xiec`:

```sh
cp .env.example .env.local
```

Điền `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_BASE_PATH=/
```

Chạy `npm ci` và `npm run dev`. Local không có cả hai biến sẽ mở bản mẫu; build production thiếu biến sẽ báo lỗi cấu hình, không mở dữ liệu mẫu. File `.env.local` không được commit. Sau khi đổi biến, khởi động lại Vite/build lại.

## 2. Cấu hình Supabase Auth

Authentication → URL Configuration:

- Site URL: `https://USERNAME.github.io/`.
- Redirect URLs: `https://USERNAME.github.io/` và `http://localhost:5173/`.
- Nếu repository là project site, dùng `https://USERNAME.github.io/REPO/` cho cả Site URL và redirect. Local đặt `VITE_BASE_PATH=/REPO/` thì thêm `http://localhost:5173/REPO/`.

Bật Google/Facebook provider nếu dùng, điền Client ID/Secret ở Supabase; callback bên Google/Meta dùng URL Supabase cung cấp (`https://PROJECT_REF.supabase.co/auth/v1/callback`). Cấu hình custom SMTP cho email mời và khôi phục.

Admin đầu tiên: đăng nhập và xác minh đúng `tranthanhtrivn@gmail.com`. Trigger migration cấp role lần đầu. User khác cần lời mời hợp lệ; không cấp quyền từ metadata trình duyệt.

## 3. Deploy Edge Function gửi lời mời

Thực hiện từ thư mục `ganh-xiec` (có `supabase/config.toml`):

```sh
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase secrets set APP_URL=https://USERNAME.github.io/
npx supabase functions deploy invitations
```

Project site: thay APP_URL bằng `https://USERNAME.github.io/REPO/`.

`APP_URL` là địa chỉ đầy đủ trả về sau khi nhận lời mời. CORS tự lấy origin từ địa chỉ đó. Function production chỉ cho phép frontend trên origin này; thử lời mời local cần function/project thử nghiệm với APP_URL local.

SDK `@supabase/server@1.9.2` đọc URL, publishable keys, secret keys và JWKS do Supabase cung cấp. Function dùng `auth: 'user'`, kiểm tra issuer/audience, sau đó đọc role/active trong database trước khi sử dụng admin client. `verify_jwt = false` chỉ tắt gateway legacy check để hỗ trợ khóa ký JWT mới; **không tắt xác thực trong handler**. Project cần JWT signing key bất đối xứng (ES256/RS256) có trên JWKS.

Nếu Logs báo thiếu key, kiểm tra môi trường Function có `SUPABASE_PUBLISHABLE_KEYS` và `SUPABASE_SECRET_KEYS`. Không thêm khóa server vào VITE, GitHub Pages hoặc repository. SDK hỗ trợ key mới, không cần cấu hình legacy service_role trong frontend.

Lời mời ứng dụng có hạn 7 ngày; link email có thời hạn riêng của Supabase. Nếu email đã tồn tại trong Auth nhưng chưa có profile, Supabase có thể từ chối mời lại; kiểm tra Auth Dashboard và gửi email khôi phục/xác thực phù hợp. Không xóa user để xử lý tự động.

## 4. Cấu hình GitHub Actions

Repository → Settings → Secrets and variables → Actions → **Variables**, tạo:

| Tên | Giá trị |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |

Tên biến mới là **PUBLISHABLE_KEY**, không phải `VITE_SUPABASE_ANON_KEY` trong hướng dẫn cũ.

Repository → Settings → Pages → Source: **GitHub Actions**.

Workflow `.github/workflows/deploy.yml` đã có sẵn. Có bản ở root workspace và root app để hỗ trợ cả repository chứa thư mục `ganh-xiec` lẫn repository chỉ chứa nội dung app. GitHub chỉ chạy bản ở root repository; workflow tự nhận thư mục app và base path của Pages. Không cần sửa YAML để dùng project site.

Commit/push các thay đổi lên branch `main` của repository bạn đã tạo. Không tạo repository lồng nhau nếu đã kết nối remote cho workspace. Kiểm tra trước bằng:

```sh
git status
git remote -v
```

Chỉ thêm source/config cần thiết, không thêm `.env.local`, hồ sơ thật hoặc khóa bí mật. Workflow sẽ chạy `npm ci`, typecheck, tests, build và deploy `dist`. Thiếu biến Supabase hoặc dùng sai loại key sẽ dừng pipeline trước deploy.

Mở tab Actions để xem kết quả. URL website nằm trong Settings → Pages và deployment `github-pages`. Mỗi push lên `main` sẽ deploy lại frontend. Thay đổi Edge Function cần deploy riêng bằng lệnh bước 3; workflow không tự sửa database hoặc deploy function.

## 5. Nghiệm thu

1. Mở domain GitHub: thấy đăng nhập, không có bản dữ liệu mẫu.
2. Đăng nhập admin đầu tiên, kiểm tra profile role `admin` và active.
3. Tạo nhân sự, học sinh, phụ huynh; phân công và liên kết.
4. Tạo/sửa buổi học, hoàn thành, cập nhật tiến trình; tải lại trang, kiểm tra dữ liệu vẫn còn.
5. Mời một email khác; mở email, đặt mật khẩu, kiểm tra role đúng.
6. Tài khoản employee/parents không truy cập UI quản trị; hiện chỉ có màn hình chào và quyền đọc profile của chính mình.
7. Kiểm tra OAuth và quên mật khẩu quay lại đúng domain/path GitHub.

## Kiểm tra local

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Tests Edge Function chạy handler thật với JWT ký trong test và upstream Supabase giả lập, kiểm tra từ chối anonymous/token sai/non-admin/admin bị khóa, revoke, gửi email và lỗi SMTP. Các test không gửi email hoặc gọi database thật. Kiểm thử cloud/SMTP/OAuth thực tế vẫn cần cấu hình project của bạn.

Tài liệu chính thức: [Vite + GitHub Pages](https://vite.dev/guide/static-deploy), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
