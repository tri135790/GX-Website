'use client';
import { useEffect, useState, useRef } from 'react';
import { CalendarDays, Users, GraduationCap, HeartHandshake, ShieldCheck, Menu, X, LogOut, CircleHelp } from 'lucide-react';
import type { Profile } from '@/lib/gx/types';
import { Brand } from './shared';
const adminItems = [['calendar', 'Lịch dạy', CalendarDays], ['employees', 'Nhân sự', Users], ['students', 'Học sinh', GraduationCap], ['parents', 'Phụ huynh', HeartHandshake], ['accounts', 'Tài khoản', ShieldCheck]] as const;
export function AppShell({ page, go, user, demo, help, setup, logout, children }: {
    page: string;
    go: (s: string) => void;
    user: Profile | null;
    demo: boolean;
    help: () => void;
    setup: () => void;
    logout: () => void;
    children: React.ReactNode;
}) {
    const items = user?.role === 'employee' ? [['calendar', 'Lịch dạy', CalendarDays], ['students', 'Học sinh phụ trách', GraduationCap]] as const : adminItems;
    const [open, setOpen] = useState(false), [narrow, setNarrow] = useState(false);
    const sidebar = useRef<HTMLElement>(null), menu = useRef<HTMLButtonElement>(null);
    useEffect(() => { const media = window.matchMedia('(max-width:900px)'); const update = () => { setNarrow(media.matches); if (!media.matches)
        setOpen(false); }; update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
    useEffect(() => { if (!open)
        return; sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus(); const key = (e: KeyboardEvent) => { if (e.key === 'Escape')
        setOpen(false); if (e.key === 'Tab') {
        const nodes = Array.from(sidebar.current?.querySelectorAll<HTMLButtonElement>('button') || []).filter(n => n.getClientRects().length);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    } }; document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); requestAnimationFrame(() => menu.current?.focus()); }; }, [open]);
    return <div className="app-shell">{open && <button className="nav-scrim" aria-label="Đóng menu" onClick={() => setOpen(false)}/>}<aside ref={sidebar} inert={narrow && !open} className={'sidebar ' + (open ? 'open' : '')}><div className="sidebar-brand"><Brand /><button className="icon-button mobile-toggle" aria-label="Đóng menu" onClick={() => setOpen(false)}><X size={20}/></button></div><nav aria-label="Điều hướng chính">{items.map(([id, label, Icon]) => <button key={id} aria-current={page === id ? 'page' : undefined} className={page === id ? 'active' : ''} onClick={() => { go(id); setOpen(false); }}><Icon size={19}/>{label}</button>)}</nav><div className="sidebar-bottom"><button className="help" onClick={() => { help(); setOpen(false); }}><CircleHelp size={17}/> Trợ giúp</button><div className="user-box"><div><strong>{user?.name || user?.email || 'Thành viên'}</strong>{user?.email && <small style={{ overflowWrap: 'anywhere' }}>{user.email}</small>}<small>{user?.role === 'employee' ? 'Nhân sự' : 'Quản trị viên'}</small></div>{!demo && <button className="icon-button" aria-label="Đăng xuất" onClick={logout}><LogOut size={18}/></button>}</div></div></aside><div className="main-shell" inert={narrow && open}><div className="mobile-bar"><button ref={menu} className="icon-button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22}/></button><span>Gánh Xiếc</span></div>{demo && <div className="demo-bar"><span>Dữ liệu mẫu · Thay đổi chỉ lưu trong phiên này</span><button onClick={setup}>Cấu hình dữ liệu thật</button></div>}<main className="content">{children}</main></div></div>;
}
