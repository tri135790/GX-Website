import { participantIds } from './domain.ts';
import type { Lesson } from './types';
export function assertSavedParticipants(expected: Lesson[], actual: Lesson[]) {
 const saved = new Map(actual.map(l=>[l.id,l]));
 for (const lesson of expected) {
  const row = saved.get(lesson.id);
  const roles = (l:Lesson) => JSON.stringify(Object.entries(l.participant_roles||{}).sort(([a],[b])=>a.localeCompare(b)));
  if (!row || participantIds(lesson).sort().join(',')!==participantIds(row).sort().join(',') || roles(lesson)!==roles(row)) {
   throw Error('Database chưa lưu đủ người tham gia hoặc vai trò. Kiểm tra migration 009/010 và tải lại trước khi sửa tiếp.');
  }
 }
}
