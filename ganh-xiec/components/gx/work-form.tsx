import { DateInput } from './date-input';
import { useState } from 'react';
import { workDeleteSnapshot, type DeleteScope, type DeleteSnapshot } from '@/lib/gx/work-deletion';
import { Check } from 'lucide-react';
import type { Change } from '@/lib/gx/client';
import { type Data, type Lesson, type WorkKind, workNames } from '@/lib/gx/types';
import { addDays, localDate, minutes, timeText, dateText, overlaps, validateLesson } from '@/lib/gx/domain';
import { Field, uid, change, inputTime } from './shared';

export function WorkForm({record,data,save,busy,employeeId,onDelete}:{onDelete?:(anchor:Lesson,scope:DeleteScope,snapshot:DeleteSnapshot)=>Promise<void>;record?:Partial<Lesson>;data:Data;save:(changes:Change[])=>Promise<void>;busy:boolean;employeeId?:string}){
 const [f,setF]=useState<Lesson>({id:uid(),version:0,student_id:'',employee_id:employeeId||data.assignments.find(a=>a.student_id===record?.student_id&&a.responsibility==='primary')?.employee_id||'',starts_at:localDate()+'T08:00:00+07:00',ends_at:localDate()+'T09:00:00+07:00',mode:'offline',location:'—',status:'scheduled',actual_minutes:0,reason:'',content:'',note:'',series_id:null,work_kind:'therapy',auto_recorded:false,...record});
 const [repeat,setRepeat]=useState(false),[until,setUntil]=useState(addDays(localDate(f.starts_at),28)),[days,setDays]=useState([new Date(f.starts_at).getUTCDay()]),[error,setError]=useState(''),[scope,setScope]=useState('one');
 const [supports,setSupports]=useState<string[]>(record?.support_employee_ids||[]);
 const [primaryChosen,setPrimaryChosen]=useState(!record?.primary_pending);
 const [deleteScope,setDeleteScope]=useState<DeleteScope>('one');
 const anchor=data.lessons.find(l=>l.id===record?.id);
 const preview=anchor?workDeleteSnapshot(data.lessons,anchor,deleteScope):[];
 const deleteCount=preview.filter(l=>l.deletable).length;
 async function remove(){if(!anchor||!onDelete)return;setError('');try{
  const snapshot=workDeleteSnapshot(data.lessons,anchor,deleteScope);
  const count=snapshot.filter(l=>l.deletable).length;
  if(!count)throw Error('Không có lịch đủ điều kiện xóa. Lịch đã hoàn thành hoặc đã tính giờ được giữ lại.');
  if(!confirm(`Xóa ${count} lịch, giữ lại ${snapshot.length-count} lịch đã hoàn thành hoặc đã tính giờ? Thao tác này không thể hoàn tác. Các thay đổi chưa lưu sẽ bị bỏ qua.`))return;
  await onDelete(anchor,deleteScope,snapshot);
 }catch(e:any){setError(e.message||'Không xóa được lịch.');}}
 const kind=f.work_kind||'legacy', teaching=['legacy','therapy','consultation'].includes(kind);
 const set=(key:keyof Lesson,value:unknown)=>setF(old=>({...old,[key]:value}));
 const location=data.work_locations.find(l=>l.id===f.location_id);
 const available=data.employees.filter(e=>e.active&&(!employeeId||e.id===employeeId)&&(!teaching||!f.student_id||data.assignments.some(a=>a.student_id===f.student_id&&a.employee_id===e.id)));
 async function submit(e:React.FormEvent){e.preventDefault();setError('');try{
  if(!primaryChosen)throw Error('Chọn nhân sự chính cho lịch cũ.');
  if(record?.status==='completed'&&f.status!=='completed'&&!confirm('Chuyển trạng thái sẽ bỏ giờ đã tính của lịch này. Tiếp tục?'))return;
  if(f.report_status==='submitted'&&!f.report_content?.trim())throw Error('Nhập nội dung trước khi nộp báo cáo.');
  const selected=[employeeId||f.employee_id];if(selected.some(id=>!id)||!selected.length)throw Error('Chọn nhân sự.');
  const base={...f,student_id:teaching?f.student_id:null,location:location?.name||'—',mode:location?.mode||'offline',status:kind==='leave'&&f.status!=='cancelled'?'scheduled':f.status,actual_minutes:0,auto_recorded:false,support_employee_ids:supports.filter(id=>id!==(employeeId||f.employee_id)),primary_pending:false} as Lesson;
  if(base.status==='completed')base.actual_minutes=Number(f.actual_minutes)||minutes(f);
  if(kind==='leave'){base.actual_minutes=0;base.location='—';base.location_id=null;base.meeting_url='';}
  const group=f.work_group||null, dates:string[]=[];
  if(repeat&&!record?.id){if(until<localDate(f.starts_at)||until>addDays(localDate(f.starts_at),366))throw Error('Khoảng lặp tối đa một năm.');for(let d=localDate(f.starts_at);d<=until;d=addDays(d,1)){if(days.includes(new Date(d+'T12:00:00+07:00').getUTCDay()))dates.push(d);}if(!dates.length)throw Error('Chọn ít nhất một ngày lặp.');}else dates.push(localDate(f.starts_at));
  const series=repeat?uid():f.series_id;
  let list:Lesson[]=dates.flatMap(date=>selected.map(employee_id=>({...base,id:record?.id||uid(),employee_id,work_group:group,series_id:series,starts_at:f.all_day?date+'T00:00:00+07:00':date+'T'+timeText(f.starts_at)+':00+07:00',ends_at:f.all_day?addDays(date,1)+'T00:00:00+07:00':date+'T'+timeText(f.ends_at)+':00+07:00'})));
  if(scope==='future'&&record?.series_id){if(!['scheduled','cancelled'].includes(base.status))throw Error('Chỉ đổi lịch/hủy các giờ chưa hoàn thành.');const old=data.lessons.find(l=>l.id===record.id)!;const shift=Date.parse(base.starts_at)-Date.parse(old.starts_at),duration=Date.parse(base.ends_at)-Date.parse(base.starts_at);list=data.lessons.filter(l=>l.series_id===old.series_id&&l.employee_id===old.employee_id&&l.starts_at>=old.starts_at&&l.status==='scheduled').map(l=>({...base,id:l.id,version:l.version,employee_id:l.employee_id,report_content:l.id===record.id?base.report_content:l.report_content,report_status:l.id===record.id?base.report_status:l.report_status,report_submitted_at:l.report_submitted_at,report_submitted_by:l.report_submitted_by,starts_at:new Date(Date.parse(l.starts_at)+shift).toISOString(),ends_at:new Date(Date.parse(l.starts_at)+shift+duration).toISOString()}));}
  const unchanged=data.lessons.filter(l=>!list.some(x=>x.id===l.id));list.forEach(l=>{const conflict=[...unchanged,...list].find(x=>overlaps(l,x));if(conflict){const person=data.employees.find(e=>e.id===conflict.employee_id)?.name||'Nhân sự';const child=data.students.find(s=>s.id===conflict.student_id)?.name;throw Error(`Trùng lịch ${person}${child?' · '+child:''}, ${dateText(conflict.starts_at)} ${timeText(conflict.starts_at)}–${timeText(conflict.ends_at)}.`);}validateLesson(l,[...unchanged,...list]);});await save(list.map(l=>change('lessons',l)));
 }catch(e:any){setError(e.message||'Không lưu được giờ làm.');}}
 return <form className="form" onSubmit={submit}>{error&&<div className="error" role="alert">{error}</div>}
  <Field label="Loại công việc"><select value={kind} onChange={e=>{const work_kind=e.target.value as WorkKind;setF({...f,work_kind,all_day:false,student_id:'',employee_id:employeeId||f.employee_id,location_id:null});}}>{Object.entries(workNames).filter(([k])=>(k!=='legacy'||record?.id)&&(!employeeId||k!=='leave')).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
  <Field label="Nội dung làm việc (không bắt buộc)"><textarea value={f.content} onChange={e=>set('content',e.target.value)}/></Field>
  {teaching&&<Field label="Học sinh"><select required value={f.student_id||''} onChange={e=>{const sid=e.target.value;setF({...f,student_id:sid,employee_id:employeeId||data.assignments.find(a=>a.student_id===sid&&a.responsibility==='primary')?.employee_id||''});setPrimaryChosen(true);}}><option value="">Chọn học sinh</option>{data.students.filter(s=>s.active||s.id===f.student_id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
  {!employeeId&&<Field label="Nhân sự chính *"><select required value={primaryChosen?f.employee_id:''} onChange={e=>{set('employee_id',e.target.value);setPrimaryChosen(true);}}><option value="">Chọn nhân sự chính</option>{data.employees.filter(e=>available.some(a=>a.id===e.id)||e.id===f.employee_id).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>}
  {!employeeId&&<fieldset><legend>Nhân sự phụ · không tính giờ, được phép trùng lịch</legend>{data.employees.filter(e=>(e.active||supports.includes(e.id))&&e.id!==f.employee_id).map(e=><label className="checkbox" key={e.id}><input type="checkbox" checked={supports.includes(e.id)} onChange={ev=>setSupports(ev.target.checked?[...supports,e.id]:supports.filter(id=>id!==e.id))}/>{e.name}</label>)}</fieldset>}
  {record?.primary_pending&&<p className="notice">Lịch nhóm cũ cần chọn nhân sự chính trước khi tính giờ.</p>}
  {kind==='leave'&&<label className="checkbox"><input type="checkbox" checked={!!f.all_day} onChange={e=>set('all_day',e.target.checked)}/> Vắng cả ngày (6 giờ trống/ngày làm việc)</label>}
  {f.all_day?<Field label="Ngày vắng"><DateInput required type="date" value={localDate(f.starts_at)} onChange={e=>{if(e.target.value)set('starts_at',e.target.value+'T00:00:00+07:00');}}/></Field>:<div className="form-grid"><Field label="Bắt đầu"><DateInput required type="datetime-local" value={inputTime(f.starts_at)} onChange={e=>{if(e.target.value)set('starts_at',e.target.value+':00+07:00');}}/></Field><Field label="Kết thúc"><DateInput required type="datetime-local" value={inputTime(f.ends_at)} onChange={e=>{if(e.target.value)set('ends_at',e.target.value+':00+07:00');}}/></Field></div>}
  {kind!=='leave'&&(!employeeId||teaching)&&<Field label={teaching?'Địa điểm *':'Địa điểm (nếu có)'}><select required={teaching&&kind!=='legacy'} value={f.location_id||''} onChange={e=>set('location_id',e.target.value||null)}><option value="">{kind==='legacy'?f.location:'Chọn địa điểm'}</option>{data.work_locations.filter(l=>l.active||l.id===f.location_id).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>}
  {location?.mode==='online'&&<Field label="Đường dẫn lớp học"><input type="url" value={f.meeting_url||''} onChange={e=>set('meeting_url',e.target.value)}/></Field>}
  {!record?.id&&<div className="repeat-box"><label className="checkbox"><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/>{f.all_day?'Vắng nhiều ngày':'Lặp hằng tuần'}</label>{repeat&&<><div className="weekday-select">{['CN','T2','T3','T4','T5','T6','T7'].map((label,i)=><button type="button" aria-pressed={days.includes(i)} className={days.includes(i)?'selected':''} key={i} onClick={()=>setDays(days.includes(i)?days.filter(d=>d!==i):[...days,i])}>{label}</button>)}</div><Field label="Đến hết ngày"><DateInput required type="date" value={until} onChange={e=>setUntil(e.target.value)}/></Field></>}</div>}
  {record?.series_id&&<Field label="Phạm vi thay đổi"><select value={scope} onChange={e=>setScope(e.target.value)}><option value="one">Chỉ giờ làm này</option><option value="future">Các giờ chưa hoàn thành tiếp theo trong chuỗi</option></select></Field>}
  {record?.id&&!employeeId&&<><Field label="Trạng thái"><select value={f.status==='absent'?'cancelled':f.status} onChange={e=>set('status',e.target.value)}><option value="scheduled">Đã lên lịch</option>{kind!=='leave'&&<option value="completed">Hoàn thành</option>}<option value="cancelled">Hủy</option></select></Field>{f.status==='completed'&&<Field label="Số phút làm việc"><input type="number" min="1" step="1" value={f.actual_minutes||minutes(f)} onChange={e=>set('actual_minutes',Number(e.target.value))}/></Field>}<Field label="Ghi chú"><textarea value={f.note} onChange={e=>set('note',e.target.value)}/></Field></>}
  {record?.id&&!employeeId&&kind!=='leave'&&<><Field label="Báo cáo công việc"><textarea value={f.report_content||''} onChange={e=>setF({...f,report_content:e.target.value,report_status:'draft'})}/></Field><Field label="Trạng thái báo cáo"><select value={f.report_status||'draft'} onChange={e=>set('report_status',e.target.value)}><option value="draft">Lưu nháp</option><option value="submitted">Nộp báo cáo</option></select></Field></>}
  {(f.status==='cancelled'||(f.status==='completed'&&f.actual_minutes>0&&f.actual_minutes!==minutes(f)))&&<Field label="Lý do hủy / điều chỉnh giờ"><input required placeholder="Ví dụ: Học sinh vắng" value={f.reason} onChange={e=>set('reason',e.target.value)}/></Field>}
  {anchor&&onDelete&&!employeeId&&<section className="repeat-box"><h3>Xóa lịch</h3>{anchor.series_id&&<Field label="Phạm vi xóa"><select disabled={busy} value={deleteScope} onChange={e=>setDeleteScope(e.target.value as DeleteScope)}><option value="one">Chỉ lịch này</option><option value="future">Lịch này và các lịch tiếp theo trong chuỗi</option></select></Field>}<p>{deleteCount} lịch sẽ xóa · {preview.length-deleteCount} lịch đã hoàn thành hoặc đã tính giờ được giữ lại.</p><button type="button" className="btn danger" disabled={busy||!deleteCount} onClick={remove}>Xóa lịch</button></section>}
  <div className="form-footer"><small>UTC+7 · Chỉ tính giờ người chính sau khi xác nhận hoàn thành.</small><button disabled={busy} className="btn primary">{busy?'Đang lưu…':'Lưu giờ làm'}<Check size={16}/></button></div>
 </form>;
}
