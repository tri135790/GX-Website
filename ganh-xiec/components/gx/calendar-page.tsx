'use client';
import { participantIds, hasParticipant, multiParticipantWork } from '@/lib/gx/domain';
import { calendarColors, calendarCards } from '@/lib/gx/calendar-display';
import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { Plus, ChevronLeft, ChevronRight, SlidersHorizontal, Check, Clock3, Ban, UserX } from 'lucide-react';
import { type Data, type Lesson, statusNames, workNames, workColors } from '@/lib/gx/types';
import { monday, addDays, localDate, totals, hours, inRange, dateText, timeText, workUtilization, effectiveLesson, needsReport } from '@/lib/gx/domain';
import { Modal, Empty, inputTime } from './shared';
import { HoursPanel } from './hours-panel';
type Props = {
    title?: string;
    onCreate?: () => void;
    showCapacity?: boolean;
    readOnly?: boolean;
    ownEmployeeId?: string;
    onRange?: (start: string, end: string) => void;
    data: Data;
    busy: boolean;
    employeeFilter: string;
    setEmployeeFilter: (s: string) => void;
    openLesson: (l?: Partial<Lesson>) => void;
    openWeekly: (id: string) => void;
};
export function CalendarPage({ title: pageTitle = 'Lịch làm việc', onCreate, showCapacity=true, data, busy, employeeFilter, setEmployeeFilter, openLesson, openWeekly, readOnly = false, ownEmployeeId, onRange }: Props) {
    const calendar = useRef<FullCalendar>(null);
    const [view, setView] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches ? 'listWeek' : 'timeGridWeek');
    const [title, setTitle] = useState(''), [range, setRange] = useState({ start: monday(), end: addDays(monday(), 7) }), [expanded, setExpanded] = useState(false), [showHours, setShowHours] = useState(false), [tasksOpen, setTasksOpen] = useState(false), [student, setStudent] = useState(''), [mode, setMode] = useState(''), [status, setStatus] = useState(''), [kind,setKind]=useState('');
    const filtered = data.lessons.map(l=>effectiveLesson(l)).filter(l => (!employeeFilter || hasParticipant(l,employeeFilter)) && (!student || l.student_id === student) && (!mode || l.location === mode) && (!status || l.status === status) && (!kind || (l.work_kind||'legacy')===kind));
    const ranged = filtered.filter(l => inRange(l, range.start, range.end)), sum = totals(ranged.filter(l=>!employeeFilter||hasParticipant(l,employeeFilter)),employeeFilter||undefined), filterCount = [employeeFilter, student, mode, status, kind].filter(Boolean).length;
    const capacityStaff=data.employees.filter(e=>e.active&&(!employeeFilter||e.id===employeeFilter));
    const allRanged=data.lessons.filter(l=>inRange(l,range.start,range.end)&&(!employeeFilter||hasParticipant(l,employeeFilter)));
    const utilization=workUtilization(allRanged,range.start,range.end,capacityStaff.map(e=>e.id));
    const pending = data.lessons.filter(l=>needsReport(l)&&(!ownEmployeeId||(l.employee_id===ownEmployeeId&&!multiParticipantWork(l)))).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
    const studentName = (id: string) => data.students.find(s => s.id === id)?.short_name || data.students.find(s => s.id === id)?.name || 'Học sinh';
    const employeeName = (id: string) => data.employees.find(e => e.id === id)?.name || 'Nhân sự';
    const cards = calendarCards(filtered, employeeFilter);
    const [visibleRange, setVisibleRange] = useState(range);
    const visiblePrimaryIds = [...new Set(cards.filter(({lesson}) => Date.parse(lesson.starts_at) < Date.parse(visibleRange.end+'T00:00:00+07:00') && Date.parse(lesson.ends_at) > Date.parse(visibleRange.start+'T00:00:00+07:00')).flatMap(({lesson}) => participantIds(lesson)))];
    useEffect(() => {
        const api = calendar.current?.getApi();
        if (!api) return;
        api.setOption('slotMinTime', '00:00:00');
        api.setOption('slotMaxTime', '24:00:00');
        api.setOption('scrollTime', '08:00:00');
        api.updateSize();
    }, [view]);
    const statusIcon = { scheduled: Clock3, completed: Check, cancelled: Ban, absent: UserX };
    return <><div className="page-heading"><h1>{pageTitle}</h1>{!readOnly && <button className="btn" onClick={() => setTasksOpen(true)}>Cần xử lý <span className="count-badge">{pending.length}</span></button>}</div><section className="panel calendar-panel"><div className="calendar-toolbar"><div className="row"><button className="btn compact" onClick={() => calendar.current?.getApi().today()}>Hôm nay</button><button className="icon-button" aria-label="Trước" onClick={() => calendar.current?.getApi().prev()}><ChevronLeft size={19}/></button><button className="icon-button" aria-label="Sau" onClick={() => calendar.current?.getApi().next()}><ChevronRight size={19}/></button><strong aria-live="polite">{title}</strong></div><div className="calendar-actions"><div className="segmented">{[['timeGridDay', 'Ngày'], ['timeGridWeek', 'Tuần'], ['dayGridMonth', 'Tháng'], ['listWeek', 'Danh sách']].map(([id, label]) => <button key={id} className={view === id ? 'selected' : ''} aria-pressed={view === id} onClick={() => calendar.current?.getApi().changeView(id)}>{label}</button>)}</div>{(!readOnly || onCreate) && <button className="btn primary" onClick={() => onCreate ? onCreate() : openLesson()}><Plus size={17}/>Thêm giờ làm</button>}</div></div><div className="filters">{ownEmployeeId && <button className="btn" onClick={() => setEmployeeFilter(ownEmployeeId)}>Lịch của tôi</button>}<select aria-label="Lọc nhân sự" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}><option value="">Tất cả nhân sự</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><button className="btn" aria-expanded={expanded} aria-controls="calendar-filters" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={16}/>Bộ lọc{filterCount > 0 && <span className="count-badge">{filterCount}</span>}</button>{filterCount > 0 && <button className="text-button" onClick={() => { setEmployeeFilter(''); setStudent(''); setMode(''); setStatus(''); setKind(''); }}>Xóa lọc</button>}</div>{expanded && <div id="calendar-filters" className="filters advanced-filters"><label>Học sinh<select value={student} onChange={e => setStudent(e.target.value)}><option value="">Tất cả học sinh</option>{data.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Địa điểm<select value={mode} onChange={e=>setMode(e.target.value)}><option value="">Tất cả</option>{[...new Set(data.lessons.map(l=>l.location).filter(Boolean))].map(name=><option key={name} value={name}>{name}</option>)}</select></label><label>Loại công việc<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Tất cả</option>{Object.entries(workNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Trạng thái<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả</option>{Object.entries(statusNames).filter(([id])=>id!=='absent').map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label></div>}<div className="calendar-summary"><div>{[['Tổng giờ làm',sum.actual],['Tư vấn',sum.consultation],['Trị liệu',sum.therapy],['Khác',sum.other]].map(([label,value])=><span key={label}>{label} <strong>{hours(Number(value))} giờ</strong></span>)}{showCapacity&&<span>Trống <strong>{hours(utilization.free)} giờ</strong>{utilization.over>0&&` · Vượt ${hours(utilization.over)} giờ`}</span>}</div><button className="text-button" aria-expanded={showHours} onClick={()=>setShowHours(!showHours)}>{showHours?'Ẩn chi tiết':'Chi tiết giờ làm'}</button></div>{sum.unclassified>0&&<p className="work-caption">Có {hours(sum.unclassified)} giờ cũ chưa phân loại trong mục Khác.</p>}{showHours&&<HoursPanel lessons={ranged} data={data} start={range.start} end={range.end} allLessons={allRanged} employeeFilter={employeeFilter} showCapacity={showCapacity}/>}<div className={'calendar-canvas'+(view==='listWeek'?'':' calendar-grid')+(view==='timeGridWeek'?' calendar-week-grid':'')}><div className="calendar-width"><FullCalendar ref={calendar} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]} initialView={view} headerToolbar={false} timeZone="UTC" now={inputTime(new Date().toISOString()) + ':00Z'} locale="vi" firstDay={1} allDaySlot={true} allDayText="" slotMinTime="00:00:00" slotMaxTime="24:00:00" slotDuration="00:30:00" scrollTime="08:00:00" height={view === 'listWeek' ? 'auto' : view.startsWith('timeGrid')?640:650} nowIndicator editable={!readOnly && !busy} selectable={!readOnly} eventInteractive eventDurationEditable={false} slotEventOverlap={false} eventMinHeight={0} eventShortHeight={0} dayHeaderContent={arg=><div className="calendar-day-heading"><span>{['SUN','MON','TUE','WED','THU','FRI','SAT'][arg.date.getUTCDay()]}</span><strong>{String(arg.date.getUTCDate()).padStart(2,'0')}</strong></div>} eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} datesSet={arg => { const start = localDate(arg.view.currentStart), end = localDate(arg.view.currentEnd); setRange({ start, end }); setVisibleRange({start:localDate(arg.view.activeStart),end:localDate(arg.view.activeEnd)}); onRange?.(localDate(arg.view.activeStart),localDate(arg.view.activeEnd)); setTitle(arg.view.title); setView(arg.view.type); }} dayMaxEvents={3} moreLinkText={n=>view==='dayGridMonth'?`+${n} khung giờ khác`:`+${n} lịch khác`} events={cards.map(({lesson:l,displayEmployee}) => {
 const colors=calendarColors(workColors[l.work_kind||'legacy']);
 return {id:l.id+':'+displayEmployee,title:l.student_id?studentName(l.student_id):l.teacher_ids?.length?l.teacher_ids.map(id=>data.teachers.find(t=>t.id===id)?.short_name||data.teachers.find(t=>t.id===id)?.name||'Giáo viên').join(', '):workNames[l.work_kind||'legacy'],allDay:!!l.all_day,start:l.all_day?localDate(l.starts_at):inputTime(l.starts_at),end:l.all_day?localDate(l.ends_at):inputTime(l.ends_at),backgroundColor:colors.background,borderColor:colors.border,textColor:colors.text,classNames:[...(view==='dayGridMonth'?['month-vertical-event']:[]),...(l.status==='absent'?[]:['event-'+l.status])],extendedProps:{lesson:l,displayEmployee,colors}};
})} eventContent={arg => {
 const l=arg.event.extendedProps.lesson as Lesson;
 const colors=arg.event.extendedProps.colors;
 const person=participantIds(l).map(employeeName).join(', ');
 const location=l.location&&l.location!=='—'?l.location:'Chưa có địa điểm';
 const slot=l.all_day?'':`${timeText(l.starts_at)}–${timeText(l.ends_at)}`;
 const student=l.student_id?studentName(l.student_id):l.teacher_ids?.length?l.teacher_ids.map(id=>data.teachers.find(t=>t.id===id)?.short_name||data.teachers.find(t=>t.id===id)?.name||'Giáo viên').join(', '):workNames[l.work_kind||'legacy'];
 const summary=l.work_kind==='leave'?person:[location,...(l.student_id||l.teacher_ids?.length?[student]:[]),person].join(' - ')+(l.bm?' · BM':'');
 const label=`${summary} - ${slot} - ${statusNames[l.status]}`;
 return <div className="calendar-event" tabIndex={0} aria-label={label} title={label} style={{backgroundColor:colors.background,color:colors.text,borderColor:colors.border}}>
 <span className="calendar-event-summary">{summary}</span><small>{slot}</small></div>;
}} eventClick={arg => {if(arg.event.extendedProps.lesson)openLesson(arg.event.extendedProps.lesson);}} select={arg => !readOnly && openLesson({ starts_at: arg.allDay ? arg.startStr.slice(0, 10) + 'T08:00:00+07:00' : arg.startStr.slice(0, 16) + '+07:00', ends_at: arg.allDay ? arg.startStr.slice(0, 10) + 'T09:00:00+07:00' : arg.endStr.slice(0, 16) + '+07:00' })} eventDrop={arg => { if (readOnly) { arg.revert(); return; } const old = arg.event.extendedProps.lesson as Lesson; const start = arg.event.allDay?arg.event.startStr.slice(0,10)+'T00:00:00+07:00':arg.event.startStr.slice(0,16)+'+07:00', end = arg.event.allDay?arg.event.endStr.slice(0,10)+'T00:00:00+07:00':arg.event.endStr.slice(0,16)+'+07:00'; arg.revert(); openLesson({ ...old, starts_at: start, ends_at: end }); }}/></div></div><div className="calendar-legend"><strong>Loại công việc:</strong>{Object.entries(workNames).filter(([id])=>id!=='legacy').map(([id,label])=>{const colors=calendarColors(workColors[id as keyof typeof workColors]);return <span className="calendar-person-legend" key={id} style={{backgroundColor:colors.background,color:colors.text,borderColor:colors.border}}>{label}</span>;})}{Object.entries(statusNames).filter(([id])=>id!=='absent').map(([id, label]) => { const Icon = statusIcon[id as Lesson['status']]; return <span key={id}><Icon size={13}/>{label}</span>; })}</div></section>{tasksOpen && <Modal title={`Cần xử lý — ${pending.length}`} close={() => setTasksOpen(false)}><div className="task-list"><p className="muted">Các lịch đã qua giờ chưa nộp báo cáo. Không phụ thuộc bộ lọc lịch.</p><h3>Giờ chưa nộp báo cáo ({pending.length})</h3>{pending.map(l => <button className="task-row" key={l.id} onClick={() => { setTasksOpen(false); openLesson(l); }}><div><strong>{studentName(l.student_id)}</strong><small>{dateText(l.starts_at)} · {timeText(l.starts_at)}–{timeText(l.ends_at)} · {employeeName(l.employee_id)}</small></div><ChevronRight size={17}/></button>)}{!pending.length && <p className="muted">Không có giờ cần báo cáo.</p>}</div></Modal>}</>;
}
