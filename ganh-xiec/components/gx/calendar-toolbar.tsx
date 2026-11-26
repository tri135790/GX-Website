import { useState } from 'react';
import { Popover } from 'radix-ui';
import { DayPicker } from 'react-day-picker';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import 'react-day-picker/style.css';
export function CalendarToolbar({title,date,view,busy,canCreate,onToday,onPrevious,onNext,onDate,onView,onCreate}: {
 title:string;date:string;view:string;busy:boolean;canCreate:boolean;
 onToday:()=>void;onPrevious:()=>void;onNext:()=>void;onDate:(date:string)=>void;onView:(view:string)=>void;onCreate:()=>void;
}) {
 const [open,setOpen]=useState(false);
 const selected=new Date(date+'T12:00:00');
 return <div className="calendar-toolbar"><div className="calendar-navigation">
 <button className="btn compact" onClick={onToday}>Hôm nay</button>
 <button className="icon-button" aria-label="Khoảng thời gian trước" onClick={onPrevious}><ChevronLeft size={18}/></button>
 <button className="icon-button" aria-label="Khoảng thời gian sau" onClick={onNext}><ChevronRight size={18}/></button>
 <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><button className="calendar-range-title text-button" aria-label={`Chọn ngày, ${title}`}><span aria-live="polite">{title}</span><ChevronDown size={16}/></button></Popover.Trigger>
 <Popover.Portal><Popover.Content className="gx-calendar-picker" sideOffset={8} collisionPadding={12}><DayPicker key={date} mode="single" locale={vi} weekStartsOn={1} selected={selected} defaultMonth={selected} autoFocus onSelect={d=>{if(d){onDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);setOpen(false);}}}/></Popover.Content></Popover.Portal></Popover.Root>
 </div><div className="calendar-actions"><div className="segmented" role="group" aria-label="Chế độ xem lịch">{[['timeGridDay','Ngày'],['timeGridWeek','Tuần'],['dayGridMonth','Tháng'],['listWeek','Danh sách']].map(([id,label])=><button key={id} className={view===id?'selected':''} aria-pressed={view===id} onClick={()=>onView(id)}>{label}</button>)}</div>{canCreate&&<button className="btn primary" disabled={busy} onClick={onCreate}><Plus size={17}/>Thêm giờ làm</button>}</div></div>;
}
