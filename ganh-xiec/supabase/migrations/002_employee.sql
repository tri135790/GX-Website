-- Apply AFTER 001, once. No changes to existing data or admin privileges.
begin;
create function public.current_employee() returns uuid language sql stable security definer set search_path='' as $$
 select p.employee_id from public.profiles p join public.employees e on e.id=p.employee_id
 where p.id=auth.uid() and p.role='employee' and p.active and e.active
$$;
create function public.employee_assigned(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.assignments a where a.student_id=s and a.employee_id=public.current_employee())
$$;
revoke all on function public.current_employee(),public.employee_assigned(uuid) from public;
grant execute on function public.current_employee(),public.employee_assigned(uuid) to authenticated;
create policy employee_students on public.students for select to authenticated using(public.employee_assigned(id));
create policy employee_assignments on public.assignments for select to authenticated using(public.employee_assigned(student_id));
create policy employee_lessons on public.lessons for select to authenticated using(public.employee_assigned(student_id));
create policy employee_goals on public.goals for select to authenticated using(public.employee_assigned(student_id));
create policy employee_weekly on public.weekly for select to authenticated using(public.employee_assigned(student_id));

create function public.employee_calendar(p_start timestamptz,p_end timestamptz) returns table(
 id uuid,student_id uuid,student_name text,employee_id uuid,employee_name text,color text,
 starts_at timestamptz,ends_at timestamptz,mode text,status text,actual_minutes integer
) language plpgsql stable security definer set search_path='' as $$begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '100 days' then raise exception 'Khoảng lịch không hợp lệ.';end if;
 return query select l.id,l.student_id,s.name,l.employee_id,e.name,e.color,l.starts_at,l.ends_at,l.mode,l.status,l.actual_minutes
 from public.lessons l join public.students s on s.id=l.student_id join public.employees e on e.id=l.employee_id
 where l.starts_at>=p_start and l.starts_at<p_end order by l.starts_at,l.id;
end$$;

-- Only approved names are projected from otherwise private employee/profile tables.
create function public.employee_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 select jsonb_build_object(
 'students',coalesce((select jsonb_agg(to_jsonb(s)) from public.students s where public.employee_assigned(s.id)),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.assignments a where public.employee_assigned(a.student_id)),'[]'),
 'goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.goals g where public.employee_assigned(g.student_id)),'[]'),
 'weekly',coalesce((select jsonb_agg(to_jsonb(w)) from public.weekly w where public.employee_assigned(w.student_id)),'[]'),
 'lessons',coalesce((select jsonb_agg(to_jsonb(l) order by l.starts_at desc) from public.lessons l where public.employee_assigned(l.student_id)),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color)) from public.employees e where e.id=public.current_employee() or exists(select 1 from public.assignments a where a.employee_id=e.id and public.employee_assigned(a.student_id)) or exists(select 1 from public.lessons l where l.employee_id=e.id and public.employee_assigned(l.student_id))),'[]'),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where exists(select 1 from public.weekly w where w.updated_by=p.id and public.employee_assigned(w.student_id))),'[]')
 ) into result;return result;
end$$;

