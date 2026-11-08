import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Weekly } from '@/lib/gx/types';
import { goalNames } from '@/lib/gx/types';
import { Field, Modal } from './shared';

type Report = { version:number; week_start:string; goals:string; progress:string; guidance:string; published:boolean; updated_at:string; updated_by:string };
type Update = { version:number; week_start:string; author_id:string; progress:string; challenges:string; practice:string; questions:string; updated_at:string };
type FamilyData = {reports:Report[];updates:Update[];authors:{id:string;name:string}[];active:boolean};
const empty:FamilyData={reports:[],updates:[],authors:[],active:false};
const reportFields=[['goals','Mục tiêu'],['progress','Kết quả'],['guidance','Hướng dẫn hỗ trợ tại nhà']];
const updateFields=[['progress','Điểm tiến bộ tại nhà'],['challenges','Khó khăn hoặc thay đổi'],['practice','Hoạt động đã thực hành'],['questions','Trao đổi với giáo viên']];
const timestamp=(value:string)=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});

export function FamilyWeekly({client,studentId,week,setWeek,userId,staff=false,source,onDenied}:{client:SupabaseClient;studentId:string;week:string;setWeek:(week:string)=>void;userId?:string;staff?:boolean;source?:Weekly;onDenied?:()=>void}){
 const [data,setData]=useState(empty),[error,setError]=useState(''),[loading,setLoading]=useState(true),[editing,setEditing]=useState(false),[notice,setNotice]=useState('');
 const seq=useRef(0),denied=useRef(onDenied);denied.current=onDenied;
 const load=useCallback(async()=>{
  const request=++seq.current;
  const {data:next,error:failure}=await client.rpc('family_weekly',{p_student:studentId});
  if(request!==seq.current)return;
  setLoading(false);
  if(failure){setData(empty);setEditing(false);setError(failure.message);if(failure.code==='42501')denied.current?.();throw failure;}
  setData(next);setError('');if(!next.active)setEditing(false);
 },[client,studentId]);
 useEffect(()=>{setData(empty);setLoading(true);setEditing(false);const reload=()=>void load().catch(()=>{});reload();window.addEventListener('focus',reload);const timer=setInterval(reload,30000);return()=>{++seq.current;clearInterval(timer);window.removeEventListener('focus',reload);};},[load]);
 const report=data.reports.find(r=>r.week_start===week),mine=data.updates.find(u=>u.week_start===week&&u.author_id===userId);
 const fields=staff?reportFields:updateFields;
 const record=staff?report:mine;
 const history=[...new Set([...data.reports,...data.updates].map(r=>r.week_start))].sort().reverse();
 const name=(id:string)=>data.authors.find(a=>a.id===id)?.name||'Thành viên';
 if(loading)return <p role="status">Đang tải cập nhật gia đình…</p>;
 if(error)return <div role="alert" className="error">{error}<button className="btn" onClick={()=>void load().catch(()=>{})}>Tải lại</button></div>;
 return <section className="panel employee-panel">
  {notice&&<p role="status">{notice}</p>}
  <h2>Tiến trình từ giáo viên</h2>
  {report?<><p>{report.published?'Đã chia sẻ với gia đình':'Bản nháp · Phụ huynh chưa xem được'}</p>{reportFields.map(([key,label])=><div key={key}><h3>{label}</h3><p className="employee-note">{report[key as 'goals']||'—'}</p></div>)}<small>{name(report.updated_by)} · {timestamp(report.updated_at)}</small></>:<p>Chưa có tiến trình được chia sẻ cho tuần này.</p>}
  {staff&&data.active&&<button className="btn primary" onClick={()=>setEditing(true)}>Soạn bản gửi gia đình</button>}
  <h2>Cập nhật từ gia đình</h2>
  {data.updates.filter(u=>u.week_start===week).map(u=><article className="family-update" key={u.author_id}><h3>{name(u.author_id)}{u.author_id===userId?' (Bạn)':''}</h3>{updateFields.map(([key,label])=><div key={key}><strong>{label}</strong><p className="employee-note">{u[key as 'progress']||'—'}</p></div>)}<small>Cập nhật {timestamp(u.updated_at)}</small></article>)}
  {!data.updates.some(u=>u.week_start===week)&&<p>Chưa có cập nhật từ gia đình.</p>}
  {!staff&&data.active&&<button className="btn primary" onClick={()=>setEditing(true)}>{mine?'Sửa cập nhật của tôi':'Thêm cập nhật của tôi'}</button>}
  {!data.active&&<p>Học sinh đã ngừng hoạt động · Chỉ xem lịch sử.</p>}
  <h3>Lịch sử tuần</h3><div className="row employee-history">{history.map(w=><button key={w} className="btn" aria-pressed={w===week} onClick={()=>setWeek(w)}>{w}</button>)}</div>
  {editing&&<Modal title={staff?'Bản tiến trình gửi gia đình':'Cập nhật từ gia đình'} close={()=>setEditing(false)}><FamilyEditor fields={fields} initial={Object.fromEntries(fields.map(([key])=>[key,(record as any)?.[key]||'']))} version={record?.version||0} published={report?.published||false} staff={staff} source={source} latest={record} reload={load} save={async(draft,version,published)=>{
   const {error:failure}=await client.rpc('save_family_weekly',{p_kind:staff?'report':'update',p_record:{student_id:studentId,week_start:week,version,...draft,...(staff?{published}:{})}});
   if(failure){await load();throw failure;}await load();setEditing(false);setNotice('Đã lưu.');
  }}/></Modal>}
 </section>;
}
function FamilyEditor({fields,initial,version,published,staff,source,latest,reload,save}:{fields:string[][];initial:Record<string,string>;version:number;published:boolean;staff:boolean;source?:Weekly;latest?:Report|Update;reload:()=>Promise<void>;save:(draft:Record<string,string>,version:number,published:boolean)=>Promise<void>}){
 const [draft,setDraft]=useState(initial),[expected,setExpected]=useState(version),[visible,setVisible]=useState(published),[busy,setBusy]=useState(false),[error,setError]=useState(''),[compare,setCompare]=useState(false);
 return <form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save(draft,expected,visible);}catch(e:any){setError(e.message||'Không lưu được.');}finally{setBusy(false);}}}>
  {staff&&<p>Chỉ nội dung trong form này được gửi tới gia đình. Hãy đọc lại trước khi chia sẻ.</p>}
  {staff&&source&&<button type="button" className="btn" onClick={()=>setDraft({goals:source.goal_snapshot.map(g=>`${g.title} · ${goalNames[g.status]||g.status}`).join('\n'),progress:source.progress,guidance:source.next_steps})}>Lấy nội dung từ tiến trình tuần để xem lại</button>}
  {fields.map(([key,label])=><Field key={key} label={label}><textarea value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></Field>)}
  {staff&&<label><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Chia sẻ với phụ huynh (bỏ chọn để ngừng chia sẻ)</label>}
  {error&&<div className="error" role="alert">{error}<button type="button" className="btn" onClick={()=>void reload().then(()=>setCompare(true)).catch(()=>{})}>Đối chiếu bản mới</button></div>}
  {compare&&<section><h3>Bản đang lưu</h3>{fields.map(([key,label])=><p key={key}><strong>{label}: </strong>{(latest as any)?.[key]||'—'}</p>)}{staff&&<p>{(latest as Report)?.published?'Đang chia sẻ':'Chưa chia sẻ'}</p>}<p>Nội dung đang nhập được giữ nguyên.</p><button type="button" className="btn" onClick={()=>{setExpected(latest?.version||0);setCompare(false);setError('');}}>Dùng nội dung của tôi trên phiên bản mới</button></section>}
  <div className="form-footer"><button className="btn primary" disabled={busy}>{busy?'Đang lưu…':staff?(visible?'Lưu và chia sẻ':'Lưu bản riêng'):'Lưu cập nhật'}</button></div>
 </form>;
}
