import { Check,Clock3,Ban,UserX,MapPin } from 'lucide-react';
import { type Lesson,workColors,statusNames } from '@/lib/gx/types';
import { calendarColors,type CalendarNames } from '@/lib/gx/calendar-display';
import { participantIds,timeText } from '@/lib/gx/domain';
export function CalendarEventCard({lesson:l,title,names}:{lesson:Lesson;title:string;names:CalendarNames}) {
 const colors=calendarColors(workColors[l.work_kind||'legacy']);
 const Icon={scheduled:Clock3,completed:Check,cancelled:Ban,absent:UserX}[l.status];
 const person=participantIds(l).map(id=>names.employees.get(id)||'Nhân sự').join(', ');
 const slot=l.all_day?'Cả ngày':`${timeText(l.starts_at)}–${timeText(l.ends_at)}`;
 return <div className="calendar-event" title={`${title} · ${slot} · ${person} · ${l.location} · ${statusNames[l.status]}`} style={{backgroundColor:colors.background,color:colors.text,borderColor:colors.border}}><div className="calendar-event-heading"><span className="calendar-event-summary">{title}{l.bm?' · BM':''}</span><Icon size={12} className="calendar-status-icon" aria-label={statusNames[l.status]}/></div><small className="calendar-event-time">{slot}</small><span className="calendar-event-person">{person}</span><span className="calendar-event-location"><MapPin size={11}/>{l.location||'Chưa có địa điểm'}</span></div>;
}
