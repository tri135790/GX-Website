import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { emptyData, type Data, type Table, type Base } from './types';
export type Change={table:Table;record:Base & Record<string,unknown>};
export function appUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}
export async function connect(): Promise<SupabaseClient | null> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !key && import.meta.env.DEV) return null;
  if (!url || !key) throw Error('Chưa cấu hình kết nối Supabase. Kiểm tra biến môi trường và build lại website.');
  if (!key.startsWith('sb_publishable_')) throw Error('Frontend cần Supabase publishable key (sb_publishable_).');
  return createClient(url, key);
}
export async function loadData(client:SupabaseClient):Promise<Data>{const result={...emptyData};await Promise.all((Object.keys(result) as Table[]).map(async table=>{const rows:unknown[]=[];for(let start=0;;start+=1000){const {data,error}=await client.from(table).select('*').order('id').range(start,start+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;}(result[table] as unknown[])=rows;}));return result;}
export async function persist(client:SupabaseClient,changes:Change[],removed:Change[]=[]){const {error}=await client.rpc('save_bundle',{changes,removed});if(error)throw Error(error.code==='23P01'?'Giáo viên hoặc học sinh đã có lịch trùng giờ.':error.message);}
