import { useCallback, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/gx/types';
import { assessmentDefinitions, assessmentVersion, type AssessmentKind } from '@/lib/gx/assessment-definitions';
import { assessmentDue, type Assessment, type StudentProfileData } from '@/lib/gx/student-profile';
import { Modal } from './shared';
const stamp=(s:string|number)=>new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
export function AssessmentPanel({data,user,client,reload,compact=false}:{data:StudentProfileData;user:Profile|null;client:SupabaseClient|null;reload:()=>Promise<void>;compact?:boolean}){
 const [doing,setDoing]=useState<AssessmentKind|null>(null),[view,setView]=useState<Assessment|null>(null);
 const parent=user?.role==='parents';
 const authors=(id:string)=>data.authors.find(a=>a.id===id)?.name||'Phụ huynh';
 return <><div className="profile-assessments">{(['atec','stress'] as const).map(kind=>{
 const people=kind==='stress'&&!parent?data.parents:[{id:user?.parent_id||'',name:''}];
 return <section className="panel panel-body" key={kind}><h2>{kind.toUpperCase()}</h2>{people.map(p=>{const due=assessmentDue(kind,data.student.start_date,data.assessments,p.id);return <p key={p.id}>{p.name&&`${p.name}: `}{due.due===null?'Chưa có ngày bắt đầu':`${due.overdue?'Đến hạn làm bài':'Lần tiếp theo'}: ${stamp(due.due)}`}</p>;})}{parent&&data.student.active&&client&&<button className="btn primary" onClick={()=>setDoing(kind)}>Làm bài {kind.toUpperCase()}</button>}{!data.student.active&&<p>Học sinh đã ngừng hoạt động · Chỉ xem lịch sử.</p>}</section>;
 })}</div>{!compact&&<section className="panel panel-body"><h2>Lịch sử đánh giá</h2>{!data.assessments.length&&<p>Chưa có kết quả.</p>}{data.assessments.map(a=><button className="task-row" key={a.id} onClick={()=>setView(a)}><span>{a.kind.toUpperCase()} · {stamp(a.submitted_at)} · {authors(a.submitted_by)}</span><strong>{a.total_score} / {a.kind==='atec'?179:150}</strong></button>)}</section>}
 {doing&&client&&<AssessmentForm key={doing} kind={doing} studentId={data.student.id} client={client} close={()=>setDoing(null)} saved={async()=>{setDoing(null);await reload();}}/>}
 {view&&<Modal title={`${view.kind.toUpperCase()} · ${stamp(view.submitted_at)}`} close={()=>setView(null)}><div className="assessment-history"><p>{authors(view.submitted_by)} · Tổng điểm: {view.total_score}</p>{assessmentDefinitions[view.kind].map((s,i)=>{const offset=assessmentDefinitions[view.kind].slice(0,i).reduce((n,x)=>n+x.questions.length,0);return <section key={s.title}><h3>{s.title}: {view.section_scores[i]} / {s.max}</h3>{s.questions.map((q,j)=><p key={q}><strong>{offset+j+1}. {q}</strong><br/>{s.options[view.answers[offset+j]]?.label}</p>)}</section>;})}</div></Modal>}
 </>;
}
function AssessmentForm({kind,studentId,client,close,saved}:{kind:AssessmentKind;studentId:string;client:SupabaseClient;close:()=>void;saved:()=>Promise<void>}){
 const definitions=assessmentDefinitions[kind],count=definitions.reduce((n,s)=>n+s.questions.length,0);
 const [answers,setAnswers]=useState<number[]>(()=>Array(count).fill(-1)),[id]=useState(()=>crypto.randomUUID()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempted,setAttempted]=useState(false),[submitted,setSubmitted]=useState(false);
 const dirty=answers.some(a=>a>=0);
 const dismiss=useCallback(()=>{if(!busy&&(!dirty||submitted||confirm('Đóng bài đánh giá? Câu trả lời chưa nộp sẽ không được lưu.')))close();},[busy,dirty,submitted,close]);
 return <Modal title={`Đánh giá ${kind.toUpperCase()}`} close={dismiss}><form className="form" onSubmit={async e=>{e.preventDefault();setAttempted(true);if(answers.includes(-1)){setError('Vui lòng trả lời các câu còn thiếu.');return;}setBusy(true);setError('');try{const {error:failure}=await client.rpc('submit_student_assessment',{p_id:id,p_student:studentId,p_kind:kind,p_form_version:assessmentVersion,p_answers:answers});if(failure)throw new Error(failure.message);setSubmitted(true);await saved();}catch(e){setError(e instanceof Error?e.message:'Không lưu được. Hãy thử lại.');}finally{setBusy(false);}}}>
 <p>Chọn mô tả phù hợp nhất. Đã trả lời {answers.filter(a=>a>=0).length}/{count}. Kết quả đã nộp không thể chỉnh sửa.</p>
 {definitions.map((s,i)=>{const offset=definitions.slice(0,i).reduce((n,x)=>n+x.questions.length,0);return <section key={s.title}><h3>{s.title}</h3>{s.questions.map((q,j)=>{const index=offset+j;return <fieldset className="assessment-question" key={q} aria-invalid={attempted&&answers[index]<0}><legend>{index+1}. {q}{attempted&&answers[index]<0&&' — Chưa trả lời'}</legend>{s.options.map((o,k)=><label key={o.label}><input disabled={busy||submitted} type="radio" name={`question-${index}`} checked={answers[index]===k} onChange={()=>setAnswers(old=>old.map((v,n)=>n===index?k:v))}/>{o.label}</label>)}</fieldset>;})}</section>;})}
 {error&&<p role="alert" className="error">{error}</p>}<div className="form-footer"><button className="btn primary" disabled={busy||submitted}>{busy?'Đang nộp…':'Nộp bài đánh giá'}</button></div>
 </form></Modal>;
}
