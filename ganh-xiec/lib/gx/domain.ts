import type { Lesson } from './types';
export const TZ = 'Asia/Ho_Chi_Minh';
export function localDate(d: Date | string = new Date()): string { return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d)); }
export function addDays(day: string, n: number): string { const d = new Date(day+'T12:00:00+07:00'); d.setUTCDate(d.getUTCDate()+n); return localDate(d); }
export function monday(day: string = localDate()): string { const d = new Date(day+'T12:00:00+07:00'); return addDays(day,-((d.getUTCDay()+6)%7)); }
export function timeText(s: string): string { return new Intl.DateTimeFormat('vi-VN',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(new Date(s)); }
export function dateText(s: string): string { if(!s)return '—'; return new Intl.DateTimeFormat('vi-VN',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s.length===10?s+'T12:00:00+07:00':s)); }
export function minutes(l: Lesson): number { return Math.round((Date.parse(l.ends_at)-Date.parse(l.starts_at))/60000); }
export function effectiveLesson(l: Lesson, _now = Date.now()):Lesson { return l; }
export function needsReport(l:Lesson, now=Date.now()) { return l.status!=='cancelled' && l.work_kind!=='leave' && Date.parse(l.ends_at)<=now && l.report_status!=='submitted'; }
export function totals(list: Lesson[]) { return list.reduce((a,original)=>{const l=effectiveLesson(original);if(!l.primary_pending&&l.status!=='cancelled'&&l.work_kind!=='leave') a.planned+=minutes(l); if(!l.primary_pending&&l.status==='completed'&&l.work_kind!=='leave') {a.actual+=l.actual_minutes;a[l.mode]+=l.actual_minutes; if(l.work_kind==='consultation')a.consultation+=l.actual_minutes;else if(l.work_kind==='therapy')a.therapy+=l.actual_minutes;else {a.other+=l.actual_minutes;if(!l.work_kind||l.work_kind==='legacy')a.unclassified+=l.actual_minutes;}} return a;},{planned:0,actual:0,online:0,offline:0,consultation:0,therapy:0,other:0,unclassified:0}); }
export function workCapacity(start:string,end:string,count=1){let days=0;for(let d=start;d<end;d=addDays(d,1)){const day=new Date(d+'T12:00:00+07:00').getUTCDay();if(day!==0&&day!==6)days++;}return days*360*count;}
export function hours(m: number): string { return (m/60).toLocaleString('vi-VN',{maximumFractionDigits:1}); }
export function overlaps(a: Lesson,b: Lesson): boolean { return a.id!==b.id&&a.status!=='cancelled'&&b.status!=='cancelled'&&((!a.primary_pending&&!b.primary_pending&&a.employee_id===b.employee_id)||(!!a.student_id&&a.student_id===b.student_id)||(a.teacher_ids||[]).some(id=>b.teacher_ids?.includes(id)))&&Date.parse(a.starts_at)<Date.parse(b.ends_at)&&Date.parse(b.starts_at)<Date.parse(a.ends_at); }
export function validateLesson(l: Lesson, list: Lesson[]) {
 if(l.status==='absent')throw Error('Chọn Hủy và ghi lý do học sinh vắng.');
 const kind=l.work_kind||'legacy';
 if(!l.employee_id || (['legacy','therapy'].includes(kind)&&!l.student_id) || (kind==='consultation'&&!l.student_id&&!l.teacher_ids?.length))throw Error('Chọn Incharge và hồ sơ.');
 if(l.teacher_ids?.length&&(kind!=='consultation'||l.student_id))throw Error('Tư vấn chỉ chọn học sinh hoặc giáo viên.');
 if(l.bm&&kind!=='therapy')throw Error('BM chỉ áp dụng Trị liệu.');
 if(!Number.isFinite(Date.parse(l.starts_at))||!Number.isFinite(Date.parse(l.ends_at))||minutes(l)<=0)throw Error('Giờ kết thúc phải sau giờ bắt đầu.');
 if(!l.all_day&&localDate(l.starts_at)!==localDate(l.ends_at))throw Error('Giờ làm phải trong cùng một ngày.');
 if(['consultation','therapy'].includes(kind)&&!l.location_id)throw Error('Chọn địa điểm.');
 if(l.status==='completed'&&(l.actual_minutes<=0||!Number.isInteger(l.actual_minutes)))throw Error('Nhập số phút làm việc nguyên dương.');
 if((l.status==='cancelled'||(l.status==='completed'&&l.actual_minutes!==minutes(l)))&&!l.reason.trim())throw Error('Nhập lý do hủy hoặc điều chỉnh giờ.');
 const conflict=list.find(x=>overlaps(l,x)); if(conflict)throw Error(`${conflict.employee_id===l.employee_id?'Nhân sự chính':'Học sinh'} trùng lịch ngày ${dateText(conflict.starts_at)} ${timeText(conflict.starts_at)}–${timeText(conflict.ends_at)}. Mở lịch ở thời điểm này để đối chiếu.`);
}
export function inRange(l: Lesson, start: string, endExclusive: string) { const date=localDate(l.starts_at); return date>=start&&date<endExclusive; }

export function workUtilization(list:Lesson[],start:string,end:string,employeeIds:string[]){let free=0,over=0;for(let d=start;d<end;d=addDays(d,1)){const capacity=workCapacity(d,addDays(d,1));for(const id of employeeIds){const used=totals(list.filter(l=>l.employee_id===id&&localDate(l.starts_at)===d)).actual;free+=Math.max(0,capacity-used);over+=Math.max(0,used-capacity);}}return {free,over};}