create function public.employee_save(p_table text,p_record jsonb) returns void language plpgsql security definer set search_path='' as $$
declare eid uuid;sid uuid;rid uuid;expected integer;oldrow jsonb;allowed text[];k text;g jsonb;begin
 -- Same lock as admin: permission changes cannot race employee writes.
 perform pg_advisory_xact_lock(742031);
 eid=public.current_employee();
 if eid is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 allowed=case p_table
 when 'students' then array['id','version','notes']
 when 'goals' then array['id','version','student_id','title','status']
 when 'weekly' then array['id','version','student_id','week_start','progress','challenges','next_steps','goal_snapshot']
 when 'lessons' then array['id','version','content','note'] else null end;
 if allowed is null or jsonb_typeof(p_record) is distinct from 'object' then raise exception 'Loại cập nhật không hợp lệ.' using errcode='42501';end if;
 for k in select jsonb_object_keys(p_record) loop
 if not k=any(allowed) then raise exception 'Không được sửa trường %.',k using errcode='42501';end if;end loop;
 rid=(p_record->>'id')::uuid;expected=(p_record->>'version')::integer;
 if rid is null or expected is null or expected<0 then raise exception 'Thiếu ID hoặc phiên bản.';end if;
 execute format('select to_jsonb(x) from public.%I x where id=$1 for update',p_table) into oldrow using rid;
 sid=case when p_table='students' then rid else coalesce((oldrow->>'student_id')::uuid,(p_record->>'student_id')::uuid) end;
 if not public.employee_assigned(sid) or not exists(select 1 from public.students where id=sid and active) then raise exception 'Học sinh không còn được phân công hoặc đã ngừng hoạt động.' using errcode='42501';end if;
 if oldrow is not null and p_record ? 'student_id' and (p_record->>'student_id')::uuid is distinct from sid then raise exception 'Không được chuyển học sinh.' using errcode='42501';end if;
 if oldrow is not null and (oldrow->>'version')::integer<>expected or oldrow is null and expected<>0 then raise exception 'Dữ liệu đã thay đổi. Tải bản mới để đối chiếu.' using errcode='40001';end if;
 if p_table in ('students','lessons') and oldrow is null then raise exception 'Không được tạo hồ sơ hoặc lịch.' using errcode='42501';end if;
 if p_table='students' then
 update public.students set notes=coalesce(p_record->>'notes',notes) where id=rid;
 elsif p_table='lessons' then
 if (oldrow->>'employee_id')::uuid<>eid then raise exception 'Chỉ được ghi buổi mình dạy.' using errcode='42501';end if;
 update public.lessons set content=coalesce(p_record->>'content',content),note=coalesce(p_record->>'note',note) where id=rid;
 elsif p_table='goals' then
 if oldrow is null then insert into public.goals(id,student_id,title,status) values(rid,sid,p_record->>'title',coalesce(p_record->>'status','new'));
 else update public.goals set title=coalesce(p_record->>'title',title),status=coalesce(p_record->>'status',status) where id=rid;end if;
 elsif p_table='weekly' then
 if oldrow is not null and p_record ? 'week_start' and p_record->>'week_start' is distinct from oldrow->>'week_start' then raise exception 'Không được đổi tuần của bản ghi.';end if;
 if p_record ? 'goal_snapshot' then
 if jsonb_typeof(p_record->'goal_snapshot')<>'array' then raise exception 'Mục tiêu tuần không hợp lệ.';end if;
 for g in select value from jsonb_array_elements(p_record->'goal_snapshot') loop
 if jsonb_typeof(g)<>'object' or not (g ?& array['id','title','status']) or exists(select 1 from jsonb_object_keys(g) x where x not in ('id','title','status')) or length(trim(coalesce(g->>'title','')))=0 or coalesce(g->>'status','') not in ('new','working','achieved','paused') then raise exception 'Mục tiêu tuần không hợp lệ.';end if;
 end loop;end if;
 if oldrow is null then
 if exists(select 1 from public.weekly where student_id=sid and week_start=(p_record->>'week_start')::date) then raise exception 'Tuần này đã có cập nhật. Tải bản mới để đối chiếu.' using errcode='40001';end if;
 insert into public.weekly(id,student_id,week_start,progress,challenges,next_steps,goal_snapshot,updated_by,updated_at) values(rid,sid,(p_record->>'week_start')::date,coalesce(p_record->>'progress',''),coalesce(p_record->>'challenges',''),coalesce(p_record->>'next_steps',''),coalesce(p_record->'goal_snapshot','[]'),auth.uid(),now());
 else update public.weekly set progress=coalesce(p_record->>'progress',progress),challenges=coalesce(p_record->>'challenges',challenges),next_steps=coalesce(p_record->>'next_steps',next_steps),goal_snapshot=coalesce(p_record->'goal_snapshot',goal_snapshot),updated_by=auth.uid(),updated_at=now() where id=rid;end if;
 end if;
end$$;
revoke all on function public.employee_calendar(timestamptz,timestamptz),public.employee_workspace(),public.employee_save(text,jsonb) from public;
grant execute on function public.employee_calendar(timestamptz,timestamptz),public.employee_workspace(),public.employee_save(text,jsonb) to authenticated;
commit;
