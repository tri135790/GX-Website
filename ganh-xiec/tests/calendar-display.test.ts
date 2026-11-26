import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarColors,calendarTitle } from '../lib/gx/calendar-display.ts';
import { workColors,workNames,type Lesson } from '../lib/gx/types.ts';
const names={students:new Map([['s','MIU']]),teachers:new Map([['t','Cô An']]),employees:new Map([['e','Mai Anh']])};
const base={student_id:'',employee_id:'e'} as Lesson;
test('calendar preserves every agreed service color and readable text',()=>{
 assert.deepEqual(workColors,{consultation_therapy:'#008d34',legacy:'#95c6ee',consultation:'#f1f345',therapy:'#7bc224',meeting:'#f4a9ad',report:'#95c6ee',leave:'#aa6a3c'});
 for(const color of Object.values(workColors)){const c=calendarColors(color);assert.equal(c.background,color);const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const lum=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;assert.ok((c.text==='#000000'?(lum+.05)/.05:1.05/(lum+.05))>=4.5);}
});
test('calendar titles prioritize the client and safely handle missing records',()=>{
 assert.equal(calendarTitle({...base,student_id:'s'},names,'Trị liệu'),'MIU');
 assert.equal(calendarTitle({...base,student_id:'missing'},names,'Trị liệu'),'Học sinh');
 assert.equal(calendarTitle({...base,teacher_ids:['t','unknown']},names,'Tư vấn'),'Cô An, Giáo viên');
 assert.equal(calendarTitle({...base,work_kind:'meeting'},names,workNames.meeting),'Họp');
 assert.equal(calendarTitle({...base,work_kind:'leave'},names,workNames.leave),'Mai Anh');
});

import { localDate,timeText,addDays,inRange } from '../lib/gx/domain.ts';
test('calendar wall time uses Vietnam dates across UTC midnight and exclusive all-day ends',()=>{
 assert.equal(localDate('2026-12-31T18:00:00Z'),'2027-01-01');
 assert.equal(timeText('2026-12-31T18:00:00Z'),'01:00');
 const lesson={...base,all_day:true,starts_at:'2026-12-31T00:00:00+07:00',ends_at:'2027-01-02T00:00:00+07:00'};
 assert.equal(addDays(localDate(lesson.ends_at),-1),'2027-01-01');
 assert.equal(inRange(lesson,'2027-01-02','2027-01-03'),false);
});
