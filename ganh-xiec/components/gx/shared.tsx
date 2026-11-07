'use client';
import { useEffect, useRef } from 'react';
import { X, Leaf, Tent } from 'lucide-react';
import type { Table } from '@/lib/gx/types';
import type { Change } from '@/lib/gx/client';
import { localDate, timeText } from '@/lib/gx/domain';
export const uid = () => crypto.randomUUID();
const initials = (s: string) => s.split(' ').slice(-2).map(x => x[0]).join('');
export const change = (table: Table, record: object) => ({ table, record } as Change);
export function Avatar({ name, color = '#3d8479', small = false }: {
    name: string;
    color?: string;
    small?: boolean;
}) { return <span className={'avatar ' + (small ? 'small' : '')} style={{ background: color + '19', color }}>{initials(name)}</span>; }
export function Tag({ children, tone = 'green' }: {
    children: React.ReactNode;
    tone?: string;
}) { return <span className={'tag ' + tone}>{children}</span>; }
export function Empty({ text = 'Chưa có dữ liệu', detail = 'Thêm thông tin để bắt đầu theo dõi.' }: {
    text?: string;
    detail?: string;
}) { return <div className="empty"><Leaf size={28}/><h3>{text}</h3><p>{detail}</p></div>; }
export function Field({ label, children }: {
    label: string;
    children: React.ReactNode;
}) { return <label className="field"><span>{label}</span>{children}</label>; }
export function Modal({ title, subtitle, close, children }: {
    title: string;
    subtitle?: string;
    close: () => void;
    children: React.ReactNode;
}) { const root = useRef<HTMLDivElement>(null); useEffect(() => { const old = document.activeElement as HTMLElement; root.current?.focus(); const handler = (e: KeyboardEvent) => { if (e.key === 'Escape')
    close(); if (e.key === 'Tab') {
    const nodes = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary');
    if (!nodes?.length)
        return;
    const visible = Array.from(nodes).filter(n => n.getClientRects().length);
    if (!visible.length)
        return;
    const first = visible[0], last = visible[visible.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
        e.preventDefault();
        last.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
} }; document.addEventListener('keydown', handler); return () => { document.removeEventListener('keydown', handler); old?.focus(); }; }, [close]); return <div className="overlay" onClick={e => { if (e.target === e.currentTarget)
    close(); }}><div ref={root} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={close} aria-label="Đóng"><X size={20}/></button></div>{children}</div></div>; }
export function Brand() { return <div className="brand"><div className="brand-mark"><Tent size={29} strokeWidth={1.5}/></div><div><strong>gánh xiếc<span>✦</span></strong><small>BÊNH VỰC TỰ KỈ</small></div></div>; }
export function inputTime(s: string) { return localDate(s) + 'T' + timeText(s); }
