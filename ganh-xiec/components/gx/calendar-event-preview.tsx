import { useEffect, useRef, useState } from 'react';
import { Popover } from 'radix-ui';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import type { Lesson } from '@/lib/gx/types';
import { workNames, statusNames } from '@/lib/gx/types';
import { dateText, timeText, addDays, localDate } from '@/lib/gx/domain';
export function CalendarEventPreview({lesson,title,person,anchor,actionLabel,disabled,onClose,onAction}: {
 lesson:Lesson;title:string;person:string;anchor:HTMLElement|null;actionLabel:string;disabled:boolean;onClose:()=>void;onAction:()=>void;
}) {
 const [mobile,setMobile]=useState(()=>matchMedia('(max-width:700px)').matches);
 const virtual=useRef({getBoundingClientRect:()=>anchor?.getBoundingClientRect()||new DOMRect()});
 virtual.current.getBoundingClientRect=()=>anchor?.getBoundingClientRect()||new DOMRect();
 useEffect(()=>{const m=matchMedia('(max-width:700px)');const change=()=>setMobile(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 const restore=()=>{if(anchor?.isConnected)anchor.focus();else document.querySelector<HTMLButtonElement>('.calendar-navigation button')?.focus();};
 const content=<><div className="gx-preview-heading">{mobile?<Drawer.Title>{title}</Drawer.Title>:<h2 id="gx-preview-title">{title}</h2>}<button className="icon-button" aria-label="Đóng xem nhanh" onClick={onClose}><X size={18}/></button></div><div className="gx-preview-content"><p><strong>{workNames[lesson.work_kind||'legacy']}</strong> · {statusNames[lesson.status]}</p><p>{lesson.all_day?`${dateText(lesson.starts_at)} – ${dateText(addDays(localDate(lesson.ends_at),-1))} · Cả ngày`:`${dateText(lesson.starts_at)} · ${timeText(lesson.starts_at)}–${timeText(lesson.ends_at)}`}</p><p><strong>Nhân sự:</strong> {person}</p><p><strong>Địa điểm:</strong> {lesson.location||'Chưa có địa điểm'}</p><p className="employee-note">{lesson.content||'Chưa có nội dung.'}</p></div><div className="gx-preview-footer"><button className="btn primary" disabled={disabled} onClick={()=>{onClose();requestAnimationFrame(onAction);}}>{actionLabel}</button></div></>;
 if(mobile)return <Drawer.Root open onOpenChange={open=>{if(!open)onClose();}}><Drawer.Portal><Drawer.Overlay className="gx-preview-overlay"/><Drawer.Content className="gx-event-preview gx-preview-drawer" aria-describedby={undefined} onCloseAutoFocus={e=>{e.preventDefault();restore();}}>{content}</Drawer.Content></Drawer.Portal></Drawer.Root>;
 return <Popover.Root open onOpenChange={open=>{if(!open)onClose();}}><Popover.Anchor virtualRef={virtual}/><Popover.Portal><Popover.Content className="gx-event-preview" aria-labelledby="gx-preview-title" side="right" align="start" sideOffset={8} collisionPadding={12} onCloseAutoFocus={e=>{e.preventDefault();restore();}}>{content}</Popover.Content></Popover.Portal></Popover.Root>;
}
