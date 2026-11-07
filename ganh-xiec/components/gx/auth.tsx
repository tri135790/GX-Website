'use client';
import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowRight } from 'lucide-react';
import { Brand, Field } from './shared';
export function Login({ client, error, authenticated }: {
    client: SupabaseClient | null;
    error: string;
    authenticated: boolean;
}) { const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState(error), [busy, setBusy] = useState(false), [mode, setMode] = useState<'login' | 'reset' | 'setPassword'>('login'); useEffect(() => { if (window.location.hash.includes('type=recovery') || window.location.hash.includes('type=invite'))
    setMode('setPassword'); }, []); const oauth = async (provider: 'google' | 'facebook') => { if (!client)
    return; const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }); if (error)
    setMessage(error.message); }; const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!client)
    return; setBusy(true); setMessage(''); try {
    if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error)
            throw error;
        setMessage('Nếu email hợp lệ, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.');
    }
    else if (mode === 'setPassword') {
        const { error } = await client.auth.updateUser({ password });
        if (error)
            throw error;
        setMessage('Đã đặt mật khẩu.');
        window.location.reload();
    }
    else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error)
            throw error;
    }
}
catch (e: any) {
    setMessage(e.message);
}
finally {
    setBusy(false);
} }; return <main className="login"><Brand /><div className="login-card"><h1>{authenticated ? 'Chào mừng bạn' : 'Chào mừng trở lại'}</h1><p>{authenticated ? 'Tài khoản chưa có lời mời hợp lệ. Vui lòng liên hệ admin để được cấp quyền.' : 'Đăng nhập bằng tài khoản được mời.'}</p>{message && <div className="notice" role="status">{message}</div>}{authenticated ? <button className="btn" onClick={() => client?.auth.signOut()}>Đăng xuất</button> : <><div className="social-buttons"><button className="btn" disabled={!client} onClick={() => oauth('google')}><strong className="google-g">G</strong> Tiếp tục với Google</button><button className="btn" disabled={!client} onClick={() => oauth('facebook')}><strong className="facebook-f">f</strong> Tiếp tục với Facebook</button></div><div className="or"><span>hoặc dùng email được mời</span></div><form className="form" onSubmit={submit}>{mode !== 'setPassword' && <Field label="Email"><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"/></Field>}{mode !== 'reset' && <Field label="Mật khẩu"><input required minLength={8} type="password" autoComplete={mode === 'setPassword' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)}/></Field>}<button className="btn primary" disabled={!client || busy}>{busy ? 'Đang xử lý…' : mode === 'reset' ? 'Gửi hướng dẫn' : mode === 'setPassword' ? 'Đặt mật khẩu' : 'Đăng nhập'}<ArrowRight size={16}/></button><button type="button" className="text-button" onClick={() => setMode(mode === 'login' ? 'reset' : 'login')}>{mode === 'login' ? 'Quên mật khẩu?' : 'Quay lại đăng nhập'}</button></form></>}<small>Chỉ dành cho thành viên được Gánh Xiếc mời tham gia.</small></div></main>; }
export function PasswordSetup({ client, done }: {
    client: SupabaseClient;
    done: () => void;
}) { const [password, setPassword] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false); return <main className="login"><Brand /><div className="login-card"><h1>Đặt mật khẩu</h1><p>Hoàn tất xác thực tài khoản Gánh Xiếc.</p><form className="form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const { error } = await client.auth.updateUser({ password }); setBusy(false); if (error)
    setMessage(error.message);
else
    done(); }}><Field label="Mật khẩu mới (tối thiểu 8 ký tự)"><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/></Field>{message && <div className="error">{message}</div>}<button className="btn primary" disabled={busy}>Lưu mật khẩu</button></form></div></main>; }
