-- Apply after 009, before deploying the matching frontend.
begin;
select pg_advisory_xact_lock(742031);
alter table public.lessons add column participant_roles jsonb not null default '{}';
alter table public.lessons drop constraint lessons_work_kind_check;
alter table public.lessons add constraint lessons_work_kind_check check(work_kind in ('legacy','consultation','therapy','consultation_therapy','meeting','report','leave'));
alter table public.lessons drop constraint meeting_participants_only;
alter table public.lessons add constraint multi_participants_only check(work_kind in ('meeting','consultation_therapy') or cardinality(support_employee_ids)=0);
alter table public.lessons drop constraint work_subject;
alter table public.lessons add constraint work_subject check(
 (work_kind in ('legacy','therapy','consultation_therapy') and student_id is not null and cardinality(teacher_ids)=0) or
 (work_kind='consultation' and ((student_id is not null and cardinality(teacher_ids)=0) or (student_id is null and cardinality(teacher_ids)>0))) or
 (work_kind in ('meeting','report','leave') and student_id is null and cardinality(teacher_ids)=0));
create or replace function public.validate_work_metadata() returns trigger language plpgsql security definer set search_path='' as $$declare clash public.lessons;who text;begin
 new.auto_recorded=false;
 if jsonb_typeof(new.participant_roles)<>'object' then raise exception 'Vai trò không hợp lệ.';end if;
 if new.work_kind='consultation_therapy' then
 if (select count(*) from jsonb_object_keys(new.participant_roles))<>cardinality(new.support_employee_ids)+1
 or exists(select 1 from unnest(array_prepend(new.employee_id,new.support_employee_ids)) x where coalesce(new.participant_roles->>x::text,'') not in ('consultation','therapy')) then raise exception 'Chọn đúng một vai trò cho mỗi nhân sự.';end if;
 elsif new.participant_roles<>'{}'::jsonb then raise exception 'Loại công việc này không có phân vai.';end if;


 if array_position(new.teacher_ids,null) is not null or cardinality(new.teacher_ids)<>(select count(distinct x) from unnest(new.teacher_ids) x) then raise exception 'Danh sách giáo viên không hợp lệ.';end if;
 if exists(select 1 from unnest(new.teacher_ids) x where not exists(select 1 from public.teachers t where t.id=x and t.active)) then raise exception 'Giáo viên không tồn tại hoặc đã xóa.';end if;
 if new.status<>'cancelled' then
 select * into clash from public.lessons l where l.id<>new.id and l.status<>'cancelled'
 and ((not new.primary_pending and not l.primary_pending and array_prepend(l.employee_id,l.support_employee_ids) && array_prepend(new.employee_id,new.support_employee_ids)) or (new.student_id is not null and l.student_id=new.student_id) or l.teacher_ids && new.teacher_ids)
 and tstzrange(l.starts_at,l.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)') limit 1;
 if clash.id is not null then
 select name into who from public.employees where id=any(array_prepend(new.employee_id,new.support_employee_ids)) and id=any(array_prepend(clash.employee_id,clash.support_employee_ids)) order by id limit 1;
 raise exception 'Trùng lịch % vào % – %.',coalesce(who,'học sinh / giáo viên'),to_char(clash.starts_at at time zone 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI'),to_char(clash.ends_at at time zone 'Asia/Ho_Chi_Minh','HH24:MI');
 end if;end if;
 if tg_op='INSERT' and new.primary_pending then raise exception 'Chọn nhân sự chính.';end if;
 if tg_op='UPDATE' and new.primary_pending and not old.primary_pending then raise exception 'Không được bỏ nhân sự chính.';end if;
 if array_position(new.support_employee_ids,null) is not null or new.employee_id=any(new.support_employee_ids) or cardinality(new.support_employee_ids)<>(select count(distinct x) from unnest(new.support_employee_ids) x) then raise exception 'Danh sách nhân sự phụ không hợp lệ.';end if;
 if exists(select 1 from unnest(new.support_employee_ids) x where not exists(select 1 from public.employees e where e.id=x)) then raise exception 'Nhân sự phụ không tồn tại.';end if;
 if tg_op='INSERT' or new.support_employee_ids is distinct from old.support_employee_ids then
 if exists(select 1 from public.employees e where e.id=any(new.support_employee_ids) and not e.active) then raise exception 'Nhân sự phụ đã ngừng hoạt động.';end if;
 end if;
 if new.report_status='submitted' then
 if trim(new.report_content)='' then raise exception 'Nhập nội dung trước khi nộp báo cáo.';end if;
 if tg_op='INSERT' or old.report_status<>'submitted' or old.report_content is distinct from new.report_content then new.report_submitted_at=now();new.report_submitted_by=auth.uid();
 else new.report_submitted_at=old.report_submitted_at;new.report_submitted_by=old.report_submitted_by;end if;
 else new.report_submitted_at=null;new.report_submitted_by=null;end if;
 return new;
end$$;

create or replace function public.validate_lesson_assignment() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.student_id is not null and (tg_op='INSERT' or new.student_id is distinct from old.student_id or new.employee_id is distinct from old.employee_id) then
 if not exists(select 1 from public.students where id=new.student_id and active) then raise exception 'Học sinh đã ngừng hoạt động.';end if;
 end if;
 if (tg_op='INSERT' or new.employee_id is distinct from old.employee_id) and not exists(select 1 from public.employees where id=new.employee_id and active) then raise exception 'Nhân sự đã ngừng hoạt động.';end if;
 if new.location_id is not null then
 if tg_op='INSERT' or new.location_id is distinct from old.location_id then
 if not exists(select 1 from public.work_locations where id=new.location_id and active) then raise exception 'Địa điểm đã ngừng sử dụng.';end if;end if;
 if tg_op='INSERT' or new.location_id is distinct from old.location_id then select name,mode into new.location,new.mode from public.work_locations where id=new.location_id;else new.location=old.location;new.mode=old.mode;end if;
 elsif new.work_kind in ('consultation','therapy','consultation_therapy') then raise exception 'Chọn địa điểm.';end if;
 if new.work_kind='leave' and new.status='completed' then raise exception 'Vắng không được tính giờ làm.';end if;
 if new.all_day and (new.work_kind<>'leave' or new.ends_at-new.starts_at<>interval '1 day' or (new.starts_at at time zone 'Asia/Ho_Chi_Minh')::time<>'00:00'::time) then raise exception 'Vắng cả ngày phải từ 00:00 đến 00:00 ngày kế tiếp.';end if;
 if new.work_kind not in ('leave','legacy') and (new.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>(new.ends_at at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Giờ làm phải trong cùng một ngày.';end if;
 return new;end$$;

create or replace function public.employee_create_work(p_records jsonb) returns void language plpgsql security definer set search_path='' as $$declare eid uuid;r jsonb;k text;l public.lessons;batch_series uuid:=gen_random_uuid();begin
 perform pg_advisory_xact_lock(742031);eid=public.current_employee();
 if eid is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 370 then raise exception 'Danh sách giờ làm không hợp lệ.';end if;
 for r in select value from jsonb_array_elements(p_records) loop
 for k in select jsonb_object_keys(r) loop if k not in ('id','version','employee_id','student_id','starts_at','ends_at','mode','location','location_id','meeting_url','content','work_kind','work_group','all_day','auto_recorded','status','actual_minutes','reason','note','series_id','support_employee_ids','primary_pending','report_content','report_status','report_submitted_at','report_submitted_by','teacher_ids','bm','participant_roles') then raise exception 'Trường không hợp lệ.' using errcode='42501';end if;end loop;
 l=jsonb_populate_record(null::public.lessons,r);
 if l.employee_id is distinct from eid or l.version is distinct from 0 or l.work_kind not in ('consultation','therapy','consultation_therapy','meeting','report') or l.work_kind is null or coalesce(l.all_day,false) or coalesce(l.status,'scheduled')<>'scheduled' or coalesce(l.actual_minutes,0)<>0 or coalesce(l.reason,'')<>'' or coalesce(l.note,'')<>'' then raise exception 'Chỉ được tạo giờ làm của chính mình.' using errcode='42501';end if;
 if cardinality(coalesce(l.support_employee_ids,'{}'))>0 or coalesce(l.primary_pending,false) or coalesce(l.report_content,'')<>'' or coalesce(l.report_status,'draft')<>'draft' or l.report_submitted_at is not null or l.report_submitted_by is not null then raise exception 'Chỉ admin quản lý người tham gia và báo cáo được nộp qua thao tác riêng.' using errcode='42501';end if;
 if exists(select 1 from unnest(coalesce(l.teacher_ids,'{}')) x where not public.can_access_teacher(x)) then raise exception 'Không có quyền với giáo viên được chọn.' using errcode='42501';end if;
 if l.work_kind in ('consultation','therapy','consultation_therapy') and cardinality(coalesce(l.teacher_ids,'{}'))=0 and not public.employee_assigned(l.student_id) then raise exception 'Học sinh không được phân công.' using errcode='42501';end if;
 insert into public.lessons(id,employee_id,student_id,starts_at,ends_at,mode,location,location_id,meeting_url,content,work_kind,work_group,auto_recorded,status,actual_minutes,series_id,teacher_ids,bm,participant_roles)
 values(l.id,eid,l.student_id,l.starts_at,l.ends_at,coalesce(l.mode,'offline'),coalesce(nullif(l.location,''),'—'),l.location_id,coalesce(l.meeting_url,''),coalesce(l.content,''),l.work_kind,null,false,'scheduled',0,case when jsonb_array_length(p_records)>1 then batch_series else null end,coalesce(l.teacher_ids,'{}'),coalesce(l.bm,false),coalesce(l.participant_roles,'{}'::jsonb));
 end loop;
end$$;

create or replace function public.employee_calendar_v4(p_start timestamptz,p_end timestamptz) returns table(id uuid,student_id uuid,student_name text,employee_id uuid,employee_name text,color text,starts_at timestamptz,ends_at timestamptz,mode text,status text,actual_minutes integer,work_kind text,location text,all_day boolean,work_group uuid,employee_active boolean,support_employee_ids uuid[],primary_pending boolean,report_status text,teacher_ids uuid[],bm boolean,participant_roles jsonb) language plpgsql stable security definer set search_path='' as $$begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '100 days' then raise exception 'Khoảng lịch không hợp lệ.';end if;
 return query select l.id,l.student_id,coalesce(nullif(s.short_name,''),s.name,''),l.employee_id,e.name,e.color,l.starts_at,l.ends_at,l.mode,public.work_status(l),public.work_minutes(l),l.work_kind,case when l.work_kind='legacy' then '' else l.location end,l.all_day,l.work_group,e.active,l.support_employee_ids,l.primary_pending,l.report_status,l.teacher_ids,l.bm,l.participant_roles
 from public.lessons l left join public.students s on s.id=l.student_id join public.employees e on e.id=l.employee_id where l.starts_at>=p_start and l.starts_at<p_end order by l.starts_at,l.id;
end$$;

create or replace function public.parent_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if public.current_parent() is null then raise exception 'Không có quyền phụ huynh.' using errcode='42501';end if;
 return jsonb_build_object(
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active)) from public.students s where public.parent_linked(s.id)),'[]'),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'student_id',l.student_id,'employee_id',l.employee_id,'starts_at',l.starts_at,'ends_at',l.ends_at,'mode',l.mode,'status',public.work_status(l),'actual_minutes',public.work_minutes(l),'location',l.location,'meeting_url',l.meeting_url,'work_kind',l.work_kind,'support_employee_ids',l.support_employee_ids,'participant_roles',l.participant_roles)) from public.lessons l where public.parent_linked(l.student_id) and l.work_kind in ('legacy','therapy','consultation','consultation_therapy')),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color,'active',e.active)) from public.employees e where exists(select 1 from public.lessons l where (l.employee_id=e.id or e.id=any(l.support_employee_ids)) and public.parent_linked(l.student_id))),'[]')
 );
