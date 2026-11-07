import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { connect, appUrl } from '@/lib/gx/client';
import { passwordUrl } from '@/lib/gx/auth-link';
import { PasswordSetup } from './auth';
import { Brand, Field } from './shared';

export function PasswordPage({ invalidLink }: { invalidLink: boolean }) {
    const [client, setClient] = useState<SupabaseClient | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'done'>('loading');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const c = await connect();
                if (!live) return;
                setClient(c);
                if (!c) throw Error('Chưa cấu hình kết nối Supabase.');
                // Wait for automatic callback verification/session initialization first.
                const { data, error } = await c.auth.getSession();
                if (invalidLink || error || !data.session) throw Error('Liên kết đã hết hạn, đã được sử dụng hoặc chưa được xác thực. Hãy yêu cầu liên kết mới bên dưới.');
                const { data: identity, error: identityError } = await c.auth.getUser();
                if (identityError || !identity.user) throw Error('Không xác thực được tài khoản. Hãy yêu cầu liên kết mới.');
                if (!live) return;
                setEmail(identity.user.email || '');
                // Keep the dedicated route on refresh, remove credentials from the address bar.
                window.history.replaceState(null, '', passwordUrl(appUrl()));
                setState('ready');
            } catch (error) {
                if (live) {
                    setMessage(error instanceof Error ? error.message : 'Không mở được liên kết.');
                    setState('invalid');
                }
            }
        })();
        return () => { live = false; };
    }, [invalidLink]);
    if (state === 'ready' && client) return <PasswordSetup client={client} done={() => setState('done')} />;
    return <main className="login"><Brand /><div className="login-card">
        <h1>{state === 'done' ? 'Đã đặt mật khẩu' : 'Đặt mật khẩu mới'}</h1>
        {state === 'loading' ? <p role="status">Đang xác thực liên kết…</p> : state === 'done' ? <>
            <p>Bạn đã có thể sử dụng tài khoản {email}.</p>
            <a className="btn primary" href={appUrl()}>Vào website</a>
        </> : <>
            <p role="status">{message}</p>
            <form className="form" onSubmit={async e => {
                e.preventDefault();
                if (!client) return;
                setBusy(true);
                try {
                    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: passwordUrl(appUrl()) });
                    if (error) throw error;
                    setMessage('Nếu email hợp lệ, bạn sẽ nhận được liên kết mới. Vui lòng kiểm tra hộp thư và Spam.');
                } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Không gửi được email. Vui lòng thử lại.');
                } finally { setBusy(false); }
            }}>
                <Field label="Email được mời"><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
                <button className="btn primary" disabled={!client || busy}>{busy ? 'Đang gửi…' : 'Gửi liên kết đặt mật khẩu mới'}</button>
                <a className="text-button" href={appUrl()}>Quay lại đăng nhập</a>
            </form>
        </>}
    </div></main>;
}
