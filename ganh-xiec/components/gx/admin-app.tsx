'use client';
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
export default function AdminApp() {
    const [authSetup, setAuthSetup] = useState(false);
    const [data, setData] = useState<Data>(emptyData), [client, setClient] = useState<SupabaseClient | null>(null), [loading, setLoading] = useState(true), [demo, setDemo] = useState(false), [user, setUser] = useState<Profile | null>(null), [authenticated, setAuthenticated] = useState(false), [navId, setNav] = useState('calendar'), [toast, setToast] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [modal, setModal] = useState<{
        type: string;
        record?: any;
    } | null>(null), [studentId, setStudentId] = useState<string | null>(null), [employeeId, setEmployeeId] = useState<string | null>(null), [studentTab, setStudentTab] = useState('overview'), [week, setWeek] = useState(monday()), [employeeFilter, setEmployeeFilter] = useState('');
    const refresh = useCallback(async (c: SupabaseClient) => { const { data: { user: u } } = await c.auth.getUser(); setAuthenticated(!!u); if (!u) {
        setUser(null);
        setData(emptyData);
        return;
    } const { data: p, error: e } = await c.from('profiles').select('*').eq('id', u.id).maybeSingle(); if (e)
        throw e; setUser(p); if (p?.active && p.role === 'admin')
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
                if (!next.employees.some(e => e.id === l.employee_id && e.active) || !next.students.some(s => s.id === l.student_id && s.active) || !next.assignments.some(a => a.student_id === l.student_id && a.employee_id === l.employee_id))
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
    const go = (id: string) => { setNav(id); setStudentId(null); setEmployeeId(null); setError(''); };
    const openStudent = (id: string) => { setStudentId(id); setStudentTab('overview'); setWeek(monday()); setNav('students'); };
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
    if (user && (!user.active || user.role !== 'admin'))
        return <main className="login"><Brand /><div className="login-card"><ShieldCheck size={36}/><h1>{user.active ? 'Chào mừng đến Gánh Xiếc' : 'Tài khoản đã tạm khóa'}</h1><p>{user.active ? 'Khu vực dành cho giáo viên và phụ huynh sẽ được mở trong phiên bản tiếp theo.' : 'Vui lòng liên hệ quản trị viên.'}</p><button className="btn" onClick={() => client?.auth.signOut()}>Đăng xuất</button></div></main>;
    const LessonRows = ({ list }: {
        list: Lesson[];
    }) => <div className="lesson-list">{list.length ? list.map(l => <button className="lesson-row" key={l.id} onClick={() => setModal({ type: 'lesson', record: l })}><div className="lesson-time"><strong>{dateText(l.starts_at)}/{localDate(l.starts_at).slice(0, 4)}</strong><small>{timeText(l.starts_at)}–{timeText(l.ends_at)}</small></div><span className="lesson-stripe" style={{ background: data.employees.find(e => e.id === l.employee_id)?.color }}/><div className="lesson-person"><strong>{studentName(l.student_id)}</strong><small>{employeeName(l.employee_id)} · {l.content || 'Buổi học cá nhân'}</small></div><Tag tone={l.mode === 'online' ? 'blue' : 'sand'}>{l.mode === 'online' ? <Video size={12}/> : <MapPin size={12}/>} {l.mode === 'online' ? 'Online' : 'Offline'}</Tag><span className={'status-dot ' + l.status} title={statusNames[l.status]}/><ChevronRight size={17}/></button>) : <Empty text="Chưa có buổi dạy" detail="Các buổi được lên lịch sẽ xuất hiện tại đây."/>}</div>;
    return <AppShell page={navId} go={go} user={user} demo={demo} help={() => setModal({ type: 'help' })} setup={() => setModal({ type: 'setup' })} logout={() => { client?.auth.signOut(); }}>
 {error && !modal && <div className="error" role="alert">{error}<button onClick={() => client && refresh(client).catch(e => setError(e.message))}>Tải lại</button></div>}
 {navId === 'calendar' && <CalendarPage data={data} busy={busy} employeeFilter={employeeFilter} setEmployeeFilter={setEmployeeFilter} openLesson={record => setModal({ type: 'lesson', record })} openWeekly={id => { openStudent(id); setStudentTab('weekly'); }}/>}
 {navId === 'employees' && !employee && <DirectoryPage key="employees" kind="employees" data={data} add={() => setModal({ type: 'employee' })} open={setEmployeeId} openStudent={openStudent}/>}
 {navId === 'employees' && employee && <><button className="back-button" onClick={() => setEmployeeId(null)}><ChevronLeft size={17}/> Danh sách nhân sự</button><div className="profile-heading"><h1>{employee.name}</h1><Tag tone={employee.active ? 'green' : 'gray'}>{employee.active ? 'Đang hoạt động' : 'Đã ngừng'}</Tag><button className="btn" onClick={() => setModal({ type: 'employee', record: employee })}><Pencil size={16}/> Chỉnh sửa</button></div><div className="detail-grid"><section className="panel"><div className="panel-heading"><h2>Học sinh đang phụ trách</h2></div>{data.assignments.filter(a => a.employee_id === employee.id).map(a => <button className="student-link" key={a.id} onClick={() => openStudent(a.student_id)}><Avatar name={studentName(a.student_id)} small/><strong>{studentName(a.student_id)}</strong><Tag tone={a.responsibility === 'primary' ? 'green' : 'sand'}>{a.responsibility === 'primary' ? 'Phụ trách chính' : 'Phối hợp'}</Tag><ChevronRight size={17}/></button>)}</section><section className="panel"><div className="panel-heading"><h2>Thông tin liên hệ</h2></div><div className="panel-body"><p>Email: {employee.email || 'Chưa cập nhật'}</p><p>Điện thoại: {employee.phone || 'Chưa cập nhật'}</p><Tag>{employee.active ? 'Đang hoạt động' : 'Đã ngừng hoạt động'}</Tag></div></section></div><HoursPanel data={data} lessons={weekLessons.filter(l => l.employee_id === employee.id)}/><section className="panel"><div className="panel-heading"><h2>Lịch dạy tuần này</h2><button className="text-button" onClick={() => { go('calendar'); setEmployeeFilter(employee.id); }}>Mở lịch <ArrowUpRight size={16}/></button></div><LessonRows list={weekLessons.filter(l => l.employee_id === employee.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at))}/></section></>}
 {navId === 'students' && !student && <DirectoryPage key="students" kind="students" data={data} add={() => setModal({ type: 'student' })} open={openStudent} openStudent={openStudent}/>}
 {navId === 'students' && student && <><button className="back-button" onClick={() => setStudentId(null)}><ChevronLeft size={17}/> Danh sách học sinh</button><div className="profile-heading"><h1>{student.name}</h1><Tag tone={student.active ? 'green' : 'gray'}>{student.active ? 'Đang học' : 'Đã ngừng'}</Tag><button className="btn" onClick={() => setModal({ type: 'student', record: student })}><Pencil size={16}/> Chỉnh sửa hồ sơ</button></div><div className="tabs">{[['overview', 'Thông tin'], ['weekly', 'Tiến trình tuần'], ['lessons', 'Buổi học'], ['parents', 'Phụ huynh']].map(([k, v]) => <button key={k} className={studentTab === k ? 'active' : ''} onClick={() => setStudentTab(k)}>{v}</button>)}</div>{studentTab === 'overview' && <div className="detail-grid"><div><section className="panel"><div className="panel-heading"><h2>Thông tin học sinh</h2></div><div className="panel-body"><div className="info-grid"><div><small>Ngày sinh</small><strong>{dateText(student.birth_date)}/{student.birth_date.slice(0, 4)}</strong></div><div><small>Ngày bắt đầu</small><strong>{dateText(student.start_date)}/{student.start_date.slice(0, 4)}</strong></div></div><div className="note-box"><h3>Lưu ý hỗ trợ</h3><p>{student.notes || 'Chưa có lưu ý. Hãy bổ sung những điều giúp giáo viên hỗ trợ con tốt hơn.'}</p></div></div></section><section className="panel"><div className="panel-heading"><h2>Mục tiêu học tập</h2><button className="text-button" onClick={() => setModal({ type: 'goal', record: { student_id: student.id } })}><Plus size={16}/> Thêm mục tiêu</button></div>{data.goals.filter(g => g.student_id === student.id).map(g => <button className="goal-row" key={g.id} onClick={() => setModal({ type: 'goal', record: g })}><span className="goal-circle"><Check size={15}/></span><strong>{g.title}</strong><Tag tone={g.status === 'achieved' ? 'green' : 'sand'}>{goalNames[g.status]}</Tag><Pencil size={14}/></button>)}{!data.goals.some(g => g.student_id === student.id) && <Empty text="Chưa có mục tiêu"/>}</section></div><section className="panel"><div className="panel-heading"><h2>Người phụ trách</h2></div>{data.assignments.filter(a => a.student_id === student.id).map(a => <button className="assigned-person" key={a.id} onClick={() => { setNav('employees'); setEmployeeId(a.employee_id); }}><Avatar name={employeeName(a.employee_id)} color={data.employees.find(e => e.id === a.employee_id)?.color}/><div><strong>{employeeName(a.employee_id)}</strong><small>{a.responsibility === 'primary' ? 'Phụ trách chính' : 'Phối hợp giảng dạy'}</small></div><ChevronRight size={16}/></button>)}</section></div>}{studentTab === 'weekly' && <><div className="week-toolbar"><div className="row"><button className="icon-button" aria-label="Tuần trước" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={18}/></button><strong>Tuần {dateText(week)} – {dateText(addDays(week, 6))}/{week.slice(0, 4)}</strong><button className="icon-button" aria-label="Tuần sau" onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={18}/></button><button className="text-button" onClick={() => setWeek(monday())}>Tuần này</button></div><button className="btn primary" onClick={() => setModal({ type: 'weekly', record: data.weekly.find(w => w.student_id === student.id && w.week_start === week) || { student_id: student.id, week_start: week } })}><Pencil size={16}/> Cập nhật tiến trình</button></div><div className="weekly-stat"><Clock3 size={19}/><strong>{hours(totals(data.lessons.filter(l => l.student_id === student.id && inRange(l, week, addDays(week, 7)))).actual)} giờ thực dạy</strong><span>·</span><span>{data.lessons.filter(l => l.student_id === student.id && inRange(l, week, addDays(week, 7)) && l.status === 'completed').length} buổi hoàn thành</span></div>{(() => { const w = data.weekly.find(w => w.student_id === student.id && w.week_start === week); return w ? <div className="detail-grid"><section className="panel"><div className="panel-heading"><h2>Kết quả tuần</h2><Tag><Check size={12}/> Đã cập nhật</Tag></div><div className="panel-body prose"><h3>Tiến bộ & kết quả</h3><p>{w.progress || 'Chưa cập nhật'}</p><h3>Khó khăn & điều chỉnh</h3><p>{w.challenges || 'Chưa cập nhật'}</p><h3>Kế hoạch tuần tiếp theo</h3><p>{w.next_steps || 'Chưa cập nhật'}</p>{w.updated_at && <small>Cập nhật: {dateText(w.updated_at)} {timeText(w.updated_at)} · {data.profiles.find(p => p.id === w.updated_by)?.name || 'Quản trị viên'}</small>}</div></section><section className="panel"><div className="panel-heading"><h2>Mục tiêu của tuần</h2></div>{w.goal_snapshot.map((g, i) => <div className="goal-row" key={g.id || i}><strong>{g.title}</strong><Tag>{goalNames[g.status] || g.status}</Tag></div>)}{!w.goal_snapshot.length && <Empty text="Chưa ghi mục tiêu cho tuần này"/>}</section></div> : <section className="panel"><Empty text="Chưa cập nhật tiến trình tuần" detail="Chọn Cập nhật tiến trình để viết tổng hợp cho tuần này."/></section>; })()}<section className="panel"><div className="panel-heading"><h2>Các buổi học trong tuần</h2></div><LessonRows list={data.lessons.filter(l => l.student_id === student.id && inRange(l, week, addDays(week, 7)))}/></section></>}{studentTab === 'lessons' && <section className="panel"><div className="panel-heading"><h2>Lịch sử buổi học</h2><button className="text-button" onClick={() => setModal({ type: 'lesson', record: { student_id: student.id } })}><Plus size={16}/> Thêm buổi</button></div>{data.lessons.filter(l => l.student_id === student.id).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).map(l => <div className="history-item" key={l.id}><div className="row spread"><strong>{dateText(l.starts_at)} · {timeText(l.starts_at)} — {employeeName(l.employee_id)}</strong><Tag tone={l.status === 'completed' ? 'green' : 'sand'}>{statusNames[l.status]}</Tag></div><p>{l.note || l.content || 'Chưa có ghi chép'}</p><button className="text-button" onClick={() => setModal({ type: 'lesson', record: l })}>Xem chi tiết <ArrowRight size={15}/></button></div>)}</section>}{studentTab === 'parents' && <section className="panel"><div className="panel-heading"><h2>Phụ huynh</h2><button className="text-button" onClick={() => setModal({ type: 'family', record: { student_id: student.id } })}><Plus size={16}/> Liên kết phụ huynh</button></div>{data.families.filter(f => f.student_id === student.id).map(f => { const p = data.parents.find(p => p.id === f.parent_id); return <div className="family-card" key={f.id}><Avatar name={p?.name || 'Phụ huynh'} color="#c28b50"/><div><h3>{p?.name}</h3><p>{f.relationship} · {p?.email || 'Chưa có email'}</p><p>{p?.phone || 'Chưa cập nhật điện thoại'}</p></div>{f.is_primary && <Tag>Liên hệ chính</Tag>}<button className="icon-button" aria-label="Sửa liên kết" onClick={() => setModal({ type: 'family', record: f })}><Pencil size={16}/></button></div>; })}{!data.families.some(f => f.student_id === student.id) && <Empty text="Chưa liên kết phụ huynh"/>}</section>}</>}
 {navId === 'parents' && <DirectoryPage key="parents" kind="parents" data={data} add={() => setModal({ type: 'parent' })} open={id => setModal({ type: 'parent', record: data.parents.find(p => p.id === id) })} openStudent={openStudent}/>}
 {navId === 'accounts' && <><div className="page-heading"><div><h1>Tài khoản & quyền truy cập</h1></div><button className="btn primary" onClick={() => setModal({ type: 'invite' })}><Plus size={18}/> Mời thành viên</button></div><section className="panel table-wrap"><div className="panel-heading"><h2>Thành viên</h2></div><table><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th /></tr></thead><tbody>{data.profiles.map(p => <tr key={p.id}><td><strong>{p.name || p.email}</strong><small>{p.email}</small></td><td><Tag>{p.role === 'admin' ? 'Quản trị viên' : p.role === 'employee' ? 'Nhân sự' : 'Phụ huynh'}</Tag></td><td>{p.active ? 'Đang hoạt động' : 'Đã khóa'}</td><td><button className="icon-button" aria-label="Sửa quyền" onClick={() => setModal({ type: 'account', record: p })}><Pencil size={16}/></button></td></tr>)}</tbody></table></section><section className="panel table-wrap"><div className="panel-heading"><h2>Lời mời</h2></div><table><thead><tr><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Hết hạn</th><th /></tr></thead><tbody>{data.invitations.map(i => <tr key={i.id}><td>{i.email}</td><td>{i.role}</td><td>{i.status === 'accepted' ? 'Đã tham gia' : i.status === 'revoked' ? 'Đã thu hồi' : Date.parse(i.expires_at) < Date.now() ? 'Hết hạn' : 'Đang chờ'}</td><td>{dateText(i.expires_at)}</td><td>{i.status !== 'accepted' && <button className="text-button" onClick={() => setModal({ type: 'invite', record: i })}>Quản lý</button>}</td></tr>)}</tbody></table>{!data.invitations.length && <Empty text="Chưa có lời mời" detail="Mời giáo viên, phụ huynh hoặc quản trị viên bằng email."/>}</section></>}
 {toast && <div className="toast" role="status"><CheckCircle2 size={19}/>{toast}</div>}{modal && <Modal title={{ lesson: modal.record?.id ? 'Chi tiết buổi dạy' : 'Thêm buổi dạy', employee: 'Hồ sơ nhân sự', student: 'Hồ sơ học sinh', parent: 'Hồ sơ phụ huynh', weekly: 'Tiến trình tuần', goal: 'Mục tiêu học tập', family: 'Liên kết phụ huynh', invite: 'Mời thành viên', account: 'Quyền truy cập', help: 'Trợ giúp', setup: 'Kết nối dữ liệu thật' }[modal.type] || ''} close={close}>{modal.type === 'lesson' ? <LessonForm record={modal.record} data={data} save={save} busy={busy}/> : ['employee', 'student', 'parent', 'goal', 'weekly', 'family', 'account'].includes(modal.type) ? <RecordForm type={modal.type} record={modal.record} data={data} save={save} busy={busy}/> : modal.type === 'invite' ? <InviteForm record={modal.record} data={data} client={client} onDone={async () => { if (client)
        await refresh(client); close(); setToast('Đã cập nhật lời mời.'); }}/> : modal.type === 'setup' ? <div className="panel-body prose"><p>Giao diện hiện dùng dữ liệu mẫu. Để sử dụng với hồ sơ thật:</p><ol><li>Tạo project Supabase riêng cho Gánh Xiếc.</li><li>Chạy migration SQL đi kèm mã nguồn.</li><li>Cấu hình URL, khóa public và khóa server trong môi trường triển khai.</li><li>Bật Google/Facebook, cấu hình SMTP và URL chuyển hướng.</li><li>Xác minh email tranthanhtrivn@gmail.com để kích hoạt admin đầu tiên.</li></ol><p>Khi đã kết nối, website yêu cầu đăng nhập và không sử dụng dữ liệu mẫu.</p></div> : <div className="panel-body prose"><h3>Bắt đầu</h3><p>Thêm nhân sự → thêm học sinh và người phụ trách → liên kết phụ huynh → tạo lịch dạy.</p><h3>Sau mỗi buổi học</h3><p>Mở buổi dạy, ghi nhận kết quả và chọn Hoàn thành. Hủy hoặc vắng tính 0 giờ thực dạy.</p><h3>Tiến trình tuần</h3><p>Mở hồ sơ học sinh → Tiến trình tuần để ghi lại tiến bộ, khó khăn và kế hoạch tiếp theo.</p><h3>Tài khoản và quyền</h3><p>Chỉ tài khoản được mời và đã xác minh email mới được truy cập. Admin đầu tiên: tranthanhtrivn@gmail.com. Không thể khóa admin hoạt động cuối cùng.</p></div>}</Modal>}</AppShell>;
}