end$$;

create or replace function public.update_my_work(p_id uuid,p_version integer,p_action text,p_content text default '') returns void language plpgsql security definer set search_path='' as $$
declare l public.lessons;begin
 perform pg_advisory_xact_lock(742031);
 select * into l from public.lessons where id=p_id for update;
 if l.id is null or l.version is distinct from p_version then raise exception 'Dữ liệu đã thay đổi. Tải lại trước khi cập nhật.' using errcode='40001';end if;
 if not public.is_admin() and l.work_kind in ('meeting','consultation_therapy') and cardinality(l.support_employee_ids)>0 then raise exception 'Chỉ admin được cập nhật Họp nhiều người.' using errcode='42501';end if;
 if not public.is_admin() and (public.current_employee() is null or l.employee_id<>public.current_employee() or l.primary_pending) then raise exception 'Chỉ nhân sự chính được cập nhật.' using errcode='42501';end if;
 if p_action='complete' then
 if l.status<>'scheduled' or l.work_kind='leave' or l.primary_pending then raise exception 'Lịch không thể xác nhận hoàn thành.';end if;
 update public.lessons set status='completed',actual_minutes=extract(epoch from(ends_at-starts_at))::integer/60 where id=p_id;
 elsif p_action in ('draft','submit') then
 if l.status='cancelled' or l.work_kind='leave' then raise exception 'Lịch này không cần báo cáo.';end if;
 update public.lessons set report_content=coalesce(p_content,''),report_status=case when p_action='submit' then 'submitted' else 'draft' end where id=p_id;
 else raise exception 'Thao tác không hợp lệ.';end if;
