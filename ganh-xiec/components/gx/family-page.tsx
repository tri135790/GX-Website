import { useState } from 'react';
import type { Data } from '@/lib/gx/types';
import { DirectoryPage } from './directory-page';
export function FamilyPage({data,add,openStudent,openParent}:{data:Data;add:(type:'student'|'parent')=>void;openStudent:(id:string)=>void;openParent:(id:string)=>void}) {
 const [section,setSection]=useState<'students'|'parents'>('students');
 return <><div className="page-heading"><h1>Gia đình</h1></div><div className="tabs" aria-label="Quản lý gia đình"><button className={section==='students'?'active':''} onClick={()=>setSection('students')}>Học sinh</button><button className={section==='parents'?'active':''} onClick={()=>setSection('parents')}>Phụ huynh</button></div><DirectoryPage key={section} kind={section} data={data} add={()=>add(section==='students'?'student':'parent')} open={section==='students'?openStudent:openParent} openStudent={openStudent}/></>;
}
