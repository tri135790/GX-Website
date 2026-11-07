'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, Mail, BookOpen } from 'lucide-react';
import type { Change } from '@/lib/gx/client';
import { statusNames, goalNames, type Data, type Table, type Lesson } from '@/lib/gx/types';
import { localDate, addDays, dateText, timeText, minutes, validateLesson } from '@/lib/gx/domain';
import { uid, change, Field, inputTime } from './shared';
export function LessonForm({ record, data, save, busy }: {
    record?: Partial<Lesson>;
    data: Data;
    save: (c: Change[], r?: Change[]) => Promise<void>;
    busy: boolean;
}) {
    const initial: Lesson = { id: uid(), version: 0, student_id: '', employee_id: '', starts_at: localDate() + 'T08:00:00+07:00', ends_at: localDate() + 'T09:00:00+07:00', mode: 'offline', location: '', status: 'scheduled', actual_minutes: 0, reason: '', content: '', note: '', series_id: null, ...record };
    const [f, setF] = useState(initial), [resultsOpen, setResultsOpen] = useState(!!record?.id && (record.status !== 'scheduled' || Date.parse(initial.ends_at) < Date.now())), [repeat, setRepeat] = useState(false), [until, setUntil] = useState(addDays(localDate(initial.starts_at), 28)), [days, setDays] = useState<number[]>([new Date(initial.starts_at).getUTCDay()]), [scope, setScope] = useState('one'), [localError, setLocalError] = useState('');
    const update = (key: keyof Lesson, value: any) => setF({ ...f, [key]: value });
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        try {
            const lesson = { ...f, actual_minutes: f.status === 'completed' ? Number(f.actual_minutes) : 0 };
            let list: Lesson[] = [lesson];
            if (repeat && !record?.id) {
                if (!days.length)
                    throw Error('Chọn ít nhất một ngày lặp.');
                if (until < localDate(f.starts_at) || until > addDays(localDate(f.starts_at), 366))
                    throw Error('Ngày kết thúc trong vòng 1 năm và sau ngày bắt đầu.');
                const series = uid(), duration = Date.parse(f.ends_at) - Date.parse(f.starts_at);
                list = [];
                for (let date = localDate(f.starts_at); date <= until; date = addDays(date, 1)) {
                    if (!days.includes(new Date(date + 'T12:00:00+07:00').getUTCDay()))
                        continue;
                    const start = date + 'T' + timeText(f.starts_at) + ':00+07:00';
                    list.push({ ...lesson, id: uid(), series_id: series, starts_at: start, ends_at: new Date(Date.parse(start) + duration).toISOString() });
                }
                if (!list.length)
                    throw Error('Không có buổi nào trong khoảng lặp.');
            }
            if (scope === 'future' && record?.id && record.series_id) {
                const original = data.lessons.find(l => l.id === record.id)!;
                if (original.status !== 'scheduled')
                    throw Error('Chỉ áp dụng hàng loạt từ một buổi chưa hoàn thành.');
                if (!['scheduled', 'cancelled'].includes(f.status))
                    throw Error('Hoàn thành và vắng mặt cần xác nhận từng buổi.');
                const shift = Date.parse(f.starts_at) - Date.parse(original.starts_at);
                const duration = Date.parse(f.ends_at) - Date.parse(f.starts_at);
                list = data.lessons.filter(l => l.series_id === original.series_id && Date.parse(l.starts_at) >= Date.parse(original.starts_at) && l.status === 'scheduled').map(l => ({ ...l, employee_id: f.employee_id, student_id: f.student_id, mode: f.mode, location: f.location, content: f.content, status: f.status, reason: f.reason, starts_at: new Date(Date.parse(l.starts_at) + shift).toISOString(), ends_at: new Date(Date.parse(l.starts_at) + shift + duration).toISOString(), actual_minutes: 0 }));
            }
            const unchanged = data.lessons.filter(x => !list.some(l => l.id === x.id));
            list.forEach(l => validateLesson(l, [...unchanged, ...list]));
            await save(list.map(l => change('lessons', l)));
        }
        catch (e: any) {
            setLocalError(e.message);
        }
    };
    return <form className="form" onSubmit={submit}>{localError && <div className="error" role="alert">{localError}</div>}<div className="form-grid"><Field label="Học sinh *"><select required value={f.student_id} onChange={e => setF({ ...f, student_id: e.target.value, employee_id: data.assignments.find(a => a.student_id === e.target.value && a.responsibility === 'primary')?.employee_id || '' })}><option value="">Chọn học sinh</option>{data.students.filter(s => s.active || s.id === f.student_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Giáo viên phụ trách *"><select required value={f.employee_id} onChange={e => update('employee_id', e.target.value)}><option value="">Chọn giáo viên</option>{data.employees.filter(e => e.id === f.employee_id || (e.active && data.assignments.some(a => a.student_id === f.student_id && a.employee_id === e.id))).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><Field label="Bắt đầu *"><input required type="datetime-local" value={inputTime(f.starts_at)} onChange={e => { if (e.target.value)
        update('starts_at', e.target.value + ':00+07:00'); }}/></Field><Field label="Kết thúc *"><input required type="datetime-local" value={inputTime(f.ends_at)} onChange={e => { if (e.target.value)
        update('ends_at', e.target.value + ':00+07:00'); }}/></Field><Field label="Hình thức"><select value={f.mode} onChange={e => update('mode', e.target.value)}><option value="offline">Offline · Trực tiếp</option><option value="online">Online · Trực tuyến</option></select></Field><Field label={f.mode === 'online' ? 'Link buổi học *' : 'Địa điểm *'}><input required type={f.mode === 'online' ? 'url' : 'text'} value={f.location} placeholder={f.mode === 'online' ? 'https://meet.google.com/…' : 'Phòng học, địa chỉ…'} onChange={e => update('location', e.target.value)}/></Field></div><Field label="Nội dung dự kiến"><input value={f.content} onChange={e => update('content', e.target.value)} placeholder="Ví dụ: Giao tiếp và tương tác"/></Field>{!record?.id && <div className="repeat-box"><label className="checkbox"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)}/> Lặp lại hằng tuần</label>{repeat && <><div className="weekday-select">{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((n, i) => <button type="button" className={days.includes(i) ? 'selected' : ''} key={i} onClick={() => setDays(days.includes(i) ? days.filter(x => x !== i) : [...days, i])}>{n}</button>)}</div><Field label="Lặp đến hết ngày"><input type="date" required value={until} onChange={e => setUntil(e.target.value)}/></Field></>}</div>}{record?.series_id && <Field label="Phạm vi thay đổi"><select value={scope} onChange={e => setScope(e.target.value)}><option value="one">Chỉ buổi này</option><option value="future">Buổi này và các buổi chưa hoàn thành tiếp theo</option></select></Field>}{record?.id && <details className="result-section" open={resultsOpen} onToggle={e => setResultsOpen(e.currentTarget.open)}><summary>Kết quả buổi học <span>{statusNames[f.status]}</span></summary><div className="form-grid"><Field label="Trạng thái"><select value={f.status} onChange={e => setF({ ...f, status: e.target.value as Lesson['status'], actual_minutes: e.target.value === 'completed' ? Math.max(1, minutes(f)) : 0 })}>{Object.entries(statusNames).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>{f.status === 'completed' && <Field label="Số phút thực dạy *"><input required type="number" min="1" step="1" value={f.actual_minutes} onChange={e => update('actual_minutes', Number(e.target.value))}/></Field>}</div><Field label="Ghi chép sau buổi học"><textarea rows={3} value={f.note} onChange={e => update('note', e.target.value)} placeholder="Con đã làm được gì? Điều gì cần tiếp tục hỗ trợ?"/></Field>{(f.status === 'cancelled' || f.status === 'absent' || (f.status === 'completed' && f.actual_minutes !== minutes(f))) && <Field label="Lý do hủy / vắng / điều chỉnh thời lượng *"><input required value={f.reason} onChange={e => update('reason', e.target.value)} placeholder="Nhập lý do"/></Field>}</details>}<div className="form-footer"><small>Múi giờ Việt Nam (UTC+7)</small><button className="btn primary" disabled={busy}>{busy ? 'Đang lưu…' : record?.id ? 'Lưu thay đổi' : 'Tạo buổi dạy'}<Check size={16}/></button></div></form>;
}
export function RecordForm({ type, record, data, save, busy }: {
    type: string;
    record?: any;
    data: Data;
    save: (c: Change[], r?: Change[]) => Promise<void>;
    busy: boolean;
}) {
    const base = { id: uid(), version: 0 };
    const defaults: Record<string, any> = { employee: { ...base, name: '', email: '', phone: '', specialty: '', color: '#3d8479', active: true }, student: { ...base, name: '', birth_date: '', start_date: localDate(), notes: '', active: true }, parent: { ...base, name: '', email: '', phone: '', active: true }, goal: { ...base, student_id: record?.student_id, title: '', status: 'new' }, weekly: { ...base, student_id: record?.student_id, week_start: record?.week_start, progress: '', challenges: '', next_steps: '', goal_snapshot: data.goals.filter(g => g.student_id === record?.student_id).map(g => ({ id: g.id, title: g.title, status: g.status })) }, family: { ...base, student_id: record?.student_id, parent_id: '', relationship: 'Mẹ', is_primary: false }, account: record };
    const [f, setF] = useState({ ...defaults[type], ...record }), [primary, setPrimary] = useState(data.assignments.find(a => a.student_id === record?.id && a.responsibility === 'primary')?.employee_id || ''), [support, setSupport] = useState(data.assignments.filter(a => a.student_id === record?.id && a.responsibility === 'support').map(a => a.employee_id)), [localError, setLocalError] = useState('');
    const set = (key: string, val: any) => setF({ ...f, [key]: val });
    const text = (key: string, label: string, inputType = 'text', required = false) => <Field label={label}><input type={inputType} required={required} value={f[key] || ''} onChange={e => set(key, e.target.value)}/></Field>;
    const area = (key: string, label: string) => <Field label={label}><textarea rows={4} value={f[key] || ''} onChange={e => set(key, e.target.value)}/></Field>;
    const submit = async (e: React.FormEvent) => { e.preventDefault(); setLocalError(''); try {
        const tables: Record<string, Table> = { employee: 'employees', student: 'students', parent: 'parents', goal: 'goals', weekly: 'weekly', family: 'families', account: 'profiles' };
        const changes = [change(tables[type], f)], removed: Change[] = [];
        if (type === 'student') {
            if (f.active && !primary)
                throw Error('Chọn người phụ trách chính.');
            removed.push(...data.assignments.filter(a => a.student_id === f.id).map(a => change('assignments', a)));
            if (primary)
                changes.push(change('assignments', { id: uid(), version: 0, student_id: f.id, employee_id: primary, responsibility: 'primary' }));
            support.filter(id => id !== primary).forEach(id => changes.push(change('assignments', { id: uid(), version: 0, student_id: f.id, employee_id: id, responsibility: 'support' })));
        }
        if (type === 'family' && f.is_primary) {
            data.families.filter(x => x.student_id === f.student_id && x.is_primary && x.id !== f.id).forEach(x => changes.unshift(change('families', { ...x, is_primary: false })));
        }
        await save(changes, removed);
    }
    catch (e: any) {
        setLocalError(e.message);
    } };
    return <form className="form" onSubmit={submit}>{localError && <div className="error" role="alert">{localError}</div>}{['employee', 'student', 'parent'].includes(type) && <>{text('name', 'Họ và tên *', 'text', true)}{type !== 'student' && <div className="form-grid">{text('email', 'Email', 'email')}{text('phone', 'Điện thoại', 'tel')}</div>}{type === 'employee' && <div className="form-grid">{text('specialty', 'Chuyên môn')}{text('color', 'Màu hiển thị trên lịch', 'color')}</div>}{type === 'student' && <><div className="form-grid">{text('birth_date', 'Ngày sinh *', 'date', true)}{text('start_date', 'Ngày bắt đầu *', 'date', true)}</div><Field label="Người phụ trách chính *"><select required={f.active} value={primary} onChange={e => { setPrimary(e.target.value); setSupport(support.filter(x => x !== e.target.value)); }}><option value="">Chọn giáo viên</option>{data.employees.filter(e => e.active).map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></Field><div className="field"><span>Người phối hợp</span><div className="checkbox-list">{data.employees.filter(e => e.active && e.id !== primary).map(e => <label className="checkbox" key={e.id}><input type="checkbox" checked={support.includes(e.id)} onChange={ev => setSupport(ev.target.checked ? [...support, e.id] : support.filter(x => x !== e.id))}/>{e.name}</label>)}</div></div>{area('notes', 'Lưu ý để hỗ trợ con')}</>}<label className="checkbox"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)}/> Đang hoạt động</label></>}{type === 'goal' && <>{text('title', 'Mục tiêu *', 'text', true)}<Field label="Trạng thái"><select value={f.status} onChange={e => set('status', e.target.value)}>{Object.entries(goalNames).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field></>}{type === 'weekly' && <><div className="notice"><BookOpen size={18}/><span>Tuần {dateText(f.week_start)} – {dateText(addDays(f.week_start, 6))}. Kết quả mục tiêu được lưu riêng cho tuần này.</span></div>{f.goal_snapshot.map((g: any, i: number) => <Field label={g.title} key={g.id}><select value={g.status} onChange={e => set('goal_snapshot', f.goal_snapshot.map((x: any, j: number) => j === i ? { ...x, status: e.target.value } : x))}>{Object.entries(goalNames).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>)}{area('progress', 'Tiến bộ & kết quả')}{area('challenges', 'Khó khăn & điều chỉnh hỗ trợ')}{area('next_steps', 'Kế hoạch tuần tiếp theo')}</>}{type === 'family' && <><Field label="Phụ huynh *"><select required value={f.parent_id} onChange={e => set('parent_id', e.target.value)}><option value="">Chọn phụ huynh đã tạo</option>{data.parents.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}</select></Field>{text('relationship', 'Quan hệ với học sinh *', 'text', true)}<label className="checkbox"><input type="checkbox" checked={f.is_primary} onChange={e => set('is_primary', e.target.checked)}/> Người liên hệ chính</label></>}{type === 'account' && <><p>{f.email}</p><RoleFields f={f} setF={setF} data={data}/><label className="checkbox"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)}/> Cho phép truy cập</label><p className="muted">Không thể khóa hoặc hạ quyền admin hoạt động cuối cùng.</p></>}<div className="form-footer">{type === 'family' && record?.id && <button type="button" className="btn danger" disabled={busy} onClick={() => { if (confirm('Gỡ liên kết phụ huynh với học sinh?'))
        save([], [change('families', record)]).catch(e => setLocalError(e.message)); }}>Gỡ liên kết</button>}<button className="btn primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin'}<Check size={16}/></button></div></form>;
}
function RoleFields({ f, setF, data }: {
    f: any;
    setF: (v: any) => void;
    data: Data;
}) { return <><Field label="Vai trò"><select value={f.role} onChange={e => setF({ ...f, role: e.target.value, employee_id: null, parent_id: null })}><option value="employee">Nhân sự</option><option value="parents">Phụ huynh</option><option value="admin">Quản trị viên</option></select></Field>{f.role !== 'admin' && <Field label="Hồ sơ liên kết *"><select required value={f.role === 'employee' ? f.employee_id || '' : f.parent_id || ''} onChange={e => setF({ ...f, [f.role === 'employee' ? 'employee_id' : 'parent_id']: e.target.value })}><option value="">Chọn hồ sơ</option>{(f.role === 'employee' ? data.employees : data.parents).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}</>; }
export function InviteForm({ record, data, client, onDone }: {
    record?: any;
    data: Data;
    client: SupabaseClient | null;
    onDone: () => Promise<void>;
}) { const [f, setF] = useState({ email: '', role: 'employee', employee_id: null, parent_id: null, ...record }), [error, setError] = useState(''), [busy, setBusy] = useState(false); const send = async (action: string) => { if (!client) {
    setError('Cần kết nối Supabase và cấu hình email trước khi gửi lời mời thật.');
    return;
} setBusy(true); setError(''); try {
    const { error: invokeError } = await client.functions.invoke('invitations', {
        body: { action, id: record?.id, email: f.email, role: f.role, employee_id: f.employee_id, parent_id: f.parent_id },
    });
    if (invokeError) {
        const details = await invokeError.context?.json?.().catch(() => null);
        throw Error(details?.error || details?.message || invokeError.message);
    }
    await onDone();
}
catch (e: any) {
    setError(e.message);
}
finally {
    setBusy(false);
} }; return <form className="form" onSubmit={e => { e.preventDefault(); send('invite'); }}>{error && <div className="error" role="alert">{error}</div>}<Field label="Email người nhận *"><input required type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })}/></Field><RoleFields f={f} setF={setF} data={data}/><p className="muted">Lời mời có hiệu lực 7 ngày. Người nhận cần xác minh đúng email được mời. Gửi lại sẽ vô hiệu lời mời cũ.</p><div className="form-footer">{record?.status === 'pending' && <button className="btn danger" disabled={busy} type="button" onClick={() => send('revoke')}>Thu hồi</button>}<button className="btn primary" disabled={busy}><Mail size={16}/>{busy ? 'Đang xử lý…' : record ? 'Gửi lại lời mời' : 'Gửi lời mời'}</button></div></form>; }
