import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Student, Lesson } from '@/lib/gx/types';
import { goalNames, statusNames } from '@/lib/gx/types';
import { addDays, monday, hours, totals, inRange, dateText, timeText, localDate } from '@/lib/gx/domain';
import { loadEmployee, calendarData, saveEmployee, type Workspace, type CalendarRow } from '@/lib/gx/employee-client';
import { AppShell } from './app-shell';
import { CalendarPage } from './calendar-page';
import { Modal, Field, uid } from './shared';
import { EmployeeEditor, type EmployeeEdit } from './employee-editor';
const initial:Workspace={students:[],assignments:[],goals:[],weekly:[],lessons:[],employees:[],authors:[]};
export function EmployeeApp({client,user}:{client:SupabaseClient;user:Profile}){
    const [workspace,setWorkspace]=useState(initial),[rows,setRows]=useState<CalendarRow[]>([]),[page,setPage]=useState('calendar'),[studentId,setStudentId]=useState<string|null>(null),[tab,setTab]=useState('info'),[week,setWeek]=useState(monday()),[filter,setFilter]=useState(''),[search,setSearch]=useState(''),[all,setAll]=useState(false),[help,setHelp]=useState(false),[edit,setEdit]=useState<EmployeeEdit|null>(null),[lessonId,setLessonId]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[range,setRange]=useState({start:monday(),end:addDays(monday(),7)});
    const sequence=useRef(0);
    const refresh=useCallback(async()=>{
        const seq=++sequence.current;
        try{
            const next=await loadEmployee(client,range.start,range.end);
            if(seq!==sequence.current)return;
            setWorkspace(next.workspace);setRows(next.calendar);setError('');
            setStudentId(id=>id&&!next.workspace.students.some(s=>s.id===id)?null:id);
            setEdit(current=>{
                if(!current)return null;
                const sid=current.table==='students'?current.record.id:current.table==='lessons'?next.workspace.lessons.find(l=>l.id===current.record.id)?.student_id:current.record.student_id;
                return next.workspace.students.some(s=>s.id===sid&&s.active)?current:null;
            });
        }catch(e:any){
            if(seq!==sequence.current)return;
            setWorkspace(initial);setRows([]);setEdit(null);setStudentId(null);setLessonId(null);setError(e.message||'Không tải được dữ liệu.');
            throw e;
        }finally{if(seq===sequence.current)setLoading(false);}
    },[client,range.start,range.end]);
    useEffect(()=>{void refresh().catch(()=>{});const focus=()=>void refresh().catch(()=>{});window.addEventListener('focus',focus);const timer=setInterval(focus,30000);return()=>{++sequence.current;clearInterval(timer);window.removeEventListener('focus',focus);};},[refresh]);
    const onRange=useCallback((start:string,end:string)=>setRange(r=>r.start===start&&r.end===end?r:{start,end}),[]);
    const student=workspace.students.find(s=>s.id===studentId);
    const lesson=workspace.lessons.find(l=>l.id===lessonId);
    const summary=rows.find(l=>l.id===lessonId);
    const studentName=(id:string)=>workspace.students.find(s=>s.id===id)?.name||rows.find(l=>l.student_id===id)?.student_name||'Học sinh';
    const teacherName=(id:string)=>workspace.employees.find(e=>e.id===id)?.name||rows.find(l=>l.employee_id===id)?.employee_name||'Giáo viên';
    const showStudent=(s:Student)=>{setStudentId(s.id);setTab('info');setWeek(monday());};
    const projection=(table:EmployeeEdit['table'],record:any):EmployeeEdit=>{
        const keys=table==='students'?['id','version','notes']:table==='goals'?['id','version','student_id','title','status']:table==='lessons'?['id','version','content','note']:['id','version','student_id','week_start','progress','challenges','next_steps','goal_snapshot'];
        return {table,record:Object.fromEntries(keys.map(k=>[k,record[k]]))};
    };
    const weekly=student&&workspace.weekly.find(w=>w.student_id===student.id&&w.week_start===week);
    const goals=workspace.goals.filter(g=>g.student_id===student?.id);
    const lessons=workspace.lessons.filter(l=>l.student_id===student?.id).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));
    const weekLessons=lessons.filter(l=>inRange(l,week,addDays(week,7))&&l.status==='completed');
    const lessonList=(list:Lesson[])=>list.length?<div className="lesson-list">{list.map(l=><button className="task-row" key={l.id} onClick={()=>setLessonId(l.id)}><div><strong>{dateText(l.starts_at)}/{localDate(l.starts_at).slice(0,4)} · {timeText(l.starts_at)}–{timeText(l.ends_at)}</strong><small>{teacherName(l.employee_id)} · {statusNames[l.status]}</small></div></button>)}</div>:<p>Chưa có buổi học.</p>;
    return <AppShell page={page} go={p=>{setPage(p);setStudentId(null);}} user={user} demo={false} help={()=>setHelp(true)} setup={()=>{}} logout={()=>{void client.auth.signOut();}}>
        {error&&<div className="error" role="alert">{error}<button className="btn" onClick={()=>void refresh().catch(()=>{})}>Tải lại</button></div>}
        {notice&&<p className="notice" role="status">{notice}</p>}
        {loading?<p role="status">Đang tải dữ liệu…</p>:!error&&<>
        {page==='calendar'?<CalendarPage data={calendarData(workspace,rows)} busy={busy} readOnly ownEmployeeId={user.employee_id||undefined} onRange={onRange} employeeFilter={filter} setEmployeeFilter={setFilter} openLesson={l=>{if(l?.id)setLessonId(l.id);}} openWeekly={()=>{}}/>:student?<>
            <div className="page-heading"><h1>{student.name} · {student.active?'Đang hoạt động':'Đã ngừng'}</h1><button className="btn" onClick={()=>setStudentId(null)}>Danh sách học sinh</button></div>
            <div className="segmented">{[['info','Thông tin'],['weekly','Tiến trình tuần'],['lessons','Buổi học']].map(([id,name])=><button key={id} aria-pressed={tab===id} className={tab===id?'selected':''} onClick={()=>setTab(id)}>{name}</button>)}</div>
            {tab==='info'&&<section className="panel employee-panel"><p>Ngày sinh: {student.birth_date} · Bắt đầu: {student.start_date}</p><p>Phụ trách: {workspace.assignments.filter(a=>a.student_id===student.id).map(a=>`${teacherName(a.employee_id)} (${a.responsibility==='primary'?'chính':'phối hợp'})`).join(', ')}</p><h2>Lưu ý hỗ trợ</h2><p className="employee-note">{student.notes||'Chưa có lưu ý.'}</p>{student.active&&<button className="btn" onClick={()=>setEdit(projection('students',student))}>Sửa lưu ý</button>}<h2>Mục tiêu</h2>{goals.map(g=><div className="task-row" key={g.id}><span>{g.title} · {goalNames[g.status]}</span>{student.active&&<button className="btn" onClick={()=>setEdit(projection('goals',g))}>Chỉnh sửa</button>}</div>)}{student.active&&<button className="btn" onClick={()=>setEdit({table:'goals',record:{id:uid(),version:0,student_id:student.id,title:'',status:'new'}})}>Thêm mục tiêu</button>}</section>}
            {tab==='weekly'&&<section className="panel employee-panel"><Field label="Chọn tuần"><input type="date" value={week} onChange={e=>{if(e.target.value)setWeek(monday(e.target.value));}}/></Field><p>{weekLessons.length} buổi hoàn thành · {hours(totals(weekLessons).actual)} giờ thực dạy</p>{weekly?<><p className="muted">Cập nhật bởi {workspace.authors.find(p=>p.id===weekly.updated_by)?.name||'Thành viên'} · {weekly.updated_at?new Date(weekly.updated_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—'}</p><h3>Mục tiêu tuần</h3><ul>{weekly.goal_snapshot.map(g=><li key={g.id}>{g.title} · {goalNames[g.status as keyof typeof goalNames]}</li>)}</ul>{[['Kết quả',weekly.progress],['Khó khăn',weekly.challenges],['Kế hoạch tiếp theo',weekly.next_steps]].map(([label,value])=><div key={label}><h3>{label}</h3><p className="employee-note">{value||'—'}</p></div>)}</>:<p>Chưa cập nhật tuần này.</p>}{student.active&&<button className="btn primary" onClick={()=>setEdit(projection('weekly',weekly||{id:uid(),version:0,student_id:student.id,week_start:week,progress:'',challenges:'',next_steps:'',goal_snapshot:goals.map(({id,title,status})=>({id,title,status}))}))}>{weekly?'Cập nhật tiến trình':'Thêm tiến trình'}</button>}<h3>Lịch sử tuần</h3><div className="row employee-history">{workspace.weekly.filter(w=>w.student_id===student.id).sort((a,b)=>b.week_start.localeCompare(a.week_start)).map(w=><button className="btn" key={w.id} onClick={()=>setWeek(w.week_start)}>{w.week_start}</button>)}</div></section>}
            {tab==='lessons'&&lessonList(lessons)}
        </>:<><div className="page-heading"><h1>Học sinh phụ trách · {workspace.students.length}</h1></div><div className="filters"><input aria-label="Tìm học sinh" placeholder="Tìm theo tên" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Lọc trạng thái học sinh" value={all?'all':'active'} onChange={e=>setAll(e.target.value==='all')}><option value="active">Đang hoạt động</option><option value="all">Tất cả</option></select></div><div className="panel employee-list">{workspace.students.filter(s=>(all||s.active)&&s.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).map(s=><button className="task-row" key={s.id} onClick={()=>showStudent(s)}><div><strong>{s.name}</strong><small>{workspace.assignments.find(a=>a.student_id===s.id&&a.employee_id===user.employee_id)?.responsibility==='primary'?'Phụ trách chính':'Phối hợp'} · {s.active?'Đang hoạt động':'Đã ngừng'}</small></div><span>{workspace.weekly.some(w=>w.student_id===s.id&&w.week_start===monday())?'Đã cập nhật tuần':'Chưa cập nhật tuần'}</span></button>)}{!workspace.students.length&&<p>Chưa có học sinh được phân công.</p>}</div></>}
        </>}
        {help&&<Modal title="Quyền nhân sự" close={()=>setHelp(false)}><p>Bạn xem được lịch toàn bộ giáo viên. Chỉ học sinh được phân công mới mở được hồ sơ và chi tiết. Bạn cập nhật lưu ý, mục tiêu, tiến trình; chỉ ghi nội dung/note buổi mình dạy. Admin quản lý lịch và xác nhận giờ.</p></Modal>}
        {lessonId&&(lesson||summary)&&!edit&&<Modal title={studentName((lesson||summary)!.student_id)} close={()=>setLessonId(null)}><p>{localDate((lesson||summary)!.starts_at)} · {timeText((lesson||summary)!.starts_at)}–{timeText((lesson||summary)!.ends_at)}</p><p>{teacherName((lesson||summary)!.employee_id)} · {(lesson||summary)!.mode} · {statusNames[(lesson||summary)!.status]}</p>{lesson?<><p>Địa điểm/link học: {lesson.location}</p><p>Thực dạy: {lesson.actual_minutes} phút · {lesson.reason}</p><h3>Nội dung giảng dạy</h3><p className="employee-note">{lesson.content||'—'}</p><h3>Ghi chú</h3><p className="employee-note">{lesson.note||'—'}</p>{lesson.employee_id===user.employee_id&&workspace.students.find(s=>s.id===lesson.student_id)?.active&&<button className="btn primary" onClick={()=>setEdit(projection('lessons',lesson))}>Cập nhật nội dung và ghi chú</button>}</>:<p className="muted">Chỉ xem thông tin lịch. Bạn chưa được phân công học sinh này.</p>}</Modal>}
        {edit&&<Modal title={edit.table==='weekly'?'Tiến trình tuần':edit.table==='goals'?'Mục tiêu':edit.table==='lessons'?'Nội dung buổi học':'Lưu ý hỗ trợ'} close={()=>{if(!busy)setEdit(null);}}><EmployeeEditor goals={workspace.goals.filter(g=>g.student_id===edit.record.student_id)} edit={edit} latest={()=>{const list=workspace[edit.table];const current=list.find((r:any)=>r.id===edit.record.id||(edit.table==='weekly'&&r.student_id===edit.record.student_id&&r.week_start===edit.record.week_start));return current?projection(edit.table,current).record:undefined;}} save={async record=>{setBusy(true);try{await saveEmployee(client,edit.table,record);await refresh();setEdit(null);setNotice('Đã lưu.');}catch(e){await refresh().catch(()=>{});throw e;}finally{setBusy(false);}}}/></Modal>}
    </AppShell>;
}
