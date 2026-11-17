'use client';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, Mail, BookOpen } from 'lucide-react';
import type { Change } from '@/lib/gx/client';
import { statusNames, goalNames, type Data, type Table } from '@/lib/gx/types';
import { localDate, addDays, dateText } from '@/lib/gx/domain';
import { uid, change, Field } from './shared';
export { WorkForm as LessonForm } from './work-form';
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
    const [newParent,setNewParent]=useState(false), [parentDraft,setParentDraft]=useState({id:uid(),version:0,name:'',email:'',phone:'',active:true});
    const set = (key: string, val: any) => setF({ ...f, [key]: val });
    const text = (key: string, label: string, inputType = 'text', required = false) => <Field label={label}><input type={inputType} required={required} value={f[key] || ''} onChange={e => set(key, e.target.value)}/></Field>;
    const area = (key: string, label: string) => <Field label={label}><textarea rows={4} value={f[key] || ''} onChange={e => set(key, e.target.value)}/></Field>;
    const submit = async (e: React.FormEvent) => { e.preventDefault(); setLocalError(''); try {
        const tables: Record<string, Table> = { employee: 'employees', student: 'students', parent: 'parents', goal: 'goals', weekly: 'weekly', family: 'families', account: 'profiles' };
        const changes = [change(tables[type], f)], removed: Change[] = [];
        if(type==='family'&&newParent){
            if(!parentDraft.name.trim())throw Error('Nhập họ tên phụ huynh.');
            changes[0]=change('families',{...f,parent_id:parentDraft.id});
            changes.unshift(change('parents',{...parentDraft,name:parentDraft.name.trim()}));
        }
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
    return <form className="form" onSubmit={submit}>{localError && <div className="error" role="alert">{localError}</div>}{['employee', 'student', 'parent'].includes(type) && <>{text('name', 'Họ và tên *', 'text', true)}{type !== 'student' && <div className="form-grid">{text('email', 'Email', 'email')}{text('phone', 'Điện thoại', 'tel')}</div>}{type === 'employee' && <div className="form-grid">{text('specialty', 'Chuyên môn')}{text('color', 'Màu hiển thị trên lịch', 'color')}</div>}{type === 'student' && <><div className="form-grid">{text('birth_date', 'Ngày sinh *', 'date', true)}{text('start_date', 'Ngày bắt đầu *', 'date', true)}</div><Field label="Người phụ trách chính *"><select required={f.active} value={primary} onChange={e => { setPrimary(e.target.value); setSupport(support.filter(x => x !== e.target.value)); }}><option value="">Chọn giáo viên</option>{data.employees.filter(e => e.active).map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></Field><div className="field"><span>Người phối hợp</span><div className="checkbox-list">{data.employees.filter(e => e.active && e.id !== primary).map(e => <label className="checkbox" key={e.id}><input type="checkbox" checked={support.includes(e.id)} onChange={ev => setSupport(ev.target.checked ? [...support, e.id] : support.filter(x => x !== e.id))}/>{e.name}</label>)}</div></div>{area('notes', 'Lưu ý để hỗ trợ con')}</>}<label className="checkbox"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)}/> Đang hoạt động</label></>}{type === 'goal' && <>{text('title', 'Mục tiêu *', 'text', true)}<Field label="Trạng thái"><select value={f.status} onChange={e => set('status', e.target.value)}>{Object.entries(goalNames).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field></>}{type === 'weekly' && <><div className="notice"><BookOpen size={18}/><span>Tuần {dateText(f.week_start)} – {dateText(addDays(f.week_start, 6))}. Kết quả mục tiêu được lưu riêng cho tuần này.</span></div>{f.goal_snapshot.map((g: any, i: number) => <Field label={g.title} key={g.id}><select value={g.status} onChange={e => set('goal_snapshot', f.goal_snapshot.map((x: any, j: number) => j === i ? { ...x, status: e.target.value } : x))}>{Object.entries(goalNames).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>)}{area('progress', 'Tiến bộ & kết quả')}{area('challenges', 'Khó khăn & điều chỉnh hỗ trợ')}{area('next_steps', 'Kế hoạch tuần tiếp theo')}</>}{type === 'family' && <>{!record?.id&&<label className="checkbox"><input type="checkbox" checked={newParent} onChange={e=>setNewParent(e.target.checked)}/>Tạo phụ huynh mới và liên kết</label>}{newParent?<><Field label="Họ tên phụ huynh *"><input required value={parentDraft.name} onChange={e=>setParentDraft({...parentDraft,name:e.target.value})}/></Field><Field label="Email"><input type="email" value={parentDraft.email} onChange={e=>setParentDraft({...parentDraft,email:e.target.value})}/></Field><Field label="Điện thoại"><input type="tel" value={parentDraft.phone} onChange={e=>setParentDraft({...parentDraft,phone:e.target.value})}/></Field></>:<Field label="Phụ huynh *"><select required value={f.parent_id} onChange={e => set('parent_id', e.target.value)}><option value="">Chọn phụ huynh đã tạo</option>{data.parents.filter(p => p.active||p.id===f.parent_id).map(p => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}</select></Field>}{text('relationship', 'Quan hệ với học sinh *', 'text', true)}<label className="checkbox"><input type="checkbox" checked={f.is_primary} onChange={e => set('is_primary', e.target.checked)}/> Người liên hệ chính</label></>}{type === 'account' && <><p>{f.email}</p><RoleFields f={f} setF={setF} data={data}/><label className="checkbox"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)}/> Cho phép truy cập</label><p className="muted">Không thể khóa hoặc hạ quyền admin hoạt động cuối cùng.</p></>}<div className="form-footer">{type === 'family' && record?.id && <button type="button" className="btn danger" disabled={busy} onClick={() => { if (confirm('Gỡ liên kết phụ huynh với học sinh?'))
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
