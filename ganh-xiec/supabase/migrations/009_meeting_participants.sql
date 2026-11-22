-- Apply after 008, before the matching frontend. No historical participants are restored.
begin;
select pg_advisory_xact_lock(742031);
alter table public.lessons drop constraint single_incharge_only;
alter table public.lessons add constraint meeting_participants_only check(work_kind='meeting' or cardinality(support_employee_ids)=0);
create or replace function public.validate_work_metadata() returns trigger language plpgsql security definer set search_path='' as $$declare clash public.lessons;who text;begin
 new.auto_recorded=false;

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
 elsif new.work_kind in ('consultation','therapy') then raise exception 'Chọn địa điểm.';end if;
 if new.work_kind='leave' and new.status='completed' then raise exception 'Vắng không được tính giờ làm.';end if;
 if new.all_day and (new.work_kind<>'leave' or new.ends_at-new.starts_at<>interval '1 day' or (new.starts_at at time zone 'Asia/Ho_Chi_Minh')::time<>'00:00'::time) then raise exception 'Vắng cả ngày phải từ 00:00 đến 00:00 ngày kế tiếp.';end if;
 if new.work_kind not in ('leave','legacy') and (new.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>(new.ends_at at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Giờ làm phải trong cùng một ngày.';end if;
 return new;end$$;

create or replace function public.employee_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 select jsonb_build_object(
 'teachers',coalesce((select jsonb_agg(to_jsonb(t)) from public.teachers t where public.can_access_teacher(t.id)),'[]'),
 'teacher_goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.teacher_goals g where public.can_access_teacher(g.teacher_id)),'[]'),
 'teacher_weekly',coalesce((select jsonb_agg(to_jsonb(w)) from public.teacher_weekly w where public.can_access_teacher(w.teacher_id)),'[]'),
 'work_locations',coalesce((select jsonb_agg(to_jsonb(x)) from public.work_locations x),'[]'),
 'students',coalesce((select jsonb_agg(to_jsonb(s)) from public.students s where public.employee_assigned(s.id)),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.assignments a where public.employee_assigned(a.student_id)),'[]'),
 'goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.goals g where public.employee_assigned(g.student_id)),'[]'),
 'weekly',coalesce((select jsonb_agg(to_jsonb(w)) from public.weekly w where public.employee_assigned(w.student_id)),'[]'),
 'lessons',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('status',public.work_status(l),'actual_minutes',public.work_minutes(l)) order by l.starts_at desc) from public.lessons l where public.employee_assigned(l.student_id) or l.employee_id=public.current_employee() or public.current_employee()=any(l.support_employee_ids) or exists(select 1 from public.teachers t where t.id=any(l.teacher_ids) and public.can_access_teacher(t.id))),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color,'active',e.active)) from public.employees e where e.active or exists(select 1 from public.lessons l where e.id=any(l.support_employee_ids)) or e.id=public.current_employee() or exists(select 1 from public.assignments a where a.employee_id=e.id and public.employee_assigned(a.student_id)) or exists(select 1 from public.lessons l where l.employee_id=e.id and public.employee_assigned(l.student_id))),'[]'),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where exists(select 1 from public.weekly w where w.updated_by=p.id and public.employee_assigned(w.student_id))),'[]')
 ) into result;return result;
end$$;

create or replace function public.update_my_work(p_id uuid,p_version integer,p_action text,p_content text default '') returns void language plpgsql security definer set search_path='' as $$
declare l public.lessons;begin
 perform pg_advisory_xact_lock(742031);
 select * into l from public.lessons where id=p_id for update;
 if l.id is null or l.version is distinct from p_version then raise exception 'Dữ liệu đã thay đổi. Tải lại trước khi cập nhật.' using errcode='40001';end if;
 if not public.is_admin() and l.work_kind='meeting' and cardinality(l.support_employee_ids)>0 then raise exception 'Chỉ admin được cập nhật Họp nhiều người.' using errcode='42501';end if;
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
 (p_scope='future' and l.series_id=anchor.series_id and (anchor.work_kind='meeting' or l.employee_id=anchor.employee_id) and l.starts_at>=anchor.starts_at) order by l.id for update;
 checked_at=clock_timestamp();
 select jsonb_agg(jsonb_build_object('id',l.id,'version',l.version,'deletable',
  l.status<>'completed' and l.actual_minutes=0) order by l.id)
 into actual from public.lessons l where (p_scope='one' and l.id=anchor.id) or
 (p_scope='future' and l.series_id=anchor.series_id and (anchor.work_kind='meeting' or l.employee_id=anchor.employee_id) and l.starts_at>=anchor.starts_at);
 select jsonb_agg(value order by (value->>'id')::uuid) into expected from jsonb_array_elements(p_snapshot);
 if actual is distinct from expected then raise exception 'Lịch hoặc giờ đã tính đã thay đổi. Vui lòng tải lại trước khi xóa.' using errcode='40001';end if;
 if not exists(select 1 from jsonb_array_elements(actual) x where (x->>'deletable')::boolean) then raise exception 'Không có lịch đủ điều kiện xóa.';end if;
 delete from public.lessons where id in (select (x->>'id')::uuid from jsonb_array_elements(actual) x where (x->>'deletable')::boolean);
end$$;
create policy participant_lesson_read on public.lessons for select to authenticated
 using (employee_id=public.current_employee() or (work_kind='meeting' and public.current_employee()=any(support_employee_ids)));
notify pgrst, 'reload schema';
commit;
