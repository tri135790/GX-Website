import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lesson } from '@/lib/gx/types';
import { Field } from './shared';
export function WorkReport({lesson,client,onDone}:{lesson:Lesson;client:SupabaseClient;onDone:()=>Promise<void>}) {
 const [content,setContent]=useState(lesson.report_content||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(action:string){setBusy(true);setError('');try{const {error:failure}=await client.rpc('update_my_work',{p_id:lesson.id,p_version:lesson.version,p_action:action,p_content:content});if(failure)throw failure;await onDone();}catch(e:any){setError(e.message||'Không lưu được.');}finally{setBusy(false);}}
 return <section className="repeat-box"><h3>Báo cáo công việc</h3>{error&&<p className="error" role="alert">{error}</p>}<p>{lesson.report_status==='submitted'?'Đã nộp báo cáo':'Chưa nộp báo cáo'}</p><Field label="Nội dung báo cáo"><textarea value={content} onChange={e=>setContent(e.target.value)}/></Field><div className="row"><button disabled={busy} className="btn" onClick={()=>void act('draft')}>Lưu nháp</button><button disabled={busy||!content.trim()} className="btn primary" onClick={()=>void act('submit')}>Nộp báo cáo</button>{lesson.status==='scheduled'&&!lesson.primary_pending&&<button disabled={busy} className="btn" onClick={()=>{if(confirm('Xác nhận hoàn thành và cộng giờ làm cho bạn?'))void act('complete');}}>Xác nhận hoàn thành</button>}</div></section>;
}
