import { withSupabase, fromSupabaseUrl } from 'npm:@supabase/server@1.9.2';
import { z } from 'npm:zod@3.25.76';
const schema=z.object({action:z.enum(['invite','revoke']),id:z.string().uuid().optional(),email:z.string().email().optional(),role:z.enum(['admin','employee','parents']).optional(),employee_id:z.string().uuid().nullable().optional(),parent_id:z.string().uuid().nullable().optional()});

const origin = Deno.env.get('APP_URL');
const url = Deno.env.get('SUPABASE_URL');
export default {
 fetch: withSupabase({
  auth: 'user',
  issuer: url ? fromSupabaseUrl(url) : undefined,
  audience: 'authenticated',
  cors: {
   'Access-Control-Allow-Origin': origin ? new URL(origin).origin : 'https://unconfigured.invalid',
   'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
   'Access-Control-Allow-Methods': 'POST, OPTIONS',
   'Vary': 'Origin',
  },
 }, async (req, ctx) => {
  if (req.method !== 'POST') return Response.json({error:'Phương thức không được hỗ trợ.'},{status:405});
  if (!origin) return Response.json({error:'Chưa cấu hình APP_URL cho dịch vụ lời mời.'},{status:503});
  const {data:profile,error:profileError}=await ctx.supabase.from('profiles').select('role,active').eq('id',ctx.userClaims!.id).single();
  if(profileError || !profile?.active || profile.role!=='admin') return Response.json({error:'Không có quyền quản trị.'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Thông tin lời mời không hợp lệ.'},{status:400});
 const body=parsed.data;const service=ctx.supabaseAdmin;
 if(body.action==='revoke'){if(!body.id)return Response.json({error:'Thiếu lời mời.'},{status:400});const {error}=await service.from('invitations').update({status:'revoked'}).eq('id',body.id).eq('status','pending');return Response.json(error?{error:error.message}:{ok:true},{status:error?400:200});}
 if(!body.email||!body.role||(body.role==='employee'&&!body.employee_id)||(body.role==='parents'&&!body.parent_id))return Response.json({error:'Chọn role và hồ sơ tương ứng.'},{status:400});
 const email=body.email.trim().toLowerCase();
 const {data:existing}=await service.from('profiles').select('id').ilike('email',email).maybeSingle();if(existing)return Response.json({error:'Email đã có tài khoản; hãy chỉnh quyền trong danh sách tài khoản.'},{status:409});
 const {error:revokeError}=await service.from('invitations').update({status:'revoked'}).ilike('email',email).eq('status','pending');if(revokeError)return Response.json({error:revokeError.message},{status:400});
 const {data:inv,error}=await service.from('invitations').insert({email,role:body.role,employee_id:body.role==='employee'?body.employee_id:null,parent_id:body.role==='parents'?body.parent_id:null,expires_at:new Date(Date.now()+7*86400000).toISOString()}).select('id').single();if(error)return Response.json({error:error.message},{status:400});
 const sent=await service.auth.admin.inviteUserByEmail(email,{redirectTo:origin});
 if(sent.error){await service.from('invitations').update({status:'revoked'}).eq('id',inv.id);return Response.json({error:'Chưa gửi được email. Kiểm tra SMTP và trạng thái tài khoản trong Supabase. '+sent.error.message},{status:502});}
 await service.from('audit_log').insert({actor:ctx.userClaims!.id,entity:'invitations',record_id:inv.id,operation:'SEND_INVITATION',after_data:{email,role:body.role}});
 return Response.json({ok:true});
 }),
};
