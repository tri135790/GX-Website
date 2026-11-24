import { StudentProfile } from './student-profile';
import { participantIds, hasParticipant, multiParticipantWork } from '@/lib/gx/domain';
import {TeacherProfiles} from './teacher-profiles';
import {ProfileHours} from './profile-hours';
import { WorkReport } from './work-report';
import { WorkForm } from './work-form';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Student, Lesson } from '@/lib/gx/types';
import { statusNames } from '@/lib/gx/types';
import { addDays, monday, dateText, timeText, localDate, needsReport } from '@/lib/gx/domain';
import { loadEmployee, calendarData, saveEmployee, type Workspace, type CalendarRow } from '@/lib/gx/employee-client';
import { AppShell } from './app-shell';
import { CalendarPage } from './calendar-page';
import { Modal } from './shared';
import { EmployeeEditor, type EmployeeEdit } from './employee-editor';
const initial:Workspace={teachers:[],teacher_goals:[],teacher_weekly:[],work_locations:[],students:[],assignments:[],goals:[],weekly:[],lessons:[],employees:[],authors:[]};
export function EmployeeApp({client,user}:{client:SupabaseClient;user:Profile}){
    const [creating,setCreating]=useState(false),[workspace,setWorkspace]=useState(initial),[rows,setRows]=useState<CalendarRow[]>([]),[page,setPage]=useState('calendar'),[studentId,setStudentId]=useState<string|null>(null),[filter,setFilter]=useState(''),[search,setSearch]=useState(''),[all,setAll]=useState(false),[help,setHelp]=useState(false),[edit,setEdit]=useState<EmployeeEdit|null>(null),[lessonId,setLessonId]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[range,setRange]=useState({start:monday(),end:addDays(monday(),7)});
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
            setCreating(false);setWorkspace(initial);setRows([]);setEdit(null);setStudentId(null);setLessonId(null);setError(e.message||'Không tải được dữ liệu.');
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
    const showStudent=(s:Student)=>{setStudentId(s.id);};
    const projection=(table:EmployeeEdit['table'],record:any):EmployeeEdit=>{
        const keys=table==='students'?['id','version','notes']:table==='goals'?['id','version','student_id','title','status']:table==='lessons'?['id','version','content','note']:['id','version','student_id','week_start','progress','challenges','next_steps','goal_snapshot'];
        return {table,record:Object.fromEntries(keys.map(k=>[k,record[k]]))};
    };
    return <AppShell page={page} go={p=>{setPage(p);setStudentId(null);}} user={user} demo={false} help={()=>setHelp(true)} setup={()=>{}} logout={()=>{void client.auth.signOut();}}>
        {error&&<div className="error" role="alert">{error}<button className="btn" onClick={()=>void refresh().catch(()=>{})}>Tải lại</button></div>}
        {notice&&<p className="notice" role="status">{notice}</p>}
        {loading?<p role="status">Đang tải dữ liệu…</p>:!error&&<>
        {page==='teachers'?<TeacherProfiles data={{...calendarData(workspace,rows),students:workspace.students,lessons:workspace.lessons}} admin={false} busy={busy} openWork={setLessonId} save={async changes=>{setBusy(true);try{for(const c of changes){const keys=c.table==='teacher_goals'?['id','version','teacher_id','title','status']:['id','version','teacher_id','week_start','progress','challenges','next_steps','goal_snapshot'];const {error}=await client.rpc('save_teacher_progress',{p_table:c.table,p_record:Object.fromEntries(keys.map(k=>[k,(c.record as any)[k]]))});if(error)throw error;}await refresh();}finally{setBusy(false);}}}/>:page==='calendar'?<><ProfileHours employeeId={user.employee_id||undefined} lessons={workspace.lessons.filter(l=>hasParticipant(l,user.employee_id))}/><section className="panel"><div className="panel-heading"><h2>Cần xử lý · {workspace.lessons.filter(l=>l.employee_id===user.employee_id&&!multiParticipantWork(l)&&needsReport(l)).length}</h2></div>{workspace.lessons.filter(l=>l.employee_id===user.employee_id&&!multiParticipantWork(l)&&needsReport(l)).map(l=><button className="task-row" key={l.id} onClick={()=>setLessonId(l.id)}>{dateText(l.starts_at)} · {timeText(l.starts_at)} · {l.student_id?studentName(l.student_id):'Công việc'}</button>)}</section><CalendarPage data={calendarData(workspace,rows)} busy={busy} readOnly onCreate={()=>setCreating(true)} ownEmployeeId={user.employee_id||undefined} onRange={onRange} employeeFilter={filter} setEmployeeFilter={setFilter} openLesson={l=>{if(l?.id)setLessonId(l.id);}} openWeekly={()=>{}}/></>:student?<>
            <div className="page-heading"><h1>{student.name}</h1><button className="btn" onClick={()=>setStudentId(null)}>Danh sách học sinh</button></div>
            <StudentProfile key={student.id+student.version} client={client} studentId={student.id} user={user} editStudent={student.active?s=>setEdit(projection('students',s)):undefined} openLesson={l=>setLessonId(l.id)}/>
        </>:<><div className="page-heading"><h1>Phụ trách · {workspace.students.length}</h1></div><div className="filters"><input aria-label="Tìm học sinh" placeholder="Tìm theo tên" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="panel employee-list">{workspace.students.filter(s=>s.active&&s.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).map(s=><button className="task-row" key={s.id} onClick={()=>showStudent(s)}><div><strong>{s.name}</strong><small>{workspace.assignments.find(a=>a.student_id===s.id&&a.employee_id===user.employee_id)?.responsibility==='primary'?'Phụ trách chính':'Phối hợp'}</small></div><span>Xem hồ sơ</span></button>)}{!workspace.students.length&&<p>Chưa có học sinh được phân công.</p>}</div></>}
        </>}
        {creating&&<Modal title="Thêm giờ làm" close={()=>{if(!busy)setCreating(false);}}><WorkForm employeeId={user.employee_id||undefined} data={{...calendarData(workspace,rows),students:workspace.students,assignments:workspace.assignments,lessons:workspace.lessons}} busy={busy} save={async changes=>{setBusy(true);try{const {error}=await client.rpc('employee_create_work',{p_records:changes.map(c=>c.record)});if(error)throw Error(error.code==='23P01'?'Nhân sự hoặc học sinh đã có lịch trùng giờ.':error.message);await refresh();setCreating(false);setNotice('Đã lưu giờ làm.');}finally{setBusy(false);}}}/></Modal>}
        {help&&<Modal title="Quyền nhân sự" close={()=>setHelp(false)}><p>Bạn xem được lịch toàn bộ giáo viên. Chỉ học sinh được phân công mới mở được hồ sơ và chi tiết. Bạn cập nhật lưu ý tuần và báo cáo tư vấn để chia sẻ ngay với phụ huynh; chỉ ghi nội dung/note buổi mình dạy. Bạn được tự thêm giờ làm của mình; giờ chỉ được cộng khi xác nhận hoàn thành. Admin quản lý và điều chỉnh lịch.</p></Modal>}
        {lessonId&&(lesson||summary)&&!edit&&<Modal title={(lesson||summary)!.student_id?studentName((lesson||summary)!.student_id):'Giờ làm'} close={()=>setLessonId(null)}><p>{localDate((lesson||summary)!.starts_at)} · {timeText((lesson||summary)!.starts_at)}–{timeText((lesson||summary)!.ends_at)}</p><p>{participantIds((lesson||summary)!).map(teacherName).join(', ')} · {(lesson||summary)!.mode} · {statusNames[(lesson||summary)!.status]}</p>{lesson?<><p>Địa điểm: {lesson.location}</p>{/^https?:\/\//i.test(lesson.meeting_url||lesson.location)&&<a className="btn" href={lesson.meeting_url||lesson.location} target="_blank" rel="noopener noreferrer">Mở lớp học</a>}<p>Thực dạy: {lesson.actual_minutes} phút · {lesson.reason}</p><h3>Nội dung giảng dạy</h3><p className="employee-note">{lesson.content||'—'}</p><h3>Ghi chú</h3><p className="employee-note">{lesson.note||'—'}</p>{lesson.employee_id===user.employee_id&&!multiParticipantWork(lesson)&&!lesson.primary_pending&&lesson.status!=='cancelled'&&lesson.work_kind!=='leave'&&<WorkReport key={lesson.id+':'+lesson.version} lesson={lesson} client={client} onDone={refresh}/>}
{lesson.employee_id===user.employee_id&&workspace.students.find(s=>s.id===lesson.student_id)?.active&&<button className="btn primary" onClick={()=>setEdit(projection('lessons',lesson))}>Cập nhật nội dung và ghi chú</button>}</>:<p className="muted">Chỉ xem thông tin lịch. Bạn chưa được phân công học sinh này.</p>}</Modal>}
        {edit&&<Modal title={edit.table==='lessons'?'Nội dung buổi học':'Lưu ý hỗ trợ'} close={()=>{if(!busy)setEdit(null);}}><EmployeeEditor goals={workspace.goals.filter(g=>g.student_id===edit.record.student_id)} edit={edit} latest={()=>{const list=workspace[edit.table];const current=list.find((r:any)=>r.id===edit.record.id||(edit.table==='weekly'&&r.student_id===edit.record.student_id&&r.week_start===edit.record.week_start));return current?projection(edit.table,current).record:undefined;}} save={async record=>{setBusy(true);try{await saveEmployee(client,edit.table,record);await refresh();setEdit(null);setNotice('Đã lưu.');}catch(e){await refresh().catch(()=>{});throw e;}finally{setBusy(false);}}}/></Modal>}
    </AppShell>;
}
