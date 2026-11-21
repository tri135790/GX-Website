import {useState} from 'react';
import type {Data,Teacher,Student} from '@/lib/gx/types';
import type {Change} from '@/lib/gx/client';
import {DirectoryPage} from './directory-page';
import {TeacherProfiles} from './teacher-profiles';
export function FamilyPage({data,add,openStudent,openWork,createWork,save,remove,busy}:{data:Data;add:(type:'student')=>void;openStudent:(id:string)=>void;openWork:(id:string)=>void;createWork:(id:string)=>void;save:(c:Change[],r?:Change[])=>Promise<void>;remove:(kind:'student'|'teacher',record:Student|Teacher)=>Promise<void>;busy:boolean}){
 const [section,setSection]=useState('offline');
 return <><div className="page-heading"><h1>Hồ sơ</h1></div><div className="tabs">{[['offline','OFFLINE'],['online','ONLINE'],['teachers','Giáo viên']].map(([id,title])=><button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}>{title}</button>)}</div>{section==='teachers'?<TeacherProfiles data={data} busy={busy} save={save} remove={remove} openWork={openWork} createWork={createWork}/>:<DirectoryPage key={section} kind="students" data={{...data,students:data.students.filter(s=>s.active&&(s.service_modes||['offline']).includes(section as 'offline'|'online'))}} add={()=>add('student')} open={openStudent} openStudent={openStudent} openWork={openWork}/>}</>;
}
