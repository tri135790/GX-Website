import { useEffect, useState, type InputHTMLAttributes } from 'react';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'> & {value:string;onChange:(event:{target:{value:string}})=>void};
const display=(value:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(value);return m?`${m[3]}/${m[2]}/${m[1]}${m[4]?' '+m[4]:''}`:'';};
export function DateInput({value,onChange,type='date',...props}:Props){
 const [text,setText]=useState(display(value));
 useEffect(()=>setText(display(value)),[value]);
 const dateTime=type==='datetime-local';
 return <input {...props} type="text" inputMode="numeric" placeholder={dateTime?'dd/mm/yyyy hh:mm':'dd/mm/yyyy'} value={text} onChange={e=>{
 const raw=e.target.value;setText(raw);
 if(!raw){e.target.setCustomValidity('');onChange({target:{value:''}});return;}
 const m=(dateTime?/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/:/^(\d{2})\/(\d{2})\/(\d{4})$/).exec(raw);
 let iso='';if(m){const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);const d=new Date(Date.UTC(year,month-1,day));if(year>=1900&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day&&(!dateTime||(Number(m[4])<24&&Number(m[5])<60)))iso=`${m[3]}-${m[2]}-${m[1]}${dateTime?'T'+m[4]+':'+m[5]:''}`;}
 e.target.setCustomValidity(iso?'':dateTime?'Nhập ngày giờ hợp lệ: dd/mm/yyyy hh:mm':'Nhập ngày hợp lệ: dd/mm/yyyy');if(iso)onChange({target:{value:iso}});
 }}/>
}
