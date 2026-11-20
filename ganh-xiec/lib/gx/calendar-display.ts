import type { Lesson } from './types';
import { addDays, localDate } from './domain';

export function calendarColors(color?: string) {
 let background = /^#[0-9a-f]{6}$/i.test(color || '') ? color! : '#386b9b';
 if (/^#[0-9a-f]{3}$/i.test(color || '')) background = '#' + color!.slice(1).split('').map(c => c + c).join('');
 const rgb = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16));
 const linear = rgb.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
 const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
 // The better of black/white always exceeds 4.5:1 against an opaque sRGB colour.
 const text = (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
 const border = '#' + rgb.map(v => Math.round(v * 0.6).toString(16).padStart(2, '0')).join('');
 return { background, text, border };
}

export type CalendarCard = { lesson: Lesson; displayEmployee: string };
export function calendarCards(lessons: Lesson[], employeeFilter: string): CalendarCard[] {
 return lessons.flatMap(lesson => (lesson.work_kind === 'meeting'
  ? [lesson.employee_id, ...(lesson.support_employee_ids || [])] : [lesson.employee_id])
  .filter(id => !employeeFilter || id === employeeFilter || lesson.work_kind !== 'meeting')
  .map(displayEmployee => ({lesson, displayEmployee})));
}

export function timeGridWidth(cards: CalendarCard[], start: string, end: string, view: string): number | undefined {
 if (view !== 'timeGridDay' && view !== 'timeGridWeek') return undefined;
 let dayCount = 0, lanes = 1;
 for (let day = start; day < end; day = addDays(day, 1)) {
  dayCount++;
  const from = Date.parse(day + 'T06:00:00+07:00'), to = Date.parse(day + 'T22:00:00+07:00');
  const points: [number, number][] = [];
  for (const {lesson} of cards) {
   if (lesson.all_day) continue;
   const a = Math.max(from, Date.parse(lesson.starts_at)), b = Math.min(to, Date.parse(lesson.ends_at));
   if (a < b) points.push([a, 1], [b, -1]);
  }
  // End before start at a shared boundary: adjacent appointments do not overlap.
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0;
  for (const [, delta] of points) { active += delta; lanes = Math.max(lanes, active); }
 }
 // FullCalendar gives each day equal width; reserve enough space for the busiest day.
 return 80 + Math.max(dayCount, 1) * (lanes * 220 + 16);
}

// Connected overlapping intervals share one horizontal row inside their month day.
export function monthCardRows(cards: CalendarCard[]): CalendarCard[][] {
 const days=new Map<string,CalendarCard[]>(), rows:CalendarCard[][]=[];
 for(const card of cards){
  if(card.lesson.all_day){rows.push([card]);continue;}
  const day=localDate(card.lesson.starts_at);days.set(day,[...(days.get(day)||[]),card]);
 }
 for(const dayCards of days.values()){
  dayCards.sort((a,b)=>Date.parse(a.lesson.starts_at)-Date.parse(b.lesson.starts_at)||a.lesson.id.localeCompare(b.lesson.id));
  let row:CalendarCard[]=[],end=0;
  for(const card of dayCards){
   const start=Date.parse(card.lesson.starts_at);
   if(row.length&&start>=end){rows.push(row);row=[];end=0;}
   row.push(card);end=Math.max(end,Date.parse(card.lesson.ends_at));
  }
  if(row.length)rows.push(row);
 }
 return rows;
}
