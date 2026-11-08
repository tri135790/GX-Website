// Supabase returns PostgrestError as a plain object, not an Error instance,
// so `error instanceof Error` silently loses the server message.
export type SupabaseErrorLike = {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function errorMessage(error: unknown, fallback = 'Không lưu được. Vui lòng thử lại.'): string {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    const e = (error ?? {}) as SupabaseErrorLike;
    const message = text(e.message);
    const code = text(e.code);
    // PostgREST 404: the RPC was never created in this project.
    if (code === 'PGRST202' || /could not find the function/i.test(message)) {
        return 'Máy chủ chưa cài đặt chức năng lưu hồ sơ: thiếu migration 003_profile_onboarding.sql. Quản trị viên cần chạy migration này trong Supabase SQL Editor rồi thử lại.';
    }
    return message || fallback;
}
