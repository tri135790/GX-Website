import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monday,localDate,addDays,totals,validateLesson,overlaps,inRange,workCapacity,effectiveLesson,workUtilization} from '../lib/gx/domain.ts';
import type {Lesson} from '../lib/gx/types.ts';
const l:Lesson={id:'1',version:1,student_id:'s1',employee_id:'e1',starts_at:'2026-11-02T08:00:00+07:00',ends_at:'2026-11-02T09:00:00+07:00',mode:'online',location:'https://example.com',status:'scheduled',actual_minutes:0,reason:'',content:'',note:'',series_id:null};
test('week and date boundaries use Vietnam time',()=>{assert.equal(monday('2026-11-08'),'2026-11-02');assert.equal(monday('2026-11-09'),'2026-11-09');assert.equal(localDate('2026-11-01T18:00:00Z'),'2026-11-02');assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(inRange(l,'2026-11-02','2026-11-09'),true);});
test('actual hours exclude cancellation and absence, planned excludes cancellation',()=>{const s=totals([l,{...l,id:'2',status:'completed',actual_minutes:45,reason:'Kết thúc sớm'},{...l,id:'3',status:'absent',reason:'Vắng'},{...l,id:'4',status:'cancelled',reason:'Hủy'}]);assert.deepEqual(s,{planned:180,actual:45,online:45,offline:0,consultation:0,therapy:0,other:45,unclassified:45});});
test('overlap across teachers or students, adjacent sessions allowed',()=>{assert.equal(overlaps(l,{...l,id:'2'}),true);assert.equal(overlaps(l,{...l,id:'2',employee_id:'e2'}),true);assert.equal(overlaps(l,{...l,id:'2',employee_id:'e2',student_id:'s2'}),false);assert.equal(overlaps(l,{...l,id:'2',starts_at:l.ends_at,ends_at:'2026-11-02T10:00:00+07:00'}),false);assert.equal(overlaps(l,{...l,id:'2',status:'cancelled'}),false);});
test('reason required for modified actual hours and cancelled/absent sessions',()=>{assert.throws(()=>validateLesson({...l,status:'completed',actual_minutes:30},[]));assert.throws(()=>validateLesson({...l,status:'cancelled'},[]));assert.throws(()=>validateLesson({...l,status:'absent'},[]));assert.doesNotThrow(()=>validateLesson({...l,status:'completed',actual_minutes:60},[]));assert.throws(()=>validateLesson({...l,ends_at:l.starts_at},[]));assert.throws(()=>validateLesson({...l,status:'completed',actual_minutes:1.5,reason:'x'},[]));});

test('weekday capacity and leave do not reduce six-hour norm',()=>{assert.equal(workCapacity('2026-11-16','2026-11-23'),1800);assert.equal(workCapacity('2026-11-21','2026-11-23'),0);assert.equal(workCapacity('2026-11-16','2026-11-17',3),1080);const leave={...l,work_kind:'leave' as const,status:'scheduled' as const,auto_recorded:false};assert.equal(workCapacity('2026-11-02','2026-11-03')-totals([leave]).actual,360);});
test('elapsed scheduled work requires manual completion even with a legacy auto-recorded flag',()=>{
 const work={...l,auto_recorded:true,work_kind:'consultation' as const};
 for(const now of [Date.parse(l.starts_at),Date.parse(l.ends_at),Date.parse(l.ends_at)+86400000]){
  const actual=effectiveLesson(work,now);
  assert.equal(actual.status,'scheduled');
  assert.equal(actual.actual_minutes,0);
  assert.equal(totals([actual]).actual,0);
 }
 const completed={...work,status:'completed' as const,actual_minutes:60};
 assert.equal(totals([effectiveLesson(completed,Date.parse(l.ends_at))]).actual,60);
 assert.equal(totals([{...completed,status:'scheduled',actual_minutes:0}]).actual,0);
 assert.equal(totals([{...work,status:'cancelled'}]).actual,0);
 assert.equal(totals([{...completed,work_kind:'leave'}]).actual,0);
});
test('categories reconcile and a shared meeting counts once in calendar duration',()=>{
 const items:Lesson[]=[
  {...l,work_kind:'consultation',status:'completed',actual_minutes:60},
  {...l,id:'2',work_kind:'therapy',status:'completed',actual_minutes:120},
  {...l,id:'3',student_id:'',employee_id:'e1',support_employee_ids:['e2','e3'],work_kind:'meeting',status:'completed',actual_minutes:60},
 ];
 const sum=totals(items);
 assert.equal(sum.actual,240);assert.equal(sum.consultation,60);assert.equal(sum.therapy,120);assert.equal(sum.other,60);
 assert.equal(sum.actual,sum.consultation+sum.therapy+sum.other);
 assert.equal(totals([{...items[2],primary_pending:true}]).actual,0);
 assert.equal(totals([{...items[2],primary_pending:true}]).planned,0);
});
test('all meeting participants and students are protected',()=>{
 const meeting:Lesson={...l,student_id:'',support_employee_ids:['e2'],work_kind:'meeting'};
 assert.equal(overlaps(meeting,{...l,id:'2',employee_id:'e2',student_id:'s2'}),true);
 assert.equal(overlaps(meeting,{...l,id:'2',employee_id:'e1',student_id:'s2'}),true);
 assert.equal(overlaps(l,{...l,id:'2',employee_id:'e2'}),true);
});
test('non-student work does not conflict across different people',()=>{assert.equal(overlaps({...l,student_id:''},{...l,id:'2',student_id:'',employee_id:'e2'}),false);});

test('overtime on one day cannot erase a full-day absence or another employee vacancy',()=>{const work={...l,status:'completed' as const,actual_minutes:720};const result=workUtilization([work],'2026-11-02','2026-11-04',['e1','e2']);assert.equal(result.free,1080);assert.equal(result.over,360);});

test('meeting hours accrue to every participant while calendar duration stays singular',()=>{
 const meeting:Lesson={...l,student_id:'',work_kind:'meeting',support_employee_ids:['e2'],status:'completed',actual_minutes:60};
 assert.equal(totals([meeting]).actual,60);
 assert.deepEqual(workUtilization([meeting],'2026-11-02','2026-11-03',['e1','e2']),{free:600,over:0});
 assert.equal(overlaps(meeting,{...meeting,id:'other',employee_id:'e3',support_employee_ids:['e2']}),true);
 assert.equal(overlaps(meeting,{...meeting,id:'other',employee_id:'e2',support_employee_ids:[],work_kind:'leave'}),true);
 assert.equal(overlaps(meeting,{...meeting,id:'other',starts_at:meeting.ends_at,ends_at:'2026-11-02T10:00:00+07:00'}),false);
});
