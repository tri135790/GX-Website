import { StudentProfile } from './student-profile';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyData, statusNames, type Data, type Profile, type Lesson, type Employee } from '@/lib/gx/types';
import { localDate, timeText } from '@/lib/gx/domain';
import { AppShell } from './app-shell';
import { CalendarPage } from './calendar-page';
import { Field, Modal } from './shared';
type Workspace={students:{id:string;name:string;active:boolean}[];employees:Pick<Employee,'id'|'name'|'color'>[];lessons:Omit<Lesson,'version'|'reason'|'note'|'content'|'series_id'>[]};
const empty:Workspace={students:[],employees:[],lessons:[]};
export function ParentApp({client,user}:{client:SupabaseClient;user:Profile}){
 const [data,setData]=useState(empty),[page,setPage]=useState('calendar'),[studentId,setStudentId]=useState(''),[filter,setFilter]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[lessonId,setLessonId]=useState<string|null>(null),[help,setHelp]=useState(false);
 const seq=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++seq.current;const {data:next,error:failure}=await client.rpc('parent_workspace');if(request!==seq.current)return;
  setLoading(false);if(failure){setData(empty);setStudentId('');setLessonId(null);setError(failure.message);return;}
  setData(next);setError('');setStudentId(id=>next.students.some((s:any)=>s.id===id)?id:next.students[0]?.id||'');setLessonId(id=>next.lessons.some((l:any)=>l.id===id)?id:null);
 },[client]);
 useEffect(()=>{const reload=()=>void refresh();reload();window.addEventListener('focus',reload);const timer=setInterval(reload,30000);return()=>{++seq.current;clearInterval(timer);window.removeEventListener('focus',reload);};},[refresh]);
 const student=data.students.find(s=>s.id===studentId),lessons=data.lessons.filter(l=>l.student_id===studentId);
 const calendarData:Data={...emptyData,students:student?[{...student,version:0,birth_date:'',start_date:'',notes:''}]:[],employees:data.employees.map(e=>({...e,version:0,email:'',phone:'',specialty:'',active:true})),lessons:lessons.map(l=>({...l,version:0,reason:'',note:'',content:'',series_id:null}))};
 const lesson=lessons.find(l=>l.id===lessonId);
 return <AppShell page={page} go={setPage} user={user} demo={false} setup={()=>{}} help={()=>setHelp(true)} logout={()=>{void client.auth.signOut();}}>
  {error&&<div className="error" role="alert">{error}<button className="btn" onClick={()=>void refresh()}>Tải lại</button></div>}
  {loading?<p role="status">Đang tải lịch của con…</p>:!error&&<>
   <Field label="Chọn con"><select value={studentId} onChange={e=>{setStudentId(e.target.value);setLessonId(null);setFilter('');}}>{data.students.map(s=><option key={s.id} value={s.id}>{s.name}{s.active?'':' · Đã ngừng'}</option>)}</select></Field>
   {!student?<p>Chưa có học sinh được liên kết. Vui lòng liên hệ quản trị viên.</p>:page==='calendar'?<><StudentProfile key={studentId+'reminders'} client={client} studentId={studentId} user={user} compact/><CalendarPage key={studentId} title="Lịch của con" readOnly showCapacity={false} data={calendarData} busy={false} employeeFilter={filter} setEmployeeFilter={setFilter} openLesson={l=>setLessonId(l?.id||null)} openWeekly={()=>setPage('weekly')}/></>:<><div className="page-heading"><h1>Hồ sơ · {student.name}</h1></div><StudentProfile key={studentId} client={client} studentId={studentId} user={user}/></>}

  </>}
  {lesson&&<Modal title={student?.name||'Buổi học'} close={()=>setLessonId(null)}><p>{localDate(lesson.starts_at)} · {timeText(lesson.starts_at)}–{timeText(lesson.ends_at)}</p><p>{data.employees.find(e=>e.id===lesson.employee_id)?.name} · {lesson.mode==='online'?'Online':'Offline'} · {statusNames[lesson.status]}</p><h3>Địa điểm / đường dẫn lớp học</h3><p className="employee-note">{lesson.location}</p>{/^https?:\/\//i.test(lesson.meeting_url||lesson.location)&&<a className="btn" href={lesson.meeting_url||lesson.location} target="_blank" rel="noopener noreferrer">Mở lớp học</a>}</Modal>}
  {help&&<Modal title="Dành cho phụ huynh" close={()=>setHelp(false)}><p>Bạn chỉ xem lịch của con được liên kết với tài khoản. Trong Hồ sơ học sinh, bạn xem thông tin, tiến trình, báo cáo và lịch sử đánh giá. Bạn làm ATEC/Stress và không thể sửa kết quả đã nộp. Liên hệ admin khi cần đổi lịch hoặc liên kết học sinh.</p></Modal>}
 </AppShell>;
}
