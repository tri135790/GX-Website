import { Clock3 } from 'lucide-react';
import type { Lesson, Data } from '@/lib/gx/types';
import { totals, hours } from '@/lib/gx/domain';
import { Avatar } from './shared';
export function HoursPanel({ lessons, data }: {
    lessons: Lesson[];
    data: Data;
}) { const t = totals(lessons); return <section className="panel hours-panel"><div className="panel-heading"><div><h2>Tổng giờ dạy</h2><p>Theo khoảng thời gian và bộ lọc đang xem · online/offline là giờ thực dạy</p></div><Clock3 size={20}/></div><div className="hours-summary">{[['Kế hoạch', t.planned], ['Thực dạy', t.actual], ['Online', t.online], ['Offline', t.offline]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{hours(Number(value))}<span> giờ</span></strong></div>)}</div><div className="table-wrap"><table><thead><tr><th>Giáo viên</th><th>Kế hoạch</th><th>Thực dạy</th><th>Online</th><th>Offline</th></tr></thead><tbody>{data.employees.filter(e => lessons.some(l => l.employee_id === e.id)).map(e => { const s = totals(lessons.filter(l => l.employee_id === e.id)); return <tr key={e.id}><td><div className="row"><Avatar name={e.name} color={e.color} small/>{e.name}</div></td><td>{hours(s.planned)} giờ</td><td><strong>{hours(s.actual)} giờ</strong></td><td>{hours(s.online)} giờ</td><td>{hours(s.offline)} giờ</td></tr>; })}</tbody></table></div></section>; }
