import { calendarColors } from '@/lib/gx/calendar-display';
const palette = [
 ['Xanh lá','#58a68b'],['Xanh biển','#609bd1'],['Tím','#9c82c4'],['Hồng','#d683a1'],
 ['Cam đào','#dc9a6b'],['Vàng','#c5ae56'],['Xanh ngọc','#4da6ad'],['Xanh ô liu','#91a56c'],
];
export function EmployeeColorPicker({value,onChange,name}:{value:string;onChange:(color:string)=>void;name:string}) {
 const colors=calendarColors(value);
 return <fieldset className="employee-color-picker"><legend>Màu riêng trên lịch</legend><div className="employee-color-swatches">{palette.map(([label,color])=>{
 const swatch=calendarColors(color);
 return <button type="button" key={color} title={label} aria-label={label} aria-pressed={value.toLowerCase()===color} style={{backgroundColor:swatch.background,borderColor:swatch.border,color:swatch.text}} onClick={()=>onChange(color)}>{value.toLowerCase()===color?'✓':''}</button>;
 })}</div><label className="employee-custom-color">Chọn màu khác<input aria-label="Màu tùy chọn của nhân sự" type="color" value={/^#[0-9a-f]{6}$/i.test(value)?value:'#58a68b'} onChange={e=>onChange(e.target.value)}/></label><div className="employee-color-preview" style={{backgroundColor:colors.background,borderColor:colors.border,color:colors.text}}><small>Xem trước trên lịch</small><strong>{name.trim()||'Tên nhân sự'} · Chính</strong><span>08:00–09:00 · Đã lên lịch</span></div><small>Lưu hồ sơ để áp dụng màu cho các lịch phụ trách chính.</small></fieldset>;
}
