import type { Lesson } from './types';
export type DeleteScope = 'one' | 'future';
export type DeleteSnapshot = { id: string; version: number; deletable: boolean }[];
export function canDeleteWork(l: Lesson, now = Date.now()): boolean {
 return l.status !== 'completed' && !(l.actual_minutes > 0);
}
export function workDeleteSnapshot(list: Lesson[], anchor: Lesson, scope: DeleteScope, now = Date.now()): DeleteSnapshot {
 return list.filter(l => scope === 'future' && anchor.series_id
  ? l.series_id === anchor.series_id && (anchor.work_kind === 'meeting' || l.employee_id === anchor.employee_id) && Date.parse(l.starts_at) >= Date.parse(anchor.starts_at)
  : l.id === anchor.id).map(l => ({id:l.id, version:l.version, deletable:canDeleteWork(l,now)})).sort((a,b)=>a.id.localeCompare(b.id));
}
