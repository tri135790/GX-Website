import {useState} from 'react';
import type {Lesson} from '@/lib/gx/types';
import {monday,addDays,dateText,localDate,totals,hours} from '@/lib/gx/domain';
import {DateInput} from './date-input';
export function ProfileHours({lessons,start='',teacher=false,employeeId,week:controlledWeek,onWeekChange}:{lessons:Lesson[];start?:string;teacher?:boolean;employeeId?:string;week?:string;onWeekChange?:(week:string)=>void}){
 const [localWeek,setLocalWeek]=useState(monday());
 const week=controlledWeek??localWeek,setWeek=onWeekChange??setLocalWeek;
 const history=[...new Map(lessons.map(l=>[l.id,l])).values()].filter(l=>localDate(l.starts_at)>=start&&Date.parse(l.ends_at)<=Date.now());
 const total=totals(history,employeeId),weekly=totals(history.filter(l=>localDate(l.starts_at)>=week&&localDate(l.starts_at)<addDays(week,7)),employeeId);
 return <section className="panel"><div className="panel-heading"><h2>Thống kê giờ</h2></div><div className="panel-body"><p>{start?'Từ ngày tham gia '+dateText(start):'Toàn bộ lịch sử'} đến hiện tại · chỉ tính giờ đã xác nhận hoàn thành.</p>{!employeeId&&history.some(l=>l.work_kind==='consultation_therapy')&&<p>Tư vấn ba mẹ và trị liệu có thể diễn ra đồng thời; tổng thời lượng mỗi buổi chỉ tính một lần.</p>}<div className="row"><strong>Tư vấn: {hours(total.consultation)} giờ</strong>{!teacher&&<><strong>Trị liệu: {hours(total.therapy)} giờ</strong><strong>Tổng: {hours(total.actual)} giờ</strong></>}</div>{controlledWeek===undefined&&<label>Tuần bắt đầu <DateInput value={week} onChange={e=>e.target.value&&setWeek(monday(e.target.value))}/></label>}<p>{dateText(week)} – {dateText(addDays(week,6))}</p><table><thead><tr><th>Tư vấn</th>{!teacher&&<><th>Trị liệu</th><th>Tổng</th></>}</tr></thead><tbody><tr><td>{hours(weekly.consultation)} giờ</td>{!teacher&&<><td>{hours(weekly.therapy)} giờ</td><td>{hours(weekly.actual)} giờ</td></>}</tr></tbody></table></div></section>;
}
