import type { Lesson } from './types';

export function calendarColors(color?: string) {
 let background = /^#[0-9a-f]{6}$/i.test(color || '') ? color! : '#386b9b';
 if (/^#[0-9a-f]{3}$/i.test(color || '')) background = '#' + color!.slice(1).split('').map(c => c + c).join('');
 const base = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16));
 // Preserve exact service colors.
 const rgb = base;
 background = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
 const linear = rgb.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
 const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
 // The better of black/white always exceeds 4.5:1 against an opaque sRGB colour.
 const text = (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
 const border = '#' + base.map(v => Math.round(v * 0.75 + 255 * 0.25).toString(16).padStart(2, '0')).join('');
 return { background, text, border };
}

export type CalendarCard = { lesson: Lesson; displayEmployee: string };
export function calendarCards(lessons: Lesson[], employeeFilter: string): CalendarCard[] {
 return lessons.map(lesson=>({lesson,displayEmployee:lesson.employee_id}));
}

export type CalendarNames = { students: Map<string, string>; teachers: Map<string, string>; employees: Map<string, string> };
export function calendarTitle(lesson: Lesson, names: CalendarNames, fallback: string) {
 if (lesson.work_kind === 'leave') return names.employees.get(lesson.employee_id) || 'Nhân sự';
 if (lesson.student_id) return names.students.get(lesson.student_id) || 'Học sinh';
 if (lesson.teacher_ids?.length) return lesson.teacher_ids.map(id => names.teachers.get(id) || 'Giáo viên').join(', ');
 return fallback;
}
