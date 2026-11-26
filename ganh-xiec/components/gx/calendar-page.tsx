'use client';
import { CalendarEventCard } from './calendar-event-card';
import { CalendarSummary } from './calendar-summary';
import { CalendarFilters } from './calendar-filters';
import { CalendarToolbar } from './calendar-toolbar';
import { CalendarEventPreview } from './calendar-event-preview';
import { participantIds, hasParticipant, multiParticipantWork } from '@/lib/gx/domain';
import { calendarColors, calendarCards, calendarTitle } from '@/lib/gx/calendar-display';
import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import viLocale from '@fullcalendar/core/locales/vi';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { ChevronRight } from 'lucide-react';
import { type Data, type Lesson, statusNames, workNames, workColors } from '@/lib/gx/types';
import { monday, addDays, localDate, totals, inRange, dateText, timeText, workUtilization, effectiveLesson, needsReport } from '@/lib/gx/domain';
import { Modal, inputTime } from './shared';
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
    const [selectedId,setSelectedId]=useState<string|null>(null);
    const anchor=useRef<HTMLElement|null>(null);
    const [date,setDate]=useState(localDate());
    const names=useMemo(()=>({students:new Map(data.students.map(s=>[s.id,s.short_name||s.name])),teachers:new Map(data.teachers.map(t=>[t.id,t.short_name||t.name])),employees:new Map(data.employees.map(e=>[e.id,e.name]))}),[data.students,data.teachers,data.employees]);
    const [view, setView] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches ? 'listWeek' : 'timeGridWeek');
    const [title, setTitle] = useState(''), [range, setRange] = useState({ start: monday(), end: addDays(monday(), 7) }), [expanded, setExpanded] = useState(false), [showHours, setShowHours] = useState(false), [tasksOpen, setTasksOpen] = useState(false), [student, setStudent] = useState(''), [mode, setMode] = useState(''), [status, setStatus] = useState(''), [kind,setKind]=useState('');
    const filtered = useMemo(() => data.lessons.map(l=>effectiveLesson(l)).filter(l => (!employeeFilter || hasParticipant(l,employeeFilter)) && (!student || l.student_id === student) && (!mode || l.location === mode) && (!status || l.status === status) && (!kind || (l.work_kind||'legacy')===kind)), [data.lessons, employeeFilter, student, mode, status, kind]);
    const ranged = filtered.filter(l => inRange(l, range.start, range.end)), sum = totals(ranged.filter(l=>!employeeFilter||hasParticipant(l,employeeFilter)),employeeFilter||undefined), filterCount = [employeeFilter, student, mode, status, kind].filter(Boolean).length;
    const capacityStaff=data.employees.filter(e=>e.active&&(!employeeFilter||e.id===employeeFilter));
    const allRanged=data.lessons.filter(l=>inRange(l,range.start,range.end)&&(!employeeFilter||hasParticipant(l,employeeFilter)));
    const utilization=workUtilization(allRanged,range.start,range.end,capacityStaff.map(e=>e.id));
    const pending = data.lessons.filter(l=>needsReport(l)&&(!ownEmployeeId||(l.employee_id===ownEmployeeId&&!multiParticipantWork(l)))).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
    const studentName = (id: string) => names.students.get(id) || 'Học sinh';
    const employeeName = (id: string) => names.employees.get(id) || 'Nhân sự';
    const events = useMemo(() => calendarCards(filtered, employeeFilter).map(({lesson:l,displayEmployee}) => {
        const colors = calendarColors(workColors[l.work_kind || 'legacy']);
        const title = calendarTitle(l,names,workNames[l.work_kind||'legacy']);
        return {
            id: l.id + ':' + displayEmployee, title, allDay: !!l.all_day,
            start: l.all_day ? localDate(l.starts_at) : inputTime(l.starts_at),
            end: l.all_day ? localDate(l.ends_at) : inputTime(l.ends_at),
            backgroundColor: colors.background, borderColor: colors.border, textColor: colors.text,
            classNames: [...(view === 'dayGridMonth' ? ['month-vertical-event'] : []), ...(l.status === 'absent' ? [] : ['event-' + l.status])],
            extendedProps: { lesson: l, displayEmployee, colors },
        };
    }), [filtered, employeeFilter, names, view]);
    const selected=filtered.find(l=>l.id===selectedId);
    useEffect(()=>{if(selectedId&&!selected)setSelectedId(null);},[selectedId,selected]);
    const changeView=(next:string)=>{setSelectedId(null);const api=calendar.current?.getApi();const reset=!view.startsWith('timeGrid')&&next.startsWith('timeGrid');api?.changeView(next);if(reset)api?.scrollToTime('08:00:00');};
    return <><div className="page-heading"><h1>{pageTitle}</h1>{!readOnly && <button className="btn" onClick={() => setTasksOpen(true)}>Cần xử lý <span className="count-badge">{pending.length}</span></button>}</div><section className="panel calendar-panel calendar-workspace" aria-label="Lịch công việc" aria-busy={busy}><CalendarToolbar title={title} date={date} view={view} busy={busy} canCreate={!readOnly||!!onCreate} onToday={()=>calendar.current?.getApi().today()} onPrevious={()=>calendar.current?.getApi().prev()} onNext={()=>calendar.current?.getApi().next()} onDate={d=>calendar.current?.getApi().gotoDate(d)} onView={changeView} onCreate={()=>onCreate?onCreate():openLesson()}/><CalendarFilters data={data} ownEmployeeId={ownEmployeeId} employeeFilter={employeeFilter} setEmployeeFilter={setEmployeeFilter} expanded={expanded} setExpanded={setExpanded} filterCount={filterCount} student={student} setStudent={setStudent} mode={mode} setMode={setMode} status={status} setStatus={setStatus} kind={kind} setKind={setKind} names={names} /><div className={'calendar-canvas'+(view==='listWeek'?'':' calendar-grid')+(view==='timeGridWeek'?' calendar-week-grid':'')}><div className="calendar-width"><FullCalendar ref={calendar} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]} initialView={view} headerToolbar={false} noEventsContent={filterCount ? 'Không có kết quả theo bộ lọc. Thử bỏ bớt bộ lọc.' : 'Chưa có lịch trong khoảng thời gian này.'} timeZone="UTC" now={inputTime(new Date().toISOString()) + ':00Z'} locale={viLocale} firstDay={1} allDaySlot={true} allDayText="Cả ngày" slotMinTime="00:00:00" slotMaxTime="24:00:00" slotDuration="00:30:00" scrollTime="08:00:00" scrollTimeReset={false} height={view === 'listWeek' ? 'auto' : view.startsWith('timeGrid')?640:650} nowIndicator editable={!readOnly && !busy} selectable={!readOnly && !busy} selectMirror selectMinDistance={5} eventDragMinDistance={5} longPressDelay={350} eventInteractive eventDurationEditable={false} slotEventOverlap={false} eventMinHeight={26} eventShortHeight={42} dayHeaderContent={arg=><div className={'calendar-day-heading'+(arg.isToday?' is-today':'')}><span>{['CN','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'][arg.date.getUTCDay()]}</span>{view !== 'dayGridMonth' && <strong>{String(arg.date.getUTCDate()).padStart(2,'0')}</strong>}</div>} eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} datesSet={arg => { setSelectedId(null);setDate(arg.view.calendar.getDate().toISOString().slice(0,10)); const start = localDate(arg.view.currentStart), end = localDate(arg.view.currentEnd); setRange({ start, end }); onRange?.(localDate(arg.view.activeStart),localDate(arg.view.activeEnd)); setTitle(arg.view.title); setView(arg.view.type); }} dayMaxEvents={3} moreLinkText={n=>view==='dayGridMonth'?`+${n} khung giờ khác`:`+${n} lịch khác`} events={events} eventContent={arg => <CalendarEventCard lesson={arg.event.extendedProps.lesson} title={arg.event.title} names={names}/>} eventDidMount={arg => { const l = arg.event.extendedProps.lesson as Lesson; if (l) arg.el.setAttribute('aria-label', `${arg.event.title} · ${l.all_day ? 'Cả ngày' : timeText(l.starts_at)+'–'+timeText(l.ends_at)} · ${participantIds(l).map(employeeName).join(', ')} · ${l.location || 'Chưa có địa điểm'} · ${statusNames[l.status]}`); }} eventClick={arg => {if(arg.event.extendedProps.lesson){anchor.current=arg.el;setSelectedId(arg.event.extendedProps.lesson.id);}}} select={arg => !readOnly && !busy && openLesson({ starts_at: arg.allDay ? arg.startStr.slice(0, 10) + 'T08:00:00+07:00' : arg.startStr.slice(0, 16) + '+07:00', ends_at: arg.allDay ? arg.startStr.slice(0, 10) + 'T09:00:00+07:00' : arg.endStr.slice(0, 16) + '+07:00' })} eventDrop={arg => { if (readOnly || busy) { arg.revert(); return; } const old = arg.event.extendedProps.lesson as Lesson; const start = arg.event.allDay?arg.event.startStr.slice(0,10)+'T00:00:00+07:00':arg.event.startStr.slice(0,16)+'+07:00', end = arg.event.allDay?arg.event.endStr.slice(0,10)+'T00:00:00+07:00':arg.event.endStr.slice(0,16)+'+07:00'; arg.revert(); openLesson({ ...old, starts_at: start, ends_at: end }); }}/></div></div><CalendarSummary sum={sum} utilization={utilization} showCapacity={showCapacity} showHours={showHours} setShowHours={setShowHours} ranged={ranged} data={data} range={range} allRanged={allRanged} employeeFilter={employeeFilter} /></section>{selected&&<CalendarEventPreview key={selected.id} lesson={selected} title={calendarTitle(selected,names,workNames[selected.work_kind||'legacy'])} person={participantIds(selected).map(employeeName).join(', ')} anchor={anchor.current} actionLabel={!readOnly?'Chỉnh sửa':ownEmployeeId?'Mở chi tiết':'Xem chi tiết'} disabled={busy&&!readOnly} onClose={()=>setSelectedId(null)} onAction={()=>openLesson(selected)}/ >}{tasksOpen && <Modal title={`Cần xử lý — ${pending.length}`} close={() => setTasksOpen(false)}><div className="task-list"><p className="muted">Các lịch đã qua giờ chưa nộp báo cáo. Không phụ thuộc bộ lọc lịch.</p><h3>Giờ chưa nộp báo cáo ({pending.length})</h3>{pending.map(l => <button className="task-row" key={l.id} onClick={() => { setTasksOpen(false); openLesson(l); }}><div><strong>{studentName(l.student_id)}</strong><small>{dateText(l.starts_at)} · {timeText(l.starts_at)}–{timeText(l.ends_at)} · {employeeName(l.employee_id)}</small></div><ChevronRight size={17}/></button>)}{!pending.length && <p className="muted">Không có giờ cần báo cáo.</p>}</div></Modal>}</>;
}
