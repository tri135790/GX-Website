import { StudentProfile } from './student-profile';
import { hasParticipant } from '@/lib/gx/domain';
import {ProfileHours} from './profile-hours';
import type {Student,Teacher} from '@/lib/gx/types';
import { FamilyPage } from './family-page';
import { workDeleteSnapshot, type DeleteScope, type DeleteSnapshot } from '@/lib/gx/work-deletion';
import { WorkSettings } from './work-settings';
import { ParentApp } from './parent-app';
import { EmployeeApp } from './employee-app';
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ShieldCheck, ChevronRight, ChevronLeft, ArrowUpRight, Clock3, Video, MapPin, Check, ArrowRight, CheckCircle2, Plus, Pencil } from 'lucide-react';
import { connect, loadData, persist, type Change } from '@/lib/gx/client';
import { seedData } from '@/lib/gx/seed';
import { emptyData, statusNames, goalNames, type Data, type Lesson, type Profile } from '@/lib/gx/types';
import { localDate, monday, addDays, dateText, timeText, hours, totals, validateLesson, inRange } from '@/lib/gx/domain';
import { Avatar, Tag, Empty, Modal, Brand } from './shared';
import { AppShell } from './app-shell';
import { CalendarPage } from './calendar-page';
import { DirectoryPage } from './directory-page';
import { HoursPanel } from './hours-panel';
import { LessonForm, RecordForm, InviteForm } from './forms';
import { Login, PasswordSetup } from './auth';
import { ProfileSetup } from './profile-setup';
import { accountDisplay } from '@/lib/gx/account-display';
export default function AdminApp() {
    const [authSetup, setAuthSetup] = useState(false);
    const [data, setData] = useState<Data>(emptyData), [client, setClient] = useState<SupabaseClient | null>(null), [loading, setLoading] = useState(true), [demo, setDemo] = useState(false), [user, setUser] = useState<Profile | null>(null), [authenticated, setAuthenticated] = useState(false), [navId, setNav] = useState('calendar'), [toast, setToast] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [modal, setModal] = useState<{
        type: string;
        record?: any;
    } | null>(null), [studentId, setStudentId] = useState<string | null>(null), [employeeId, setEmployeeId] = useState<string | null>(null), [studentTab, setStudentTab] = useState('overview'), [employeeFilter, setEmployeeFilter] = useState('');
    const refresh = useCallback(async (c: SupabaseClient) => { const { data: { user: u } } = await c.auth.getUser(); setAuthenticated(!!u); if (!u) {
        setUser(null);
        setData(emptyData);
        return;
    } const { data: p, error: e } = await c.from('profiles').select('*').eq('id', u.id).maybeSingle(); if (e)
        throw e; setUser(accountDisplay(p, u)); if (p?.active && p.role === 'admin')
        setData(await loadData(c));
    else
        setData(emptyData); }, []);
    useEffect(() => { if (/type=(recovery|invite)/.test(window.location.hash))
        setAuthSetup(true); let live = true; let cleanup = () => { }; connect().then(async (c) => { if (!live)
        return; setClient(c); if (!c) {
        setDemo(true);
        setData(seedData());
        setUser(seedData().profiles[0]);
    }
    else {
        await refresh(c);
        const { data: sub } = c.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY')
            setAuthSetup(true); setTimeout(() => { refresh(c).catch(e => setError(e.message)); }, 0); });
        cleanup = () => sub.subscription.unsubscribe();
    } setLoading(false); }).catch(e => { setError(e.message); setLoading(false); }); return () => { live = false; cleanup(); }; }, [refresh]);
    useEffect(() => { if (!toast)
        return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);
    const close = useCallback(() => { setModal(null); setError(''); }, []);
    const save = async (changes: Change[], removed: Change[] = []) => { setBusy(true); setError(''); try {
        if (client) {
            await persist(client, changes, removed);
            await refresh(client);
        }
        else {
            const next = structuredClone(data);
            removed.forEach(c => { (next[c.table] as any[]) = (next[c.table] as any[]).filter(x => x.id !== c.record.id); });
            changes.forEach(c => { const arr = next[c.table] as any[]; const i = arr.findIndex(x => x.id === c.record.id); if (i >= 0 && arr[i].version !== c.record.version)
                throw Error('Dữ liệu đã thay đổi.'); const row = { ...c.record, version: c.record.version + 1, ...(c.table === 'weekly' ? { updated_at: new Date().toISOString(), updated_by: user?.id } : {}) }; if (i >= 0)
                arr[i] = row;
            else
                arr.push(row); });
            for (const l of next.lessons)
                validateLesson(l, next.lessons);
            for (const s of next.students.filter(x => x.active)) {
                if (!next.assignments.some(a => a.student_id === s.id && a.responsibility === 'primary' && next.employees.some(e => e.id === a.employee_id && e.active)))
                    throw Error('Học sinh đang hoạt động cần người phụ trách chính.');
            }
            for (const l of next.lessons.filter(x => x.status === 'scheduled')) {
                if (!next.employees.some(e => e.id === l.employee_id && e.active) || (l.student_id && (!next.students.some(s => s.id === l.student_id && s.active))))
                    throw Error('Cần xử lý lịch chưa hoàn thành trước khi đổi phân công hoặc ngừng hoạt động.');
            }
            if (!next.profiles.some(p => p.active && p.role === 'admin'))
                throw Error('Phải giữ ít nhất một admin đang hoạt động.');
            setData(next);
        }
        setToast('Đã lưu thay đổi' + (demo ? ' trong bản xem thử' : ''));
        setModal(null);
    }
    catch (e: any) {
        setError(e.message || 'Không thể lưu. Vui lòng thử lại.');
        throw e;
    }
    finally {
        setBusy(false);
    } };
    const deleteProfile = async(kind:'student'|'teacher',record:Student|Teacher)=>{
 if(!confirm(`Xóa hồ sơ ${record.name}? Hồ sơ sẽ bị ẩn; lịch, báo cáo và tiến trình riêng bị xóa, tổng giờ nhân sự sẽ giảm. Buổi nhóm giữ lại cho giáo viên còn lại. Thao tác không thể hoàn tác.`))return;
 setBusy(true);setError('');try{
 if(client){const {error}=await client.rpc('delete_client_profile',{p_kind:kind,p_id:record.id,p_version:record.version});if(error)throw error;await refresh(client);}
 else{const next=structuredClone(data);if(kind==='student'){next.students=next.students.map(s=>s.id===record.id?{...s,active:false,version:s.version+1}:s);next.lessons=next.lessons.filter(l=>l.student_id!==record.id);next.assignments=next.assignments.filter(a=>a.student_id!==record.id);next.families=next.families.filter(a=>a.student_id!==record.id);next.goals=next.goals.filter(a=>a.student_id!==record.id);next.weekly=next.weekly.filter(a=>a.student_id!==record.id);}
 else{next.teachers=next.teachers.map(t=>t.id===record.id?{...t,active:false,deleted_at:new Date().toISOString(),version:t.version+1}:t);next.lessons=next.lessons.filter(l=>!l.teacher_ids?.includes(record.id)||l.teacher_ids.length>1).map(l=>l.teacher_ids?.includes(record.id)?{...l,teacher_ids:l.teacher_ids.filter(id=>id!==record.id),version:l.version+1}:l);next.teacher_goals=next.teacher_goals.filter(g=>g.teacher_id!==record.id);next.teacher_weekly=next.teacher_weekly.filter(w=>w.teacher_id!==record.id);}setData(next);}
 setStudentId(null);setToast('Đã xóa hồ sơ và lịch sử riêng.');
 }catch(e:any){setError(e.message);throw e;}finally{setBusy(false);}
 };
    const deleteWork = async (anchor: Lesson, scope: DeleteScope, snapshot: DeleteSnapshot) => {
        setBusy(true); setError('');
        try {
            if (client) {
                const {error: failure} = await client.rpc('delete_work', {p_anchor:anchor.id,p_scope:scope,p_snapshot:snapshot});
                if (failure) throw Error(failure.message);
                await refresh(client);
            } else {
                const current = data.lessons.find(l=>l.id===anchor.id);
                if (!current || JSON.stringify(workDeleteSnapshot(data.lessons,current,scope)) !== JSON.stringify(snapshot)) throw Error('Dữ liệu đã thay đổi. Vui lòng tải lại.');
                const ids = new Set(snapshot.filter(l=>l.deletable).map(l=>l.id));
                if (!ids.size) throw Error('Không có lịch đủ điều kiện xóa.');
                setData({...data,lessons:data.lessons.filter(l=>!ids.has(l.id))});
            }
            setModal(null); setToast('Đã xóa lịch'+(demo?' trong bản xem thử':''));
        } finally { setBusy(false); }
    };
    const go = (id: string) => { setNav(id); setStudentId(null); setEmployeeId(null); setError(''); };
    const openStudent = (id: string) => { setStudentId(id); setStudentTab('overview'); setNav('students'); };
    const student = data.students.find(x => x.id === studentId), employee = data.employees.find(x => x.id === employeeId);
    const studentName = (id: string) => data.students.find(s => s.id === id)?.name || 'Học sinh';
    const employeeName = (id: string) => data.employees.find(e => e.id === id)?.name || 'Giáo viên';
    const weekLessons = data.lessons.filter(l => inRange(l, monday(), addDays(monday(), 7)));
    const newLesson = () => setModal({ type: 'lesson' });
    if (loading)
        return <main className="loading"><Brand /><span className="loader"/><p>Đang mở không gian Gánh Xiếc…</p></main>;
    if (authSetup && client)
        return <PasswordSetup client={client} done={() => { setAuthSetup(false); window.history.replaceState(null, '', window.location.pathname); }}/>;
    if (!demo && !user)
        return <Login client={client} error={error} authenticated={authenticated}/>;
    if (client && user?.active && user.onboarding_completed === false) return <ProfileSetup client={client} done={() => { window.location.assign(window.location.pathname); }} />;
    if (user?.active && user.role === 'parents' && client) return <ParentApp client={client} user={user} />;
    if (user?.active && user.role === 'employee' && client) return <EmployeeApp client={client} user={user} />;
    if (user && (!user.active || user.role !== 'admin'))
        return <main className="login"><Brand /><div className="login-card"><ShieldCheck size={36}/><h1>{user.active ? 'Chào mừng đến Gánh Xiếc' : 'Tài khoản đã tạm khóa'}</h1><p>{user.active ? 'Khu vực dành cho giáo viên và phụ huynh sẽ được mở trong phiên bản tiếp theo.' : 'Vui lòng liên hệ quản trị viên.'}</p><button className="btn" onClick={() => client?.auth.signOut()}>Đăng xuất</button></div></main>;
    const LessonRows = ({ list }: {
        list: Lesson[];
    }) => <div className="lesson-list">{list.length ? list.map(l => <button className="lesson-row" key={l.id} onClick={() => setModal({ type: 'lesson', record: l })}><div className="lesson-time"><strong>{dateText(l.starts_at)}</strong><small>{timeText(l.starts_at)}–{timeText(l.ends_at)}</small></div><span className="lesson-stripe" style={{ background: data.employees.find(e => e.id === l.employee_id)?.color }}/><div className="lesson-person"><strong>{studentName(l.student_id)}</strong><small>{employeeName(l.employee_id)} · {l.content || 'Buổi học cá nhân'}</small></div><Tag tone={l.mode === 'online' ? 'blue' : 'sand'}>{l.mode === 'online' ? <Video size={12}/> : <MapPin size={12}/>} {l.mode === 'online' ? 'Online' : 'Offline'}</Tag><span className={'status-dot ' + l.status} title={statusNames[l.status]}/><ChevronRight size={17}/></button>) : <Empty text="Chưa có buổi dạy" detail="Các buổi được lên lịch sẽ xuất hiện tại đây."/>}</div>;
    return <AppShell page={navId} go={go} user={user} demo={demo} help={() => setModal({ type: 'help' })} setup={() => setModal({ type: 'setup' })} logout={() => { client?.auth.signOut(); }}>
 {error && !modal && <div className="error" role="alert">{error}<button onClick={() => client && refresh(client).catch(e => setError(e.message))}>Tải lại</button></div>}
 {navId==='settings'&&<WorkSettings client={client} locations={data.work_locations} reload={async()=>{if(client)await refresh(client);}}/>}
 {navId === 'calendar' && <CalendarPage data={data} busy={busy} employeeFilter={employeeFilter} setEmployeeFilter={setEmployeeFilter} openLesson={record => setModal({ type: 'lesson', record })} openWeekly={id => { openStudent(id); setStudentTab('weekly'); }}/>}
 {navId === 'employees' && !employee && <DirectoryPage key="employees" kind="employees" data={data} add={() => setModal({ type: 'employee' })} open={setEmployeeId} openStudent={openStudent} openWork={id=>setModal({type:'lesson',record:data.lessons.find(l=>l.id===id)})}/>}
 {navId === 'employees' && employee && <><button className="back-button" onClick={() => setEmployeeId(null)}><ChevronLeft size={17}/> Danh sách nhân sự</button><div className="profile-heading"><h1>{employee.name}</h1><Tag tone={employee.active ? 'green' : 'gray'}>{employee.active ? 'Đang hoạt động' : 'Đã ngừng'}</Tag><button className="btn" onClick={() => setModal({ type: 'employee', record: employee })}><Pencil size={16}/> Chỉnh sửa</button></div><div className="detail-grid"><section className="panel"><div className="panel-heading"><h2>Học sinh đang phụ trách</h2></div>{data.assignments.filter(a => a.employee_id === employee.id).map(a => <button className="student-link" key={a.id} onClick={() => openStudent(a.student_id)}><Avatar name={studentName(a.student_id)} small/><strong>{studentName(a.student_id)}</strong><Tag tone={a.responsibility === 'primary' ? 'green' : 'sand'}>{a.responsibility === 'primary' ? 'Phụ trách chính' : 'Phối hợp'}</Tag><ChevronRight size={17}/></button>)}</section><section className="panel"><div className="panel-heading"><h2>Thông tin liên hệ</h2></div><div className="panel-body"><p>Email: {employee.email || 'Chưa cập nhật'}</p><p>Điện thoại: {employee.phone || 'Chưa cập nhật'}</p><Tag>{employee.active ? 'Đang hoạt động' : 'Đã ngừng hoạt động'}</Tag></div></section></div><ProfileHours employeeId={employee.id} lessons={data.lessons.filter(l=>hasParticipant(l,employee.id))}/><section className="panel"><div className="panel-heading"><h2>Lịch dạy tuần này</h2><button className="text-button" onClick={() => { go('calendar'); setEmployeeFilter(employee.id); }}>Mở lịch <ArrowUpRight size={16}/></button></div><LessonRows list={weekLessons.filter(l => hasParticipant(l,employee.id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))}/></section></>}
 {navId === 'students' && !student && <FamilyPage data={data} add={type=>setModal({type})} openStudent={openStudent} busy={busy} save={save} remove={deleteProfile} createWork={id=>setModal({type:'lesson',record:{work_kind:'consultation',teacher_ids:[id]}})} openWork={id=>setModal({type:'lesson',record:data.lessons.find(l=>l.id===id)})}/>}
 {navId === 'students' && student && <><button className="back-button" onClick={()=>setStudentId(null)}>Hồ sơ</button><div className="profile-heading"><h1>{student.name}</h1><button className="btn danger" disabled={busy} onClick={()=>void deleteProfile('student',student).catch(()=>{})}>Xóa hồ sơ</button></div><StudentProfile key={student.id+studentTab} studentId={student.id} client={client} user={user} demoData={data} initialTab={studentTab==='weekly'?'progress':'info'} editStudent={record=>setModal({type:'student',record})} editFamily={record=>setModal({type:'family',record})} editParent={record=>setModal({type:'parent',record})} openLesson={record=>setModal({type:'lesson',record:data.lessons.find(l=>l.id===record.id)||record})}/></>}
 {navId === 'accounts' && <><div className="page-heading"><div><h1>Tài khoản & quyền truy cập</h1></div><button className="btn primary" onClick={() => setModal({ type: 'invite' })}><Plus size={18}/> Mời thành viên</button></div><section className="panel table-wrap"><div className="panel-heading"><h2>Thành viên</h2></div><table><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th /></tr></thead><tbody>{data.profiles.map(p => <tr key={p.id}><td><strong>{p.name || p.email}</strong><small>{p.email}</small></td><td><Tag>{p.role === 'admin' ? 'Quản trị viên' : p.role === 'employee' ? 'Nhân sự' : 'Phụ huynh'}</Tag></td><td>{p.active ? 'Đang hoạt động' : 'Đã khóa'}</td><td><button className="icon-button" aria-label="Sửa quyền" onClick={() => setModal({ type: 'account', record: p })}><Pencil size={16}/></button></td></tr>)}</tbody></table></section><section className="panel table-wrap"><div className="panel-heading"><h2>Lời mời</h2></div><table><thead><tr><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Hết hạn</th><th /></tr></thead><tbody>{data.invitations.map(i => <tr key={i.id}><td>{i.email}</td><td>{i.role}</td><td>{i.status === 'accepted' ? 'Đã tham gia' : i.status === 'revoked' ? 'Đã thu hồi' : Date.parse(i.expires_at) < Date.now() ? 'Hết hạn' : 'Đang chờ'}</td><td>{dateText(i.expires_at)}</td><td>{i.status !== 'accepted' && <button className="text-button" onClick={() => setModal({ type: 'invite', record: i })}>Quản lý</button>}</td></tr>)}</tbody></table>{!data.invitations.length && <Empty text="Chưa có lời mời" detail="Mời giáo viên, phụ huynh hoặc quản trị viên bằng email."/>}</section></>}
 {toast && <div className="toast" role="status"><CheckCircle2 size={19}/>{toast}</div>}{modal && <Modal title={{ lesson: modal.record?.id ? 'Chi tiết giờ làm' : 'Thêm giờ làm', employee: 'Hồ sơ nhân sự', student: 'Hồ sơ học sinh', parent: 'Hồ sơ phụ huynh', family: 'Liên kết phụ huynh', invite: 'Mời thành viên', account: 'Quyền truy cập', help: 'Trợ giúp', setup: 'Kết nối dữ liệu thật' }[modal.type] || ''} close={close}>{modal.type === 'lesson' ? <LessonForm record={modal.record} data={data} save={save} busy={busy} onDelete={deleteWork}/> : ['employee', 'student', 'parent', 'family', 'account'].includes(modal.type) ? <RecordForm type={modal.type} record={modal.record} data={data} save={save} busy={busy}/> : modal.type === 'invite' ? <InviteForm record={modal.record} data={data} client={client} onDone={async () => { if (client)
        await refresh(client); close(); setToast('Đã cập nhật lời mời.'); }}/> : modal.type === 'setup' ? <div className="panel-body prose"><p>Giao diện hiện dùng dữ liệu mẫu. Để sử dụng với hồ sơ thật:</p><ol><li>Tạo project Supabase riêng cho Gánh Xiếc.</li><li>Chạy migration SQL đi kèm mã nguồn.</li><li>Cấu hình URL, khóa public và khóa server trong môi trường triển khai.</li><li>Bật Google/Facebook, cấu hình SMTP và URL chuyển hướng.</li><li>Xác minh email tranthanhtrivn@gmail.com để kích hoạt admin đầu tiên.</li></ol><p>Khi đã kết nối, website yêu cầu đăng nhập và không sử dụng dữ liệu mẫu.</p></div> : <div className="panel-body prose"><h3>Bắt đầu</h3><p>Thêm nhân sự → thêm học sinh và người phụ trách → liên kết phụ huynh → tạo lịch dạy.</p><h3>Sau mỗi buổi học</h3><p>Mở buổi dạy, ghi nhận kết quả và chọn Hoàn thành. Hủy hoặc vắng tính 0 giờ thực dạy.</p><h3>Hồ sơ học sinh</h3><p>Tiến trình hiển thị giờ và các buổi. Trong Báo cáo, lưu ý tuần và báo cáo tư vấn được chia sẻ ngay khi lưu. Phụ huynh làm ATEC và Stress tại Đánh giá.</p><h3>Tài khoản và quyền</h3><p>Chỉ tài khoản được mời và đã xác minh email mới được truy cập. Admin đầu tiên: tranthanhtrivn@gmail.com. Không thể khóa admin hoạt động cuối cùng.</p></div>}</Modal>}</AppShell>;
}
