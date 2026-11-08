# Kế hoạch: Đăng nhập Google-first, bỏ Facebook, bỏ bắt buộc mật khẩu khi nhận lời mời

> **Trạng thái:** đã duyệt, **chưa triển khai** — lưu ngày 08/11/2026.
> Phần code thử nghiệm đã được revert; repo đang ở commit `fcc35d3`.
> Khi bắt đầu làm, đọc lại mục 0 (Google Cloud) và mục 1 (điều kiện tiên quyết GitHub Pages).

## 0. Trả lời trực tiếp: Google Cloud là gì, của ai?

| Câu hỏi | Trả lời |
|---|---|
| Vì sao cần Google Cloud? | Muốn có nút "Đăng nhập bằng Google", mỗi ứng dụng phải tự đăng ký một **OAuth Client** + **consent screen** với Google. Google dùng thông tin đó để biết app nào đang xin đăng nhập, hiển thị tên "Gánh Xiếc", email hỗ trợ và trang chủ cho người dùng trước khi họ đồng ý. Supabase **không cung cấp sẵn** OAuth client của Google; Supabase chỉ giữ Client ID/Secret và làm callback trung gian. |
| Là Google Cloud của ai? | **Của Gánh Xiếc/trung tâm**, tạo bằng tài khoản Google của trung tâm — không phải của Supabase, không phải của lập trình viên. Khuyến nghị tạo tài khoản riêng (ví dụ `ganhxiec@gmail.com`), thêm 2 owner và bật 2FA để không phụ thuộc một nhân viên. |
| Tốn tiền không? | **Miễn phí**, không cần thẻ. Chỉ tốn tiền nếu sau này dùng các dịch vụ Google Cloud khác. |
| Người dùng/phụ huynh cần gì? | Chỉ tài khoản Google (Gmail) của họ. Họ không cần Google Cloud, không cần cài gì. |
| Supabase giữ gì? | Client ID + Client Secret trong `Auth → Providers → Google`; callback cố định: `https://passgmewpovbjybpyxko.supabase.co/auth/v1/callback`. |

