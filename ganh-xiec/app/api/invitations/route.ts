import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const schema=z.object({action:z.enum(['invite','revoke']),id:z.string().uuid().optional(),email:z.string().email().optional(),role:z.enum(['admin','employee','parents']).optional(),employee_id:z.string().uuid().nullable().optional(),parent_id:z.string().uuid().nullable().optional()});
export async function POST(req:Request){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY,origin=process.env.APP_URL;
 if(!url||!key||!secret||!origin)return Response.json({error:'Chưa cấu hình dịch vụ gửi lời mời.'},{status:503});
 const bearer=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!bearer)return Response.json({error:'Cần đăng nhập.'},{status:401});
 const scoped=createClient(url,key,{global:{headers:{Authorization:`Bearer ${bearer}`}},auth:{persistSession:false}});
 const {data:{user},error:authError}=await scoped.auth.getUser(bearer);if(authError||!user)return Response.json({error:'Phiên đăng nhập hết hạn.'},{status:401});
 const {data:profile}=await scoped.from('profiles').select('role,active').eq('id',user.id).single();if(!profile?.active||profile.role!=='admin')return Response.json({error:'Không có quyền quản trị.'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Thông tin lời mời không hợp lệ.'},{status:400});
 const body=parsed.data;const service=createClient(url,secret,{auth:{persistSession:false}});
 if(body.action==='revoke'){if(!body.id)return Response.json({error:'Thiếu lời mời.'},{status:400});const {error}=await service.from('invitations').update({status:'revoked'}).eq('id',body.id).eq('status','pending');return Response.json(error?{error:error.message}:{ok:true},{status:error?400:200});}
 if(!body.email||!body.role||(body.role==='employee'&&!body.employee_id)||(body.role==='parents'&&!body.parent_id))return Response.json({error:'Chọn role và hồ sơ tương ứng.'},{status:400});
 const email=body.email.trim().toLowerCase();
 const {data:existing}=await service.from('profiles').select('id').ilike('email',email).maybeSingle();if(existing)return Response.json({error:'Email đã có tài khoản; hãy chỉnh quyền trong danh sách tài khoản.'},{status:409});
 const {error:revokeError}=await service.from('invitations').update({status:'revoked'}).ilike('email',email).eq('status','pending');if(revokeError)return Response.json({error:revokeError.message},{status:400});
 const {data:inv,error}=await service.from('invitations').insert({email,role:body.role,employee_id:body.role==='employee'?body.employee_id:null,parent_id:body.role==='parents'?body.parent_id:null,expires_at:new Date(Date.now()+7*86400000).toISOString()}).select('id').single();if(error)return Response.json({error:error.message},{status:400});
 const sent=await service.auth.admin.inviteUserByEmail(email,{redirectTo:origin});
 if(sent.error){await service.from('invitations').update({status:'revoked'}).eq('id',inv.id);return Response.json({error:'Chưa gửi được email. Kiểm tra SMTP và trạng thái tài khoản trong Supabase. '+sent.error.message},{status:502});}
 await service.from('audit_log').insert({actor:user.id,entity:'invitations',record_id:inv.id,operation:'SEND_INVITATION',after_data:{email,role:body.role}});
 return Response.json({ok:true});
}