end$$;

create or replace function public.delete_work(p_anchor uuid,p_scope text,p_snapshot jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare anchor public.lessons; actual jsonb; expected jsonb; checked_at timestamptz;begin
 if not public.is_admin() then raise exception 'Chỉ admin được xóa lịch.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(742031);
 if p_scope is null or p_scope not in ('one','future') or jsonb_typeof(p_snapshot) is distinct from 'array' then raise exception 'Phạm vi xóa không hợp lệ.';end if;
 select * into anchor from public.lessons where id=p_anchor for update;
 if anchor.id is null then raise exception 'Dữ liệu đã thay đổi. Vui lòng tải lại.' using errcode='40001';end if;
 if p_scope='future' and anchor.series_id is null then raise exception 'Lịch không thuộc chuỗi lặp.';end if;
 perform 1 from public.lessons l where (p_scope='one' and l.id=anchor.id) or
 (p_scope='future' and l.series_id=anchor.series_id and (anchor.work_kind in ('meeting','consultation_therapy') or l.employee_id=anchor.employee_id) and l.starts_at>=anchor.starts_at) order by l.id for update;
 checked_at=clock_timestamp();
 select jsonb_agg(jsonb_build_object('id',l.id,'version',l.version,'deletable',
  l.status<>'completed' and l.actual_minutes=0) order by l.id)
 into actual from public.lessons l where (p_scope='one' and l.id=anchor.id) or
 (p_scope='future' and l.series_id=anchor.series_id and (anchor.work_kind in ('meeting','consultation_therapy') or l.employee_id=anchor.employee_id) and l.starts_at>=anchor.starts_at);
 select jsonb_agg(value order by (value->>'id')::uuid) into expected from jsonb_array_elements(p_snapshot);
 if actual is distinct from expected then raise exception 'Lịch hoặc giờ đã tính đã thay đổi. Vui lòng tải lại trước khi xóa.' using errcode='40001';end if;
 if not exists(select 1 from jsonb_array_elements(actual) x where (x->>'deletable')::boolean) then raise exception 'Không có lịch đủ điều kiện xóa.';end if;
 delete from public.lessons where id in (select (x->>'id')::uuid from jsonb_array_elements(actual) x where (x->>'deletable')::boolean);
end$$;
drop policy participant_lesson_read on public.lessons;
create policy participant_lesson_read on public.lessons for select to authenticated using(employee_id=public.current_employee() or (work_kind in ('meeting','consultation_therapy') and public.current_employee()=any(support_employee_ids)));
revoke all on function public.employee_calendar_v4(timestamptz,timestamptz) from public,anon;
grant execute on function public.employee_calendar_v4(timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
