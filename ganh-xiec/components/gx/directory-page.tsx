'use client';
import { useState } from 'react';
import { Plus, Search, Check, ChevronRight } from 'lucide-react';
import type { Data } from '@/lib/gx/types';
import { monday } from '@/lib/gx/domain';
import { Tag, Empty } from './shared';
type Kind = 'employees' | 'students' | 'parents';
export function DirectoryPage({ kind, data, add, open, openStudent }: {
    kind: Kind;
    data: Data;
    add: () => void;
    open: (id: string) => void;
    openStudent: (id: string) => void;
}) {
    const [query, setQuery] = useState(''), [active, setActive] = useState('active');
    const title = { employees: 'Nhân sự', students: 'Học sinh', parents: 'Phụ huynh' }[kind];
    const list = data[kind].filter(r => (active === 'all' || r.active) && JSON.stringify([r.name, 'email' in r ? r.email : '', 'phone' in r ? r.phone : '', 'specialty' in r ? r.specialty : '']).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
    const cols = { employees: ['Nhân sự', 'Chuyên môn', 'Học sinh phụ trách', 'Trạng thái'], students: ['Học sinh', 'Người phụ trách chính', 'Tiến trình tuần này', 'Trạng thái'], parents: ['Phụ huynh', 'Liên hệ', 'Học sinh liên kết', 'Trạng thái'] }[kind];
    return <><div className="page-heading"><h1>{title} <span className="heading-count">{list.length}</span></h1><button className="btn primary" onClick={add}><Plus size={17}/>Thêm {title.toLocaleLowerCase('vi')}</button></div><div className="list-toolbar"><div className="search-box"><Search size={17}/><input aria-label={`Tìm ${title.toLocaleLowerCase('vi')}`} placeholder="Tìm theo tên hoặc thông tin liên hệ" value={query} onChange={e => setQuery(e.target.value)}/></div><select aria-label="Lọc hoạt động" value={active} onChange={e => setActive(e.target.value)}><option value="active">Đang hoạt động</option><option value="all">Tất cả</option></select></div><section className="panel"><table className="responsive-table"><thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{list.map(r => <tr key={r.id}><td><button className="name-button" onClick={() => open(r.id)}>{r.name}<ChevronRight size={15}/></button></td>{kind === 'employees' ? <><td data-label="Chuyên môn">{'specialty' in r ? r.specialty || 'Chưa cập nhật' : ''}</td><td data-label="Học sinh phụ trách">{data.assignments.filter(a => a.employee_id === r.id).length}</td></> : kind === 'students' ? <><td data-label="Phụ trách chính">{data.employees.find(e => e.id === data.assignments.find(a => a.student_id === r.id && a.responsibility === 'primary')?.employee_id)?.name || 'Chưa phân công'}</td><td data-label="Tiến trình tuần">{data.weekly.some(w => w.student_id === r.id && w.week_start === monday()) ? <Tag><Check size={12}/>Đã cập nhật</Tag> : <Tag tone="sand">Chờ cập nhật</Tag>}</td></> : <><td data-label="Liên hệ">{'phone' in r && r.phone && <span>{r.phone}</span>}{'email' in r && <small>{r.email || 'Chưa cập nhật'}</small>}</td><td data-label="Học sinh">{data.families.filter(f => f.parent_id === r.id).map(f => <button className="text-button linked-student" key={f.id} onClick={() => openStudent(f.student_id)}>{data.students.find(s => s.id === f.student_id)?.name}<ChevronRight size={12}/></button>)}{!data.families.some(f => f.parent_id === r.id) && 'Chưa liên kết'}</td></>}<td data-label="Trạng thái"><Tag tone={r.active ? 'green' : 'gray'}>{r.active ? 'Đang hoạt động' : 'Đã ngừng'}</Tag></td></tr>)}</tbody></table>{!list.length && <Empty text="Không có kết quả" detail="Thử thay đổi tìm kiếm hoặc bộ lọc."/>}</section></>;
}
