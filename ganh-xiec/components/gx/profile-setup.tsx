import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/gx/types';
import { accountDisplay } from '@/lib/gx/account-display';
import { errorMessage } from '@/lib/gx/errors';
import { Brand, Field } from './shared';

export function ProfileSetup({ client, done }: { client: SupabaseClient; done: () => void }) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [name, setName] = useState(''), [phone, setPhone] = useState(''), [address, setAddress] = useState('');
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const { data: { user }, error: authError } = await client.auth.getUser();
                if (authError || !user) throw Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                let data = null;
                for (let attempt = 0; attempt < 4; attempt++) {
                    const result = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
                    if (result.error) throw result.error;
                    if (result.data) { data = result.data; break; }
                    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 400));
                    if (!live) return;
                }
                if (!data?.active) throw Error('Tài khoản chưa được cấp quyền hoặc đã bị khóa. Vui lòng liên hệ admin.');
                if (!live) return;
                const current = accountDisplay(data, user)!;
                setProfile(current); setName(current.name === current.email ? '' : current.name);
                setPhone(current.phone ?? ''); setAddress(current.address ?? '');
            } catch (error) {
                if (live) setError(errorMessage(error, 'Không tải được hồ sơ. Vui lòng tải lại trang.'));
            } finally { if (live) setLoading(false); }
        })();
        return () => { live = false; };
    }, [client]);
    return <main className="login"><Brand /><div className="login-card">
        <h1>Thông tin cá nhân</h1>
        <p>Hoàn thiện hồ sơ để bắt đầu sử dụng Gánh Xiếc.</p>
        {loading ? <p role="status">Đang tải hồ sơ…</p> : <>
            {profile && <form className="form" onSubmit={async e => {
                e.preventDefault(); setError('');
                if (!name.trim()) { setError('Vui lòng nhập họ và tên.'); return; }
                setBusy(true);
                try {
                    const { error } = await client.rpc('complete_my_profile', { p_name: name.trim(), p_phone: phone.trim(), p_address: address.trim() });
                    if (error) throw error;
                    done();
                } catch (error) {
                    setError(errorMessage(error, 'Không lưu được hồ sơ. Vui lòng thử lại.'));
                } finally { setBusy(false); }
            }}>
                <Field label="Email đăng nhập"><input type="email" value={profile.email} readOnly /></Field>
                <Field label="Vai trò"><input readOnly value={{ admin: 'Quản trị viên', employee: 'Nhân sự', parents: 'Phụ huynh' }[profile.role]} /></Field>
                <Field label="Họ và tên *"><input autoComplete="name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></Field>
                <Field label="Số điện thoại"><input type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} /></Field>
                <Field label="Địa chỉ"><textarea autoComplete="street-address" maxLength={500} value={address} onChange={e => setAddress(e.target.value)} /></Field>
                <button className="btn primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin và tiếp tục'}</button>
            </form>}
            {error && <div className="error" role="alert">{error}</div>}
            <button className="text-button" disabled={busy} onClick={async () => { await client.auth.signOut(); window.location.assign(import.meta.env.BASE_URL); }}>Đăng xuất</button>
        </>}
    </div></main>;
}