**Ràng buộc quan trọng với GitHub Pages:** Google yêu cầu *Authorized Domain* của consent screen là domain riêng. `github.io` là public suffix nên Google từ chối (lỗi "Domain not found", không publish được — [ví dụ thực tế](https://discuss.google.dev/t/google-oauth-domain-not-found-for-verified-github-pages-domain/404025)). Hệ quả:

- **Có domain riêng** (ví dụ `ganhxiec.vn` trỏ về GitHub Pages): publish OAuth app bình thường, không giới hạn người dùng.
- **Chưa có domain:** chỉ chạy **Testing mode** — tối đa 100 test user (phải thêm từng Gmail), hiện cảnh báo "ứng dụng chưa được xác minh". Vẫn dùng được để thử nghiệm.
- **Không muốn Google Cloud/domain:** chỉ dùng **OTP email 6 số** (không cần Google Cloud), nhưng mất ưu điểm một chạm Gmail.

Kế hoạch này triển khai code độc lập với domain; phần cấu hình mặc định Testing mode, và có cổng chuyển sang domain riêng trước khi mở cho phụ huynh thật.

---

## 1. Mục tiêu & tiêu chí thành công

1. Người được mời mở link → xác thực → hoàn thiện hồ sơ → vào app, **không phải đặt mật khẩu**.
2. Lần đăng nhập sau: bấm **"Tiếp tục với Google"**, chọn đúng Gmail là vào; Supabase tự liên kết cùng email, giữ nguyên role/hồ sơ.
3. Email không phải Google: đăng nhập bằng **mã OTP 6 số** gửi qua email.
4. Admin vẫn đăng nhập bằng mật khẩu và khôi phục mật khẩu; có thể dùng Google.
5. **Bỏ hoàn toàn Facebook** khỏi UI và tài liệu.
6. Không đổi schema database, không migration mới; luồng bảo mật hiện có (RLS, trigger `claim_identity`, chặn admin cuối) giữ nguyên.

**Điều kiện tiên quyết:** sửa GitHub Pages → Source = **GitHub Actions** để website hết 404; nếu không, không test được redirect OAuth trên domain thật.

---

## 2. Quyết định thiết kế

| Chủ đề | Quyết định |
|---|---|
| Phương thức chính | Google OAuth, nút lớn đầu tiên |
| Dự phòng | Email OTP 6 số (`signInWithOtp` + `verifyOtp`), `shouldCreateUser: false` |
| Mật khẩu | Chỉ admin/người dùng cũ đã có mật khẩu; ẩn sau link nhỏ "Quản trị viên" |
| Lời mời | Giữ cơ chế `inviteUserByEmail` hiện tại, nhưng đổi marker redirect `?auth=invite`; link mời **không** mở trang đặt mật khẩu nữa mà mở thẳng hồ sơ |
| Khôi phục mật khẩu | Giữ nguyên, marker `?auth=recovery` |
| Tương thích link cũ | `?auth=password` (link đã gửi) được hiểu là `recovery`; link có `type=invite` vẫn nhận diện là invite |
| Facebook | Xoá nút, type `'facebook'`, CSS `.facebook-f`, tài liệu |
| DB | Không migration; `profiles`, `complete_my_profile`, trigger `claim_identity` dùng lại |
| Trình duyệt in-app | Thêm cảnh báo khi phát hiện Zalo/Facebook/Messenger/Instagram/TikTok, hướng dẫn mở Safari/Chrome |
| 2FA/passkey/Zalo/SMS | Ngoài phạm vi lần này |

---

## 3. Thay đổi theo từng file

### 3.1 `lib/gx/auth-link.ts`
- Thêm `AuthLinkKind = 'invite' | 'recovery'` và trường `kind`, `error`, `errorDescription`.
- Phân loại:
  - `otpType === 'invite'` hoặc `?auth=invite` → `invite`.
  - `otpType === 'recovery'` hoặc `?auth=recovery` → `recovery`.
  - `?auth=password` (legacy) → `recovery` để an toàn.
- Giữ trường `password` hiện tại (main.tsx đang dùng) = `kind !== null || invalid`.
- Thêm `authPageUrl(base, kind)`; `passwordUrl(base)` thành alias của `authPageUrl(base, 'recovery')` để không phá callers.
- Giữ `tokenHash`, `otpType`; bổ sung đọc `error_description` cho lỗi OAuth.

### 3.2 `components/gx/password-page.tsx`
- Sau khi `verifyOtp`/`getSession` + `getUser` thành công:
  - `kind === 'invite'` → state `profile` (vào `ProfileSetup` ngay).
  - `kind === 'recovery'` → state `ready` (hiện `PasswordSetup`).
- Giữ marker đúng loại khi `history.replaceState` (`?auth=invite` hoặc `?auth=recovery`), không tự đổi invite thành password.
- Lỗi OAuth (`error_description`) hiển thị thông báo riêng + nút "Về trang đăng nhập", không dùng câu "liên kết hết hạn" gây hiểu nhầm.
- `PasswordSetup` chỉ còn dùng cho recovery; sau khi đặt mật khẩu → màn hình hoàn tất (không ép lại ProfileSetup).

### 3.3 `components/gx/auth.tsx`
- Viết lại `Login` với các mode: `start | otp | password | reset`.
- `start`: nút **"Tiếp tục với Google"** (icon G, full width) + link "Hoặc đăng nhập bằng email".
- `otp`: nhập email → gửi mã → nhập 6 số → xác thực; cooldown gửi lại 60 giây; thông báo trung tính ("Nếu email hợp lệ…").
- `password`: form email/mật khẩu ẩn sau link nhỏ "Quản trị viên đăng nhập bằng mật khẩu"; giữ "Quên mật khẩu?".
- Xoá nút Facebook và type `'facebook'`.
- Khi đã đăng nhập nhưng chưa có profile: hiển thị **email đang đăng nhập** + "Email này chưa được mời, hãy dùng đúng email trung tâm đã đăng ký" + nút Đăng xuất.
- Bỏ xử lý `type=invite` trong `useEffect`; chỉ giữ `type=recovery`.
- Dùng helper lỗi thân thiện cho các mã: `over_email_send_rate_limit`, `otp_expired`, `invalid_otp`, `signup_disabled`/`otp_disabled`, `provider_disabled`.

### 3.4 `components/gx/admin-app.tsx`
- `authSetup` chỉ bật với `type=recovery` / sự kiện `PASSWORD_RECOVERY`, không bật với invite.
- Lưu email phiên đăng nhập (`authEmail`) để truyền cho `Login` khi user không có profile.
- Không đổi logic phân quyền/onboarding.

### 3.5 `supabase/functions/invitations/index.ts`
- Đổi `redirect.searchParams.set('auth','password')` → `'invite'`.
- Giữ nguyên `inviteUserByEmail`, kiểm tra admin, thu hồi lời mời, audit.
- Cần deploy lại function sau khi sửa.

### 3.6 File mới
- `lib/gx/in-app-browser.ts`: `detectInAppBrowser(userAgent)` trả `zalo | facebook | messenger | instagram | tiktok | null`.
- `public/privacy.html`: trang chính sách bảo mật tối giản (dữ liệu thu thập, mục đích, nơi lưu, liên hệ, yêu cầu xoá) — **bắt buộc để publish OAuth app**; link ở footer màn đăng nhập.
- `tests/in-app-browser.test.ts`, `tests/auth-error.test.ts` (nếu tách helper lỗi).

### 3.7 CSS & tài liệu
- `app/globals.css`: xoá rule `.facebook-f`; thêm style cho OTP input và banner in-app browser (tái dùng `.notice`, `.error`, `.field`).
- `README.md`: cập nhật mục "Tài khoản và mật khẩu" — Google/OTP, không bắt đặt mật khẩu, bỏ Facebook.
- `docs/DEPLOY.md`: viết lại mục Auth: Google Cloud setup, giới hạn `github.io`, Testing mode, OTP template, redirect URLs mới (`?auth=invite`, `?auth=recovery`), quy trình deploy function, checklist nghiệm thu. Bỏ mọi hướng dẫn Facebook.

---

## 4. Luồng hoạt động sau thay đổi

**Lần đầu (được mời):**
Admin tạo hồ sơ + email → gửi lời mời → phụ huynh bấm link → `PasswordPage` xác thực email → `ProfileSetup` (họ tên, SĐT, địa chỉ) → vào app. Không có bước mật khẩu.

**Lần sau:**
- Còn phiên (Supabase session mặc định không hết hạn): vào thẳng.
- Đã đăng xuất/đổi máy: "Tiếp tục với Google" → auto-link theo email đã xác thực → vào.
- Không dùng Google: nhập email → mã 6 số → vào.

**Admin:** Google hoặc mật khẩu + quên mật khẩu (recovery).

**Link cũ:** `?auth=password` vẫn mở trang đặt mật khẩu (recovery) — không làm hỏng email đã gửi trước đây.

---

## 5. Cấu hình bên ngoài (không code)

1. **Google Cloud** (tài khoản trung tâm): tạo project → Branding (tên "Gánh Xiếc", email hỗ trợ, homepage, privacy URL) → Audience External/Testing → scopes `openid email profile` → OAuth Client Web:
   - Authorized JavaScript origins: `https://tri135790.github.io`, `http://localhost:5173` (và domain riêng nếu có).
   - Authorized redirect URI: `https://passgmewpovbjybpyxko.supabase.co/auth/v1/callback`.
2. **Supabase** → Auth → Providers → Google: bật, dán Client ID/Secret; tắt/để trống Facebook.
3. **Supabase** → URL Configuration: Site URL `https://tri135790.github.io/GX-Website/`; Redirect URLs thêm `...?auth=invite`, `...?auth=recovery`, `http://localhost:5173/**`.
4. **Email Templates**: "Magic Link" phải chứa `{{ .Token }}` để gửi mã 6 số; "Invite user" đổi nút thành "Kích hoạt tài khoản" (không nhắc đặt mật khẩu).
5. **Deploy function**: `npx supabase functions deploy invitations --project-ref passgmewpovbjybpyxko`; giữ `APP_URL`.
6. **Khi có domain riêng**: trỏ domain về GitHub Pages, bật HTTPS, đổi `VITE_BASE_PATH=/`, cập nhật Site URL/Redirect URLs/APP_URL/Google origins + Authorized Domain, rồi Publish OAuth app. Không cần đổi code.

---

## 6. Edge cases & cách xử lý

| Tình huống | Hành vi |
|---|---|
| Google email khác email được mời | Hiện email đang đăng nhập + hướng dẫn dùng đúng email/liên hệ admin; nút đăng xuất |
| Google account chưa được mời | Không tạo profile (trigger đã chặn); hiện thông báo chưa có lời mời |
| Link mời hết hạn/đã dùng | Màn hình lỗi + gửi lại liên kết mới |
| OTP hết hạn/sai | "Mã không đúng hoặc đã hết hạn", nút gửi lại |
| Gửi OTP quá nhiều | Thông báo chờ, cooldown 60s |
| Google provider chưa bật | Thông báo cấu hình, không lộ chi tiết kỹ thuật |
| Mở trong Zalo/Facebook | Banner "Mở bằng Safari/Chrome" trước khi bấm Google |
| User đã onboard | Vào thẳng, không hiện lại ProfileSetup |
| Tài khoản bị khoá | Giữ màn hình "Tài khoản đã tạm khóa" |
| Admin cuối | Không đổi, trigger/RPC hiện có vẫn bảo vệ |
| Auto-link Google với user chưa xác thực email | Kiểm thử ở bước nghiệm thu; nếu Supabase không link, thông báo yêu cầu mở link mời trước (không thêm code phức tạp) |

---

## 7. Kiểm thử & nghiệm thu

**Unit test cập nhật/mới:**
- `tests/auth-link.test.ts`: `?auth=invite` → invite; `?auth=recovery` → recovery; `?auth=password` legacy → recovery; `type=invite` + token_hash → invite; `passwordUrl` trả `?auth=recovery`; lỗi OAuth có `errorDescription`.
- `tests/invitations.test.mjs`: redirect mong đợi `...?auth=invite`.
- `tests/in-app-browser.test.ts`: nhận diện Zalo/Facebook/Messenger, Chrome/Safari trả null.
- `tests/auth-error.test.ts` (nếu tách helper): map mã lỗi sang tiếng Việt.

**Kiểm thử tay trên URL đã deploy (bắt buộc):**
1. Mời Gmail A → mở link ẩn danh → hoàn thiện hồ sơ → vào app, **không có bước mật khẩu**.
2. Đăng xuất → "Tiếp tục với Google" bằng A → vào đúng hồ sơ cũ, không tạo tài khoản trùng.
3. Mời email không phải Google → link mời → hồ sơ; đăng xuất → OTP → vào.
4. Google B chưa được mời → thấy thông báo đúng, không vào được dữ liệu.
5. Admin đăng nhập mật khẩu + quên mật khẩu + link recovery.
6. Link mời cũ `?auth=password` vẫn hoạt động.
7. Mở trong Zalo → thấy banner hướng dẫn.
8. Tải lại/đóng trình duyệt → phiên vẫn còn.
9. Không còn nút Facebook ở bất kỳ đâu.
10. `npm run typecheck && npm run lint && npm test && npm run build` đều đạt.

---

## 8. Triển khai & rollback

**Thứ tự:**
1. Sửa GitHub Pages source → GitHub Actions; xác nhận site 200.
2. Tạo Google OAuth client + cấu hình Supabase (Testing mode).
3. Code + test; deploy function `invitations`.
4. Deploy frontend; chạy checklist mục 7.
5. Khi có domain: publish OAuth app, cập nhật cấu hình, test lại.

**Rollback:** frontend có thể revert; đăng nhập mật khẩu vẫn còn nên admin không bị khoá. Không có migration/dữ liệu nào bị đổi, nên rollback an toàn.

---

## 9. Giả định & ngoài phạm vi

- Trung tâm có tài khoản Google riêng; nếu chưa, tạo mới (miễn phí).
- Giai đoạn đầu chấp nhận Testing mode (≤100 test user, cảnh báo chưa xác minh); production cần domain riêng.
- SMTP của Supabase đã cấu hình và gửi được email (đã có cho lời mời).
- Supabase auto-link hoạt động với email đã xác thực; trường hợp bỏ qua link mời sẽ được kiểm thử riêng.
- **Ngoài phạm vi:** 2FA/TOTP, passkey/Face ID, Zalo login/ZNS, SMS OTP, trang cài đặt tài khoản, hiển thị phương thức đăng nhập trong trang quản trị, mua domain.

---

## Phụ lục: trạng thái code khi lưu plan

- Repo đang ở commit `fcc35d3` (đã gồm bản sửa lỗi 404 `complete_my_profile`).
- Các thay đổi thử nghiệm cho plan này đã được revert:
  - `lib/gx/auth-link.ts`
  - `lib/gx/errors.ts`
  - `lib/gx/in-app-browser.ts` (xoá)
- Chưa có migration/dữ liệu nào bị thay đổi.
- Khi triển khai, bắt đầu lại từ mục 3; không cần hoàn tác gì thêm.
