import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyData, type Data, type Lesson, type Employee, type Student } from './types';
export type CalendarRow = Pick<Lesson, 'id'|'student_id'|'employee_id'|'starts_at'|'ends_at'|'mode'|'status'|'actual_minutes'> & {student_name:string;employee_name:string;color:string};
export type Workspace = Pick<Data,'students'|'assignments'|'goals'|'weekly'|'lessons'> & {employees:Pick<Employee,'id'|'name'|'color'>[];authors:{id:string;name:string}[]};
export async function loadEmployee(client:SupabaseClient, start:string, end:string) {
    const calendarPromise = (async () => {
        const rows: CalendarRow[] = [];
        for(let startRow=0;;startRow+=1000) {
            const {data,error}=await client.rpc('employee_calendar',{p_start:start+'T00:00:00+07:00',p_end:end+'T00:00:00+07:00'}).order('starts_at').order('id').range(startRow,startRow+999);
            if(error) throw error;
            rows.push(...data);
            if(data.length<1000) return rows;
        }
    })();
    const [workspace, calendar] = await Promise.all([
        client.rpc('employee_workspace'),
        calendarPromise,
    ]);
    if(workspace.error) throw workspace.error;
    return {workspace:workspace.data as Workspace, calendar};
}
// Adapter for shared read-only calendar. Missing private fields are intentionally empty.
export function calendarData(workspace:Workspace, rows:CalendarRow[]):Data {
    const employees = new Map(workspace.employees.map(e=>[e.id,{...e,version:0,email:'',phone:'',specialty:'',active:true}]));
    const students = new Map<string,Student>();
    for(const row of rows){
        employees.set(row.employee_id,{id:row.employee_id,name:row.employee_name,color:row.color,version:0,email:'',phone:'',specialty:'',active:true});
        students.set(row.student_id,{id:row.student_id,name:row.student_name,version:0,birth_date:'',start_date:'',notes:'',active:true});
    }
    return {...emptyData,employees:[...employees.values()],students:[...students.values()],lessons:rows.map(row=>({...row,version:0,location:'',reason:'',content:'',note:'',series_id:null}))};
}
export async function saveEmployee(client:SupabaseClient,table:string,record:Record<string,unknown>){
    const {error}=await client.rpc('employee_save',{p_table:table,p_record:record});
    if(error) throw error;
}
