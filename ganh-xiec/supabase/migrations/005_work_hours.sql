-- Run once after 004. Preserve old history; old work remains explicitly unclassified.
begin;
create table public.work_locations(id uuid primary key default gen_random_uuid(),version integer not null default 1,name text not null unique check(length(trim(name))>0),mode text not null check(mode in ('offline','online')),active boolean not null default true);
insert into public.work_locations(name,mode) values ('NƯƠNG','offline'),('NEO','offline'),('NÂNG','offline'),('ONL','online');
alter table public.work_locations enable row level security;
revoke all on public.work_locations from anon,authenticated;
grant select on public.work_locations to authenticated;
create policy locations_read on public.work_locations for select to authenticated using(public.is_admin() or public.current_employee() is not null);
create trigger audit after insert or update or delete on public.work_locations for each row execute function public.record_change();
create trigger version before update on public.work_locations for each row execute function public.bump_version();
alter table public.lessons alter column student_id drop not null;
alter table public.lessons add column work_kind text not null default 'legacy' check(work_kind in ('legacy','consultation','therapy','meeting','report','leave')),
 add column location_id uuid references public.work_locations, add column meeting_url text not null default '', add column work_group uuid,
 add column all_day boolean not null default false, add column auto_recorded boolean not null default false;
update public.lessons set status='cancelled',reason=case when trim(reason)='' then 'Học sinh vắng' else 'Học sinh vắng: '||reason end where status='absent';
-- Flush deferred relation checks before subsequent DDL when old absences exist.
set constraints all immediate;
set constraints all deferred;
alter table public.lessons add constraint no_new_absent check(status<>'absent');
alter table public.lessons add constraint work_student check((work_kind in ('legacy','consultation','therapy') and student_id is not null) or (work_kind in ('meeting','report','leave') and student_id is null));
create or replace function public.validate_lesson_assignment() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.student_id is not null and (tg_op='INSERT' or new.student_id is distinct from old.student_id or new.employee_id is distinct from old.employee_id) then
 if not exists(select 1 from public.assignments a join public.employees e on e.id=a.employee_id join public.students s on s.id=a.student_id where a.student_id=new.student_id and a.employee_id=new.employee_id and e.active and s.active) then raise exception 'Nhân sự phải thuộc nhóm phụ trách học sinh đang hoạt động.';end if;
 end if;
 if tg_op='INSERT' and not exists(select 1 from public.employees where id=new.employee_id and active) then raise exception 'Nhân sự đã ngừng hoạt động.';end if;
 if new.location_id is not null then
 if tg_op='INSERT' or new.location_id is distinct from old.location_id then
 if not exists(select 1 from public.work_locations where id=new.location_id and active) then raise exception 'Địa điểm đã ngừng sử dụng.';end if;end if;
 if tg_op='INSERT' or new.location_id is distinct from old.location_id then select name,mode into new.location,new.mode from public.work_locations where id=new.location_id;else new.location=old.location;new.mode=old.mode;end if;
 elsif new.work_kind in ('consultation','therapy') then raise exception 'Chọn địa điểm.';end if;
 if new.work_kind='leave' and new.status='completed' then raise exception 'Vắng không được tính giờ làm.';end if;
 if new.all_day and (new.work_kind<>'leave' or new.ends_at-new.starts_at<>interval '1 day' or (new.starts_at at time zone 'Asia/Ho_Chi_Minh')::time<>'00:00'::time) then raise exception 'Vắng cả ngày phải từ 00:00 đến 00:00 ngày kế tiếp.';end if;
 if new.work_kind not in ('leave','legacy') and (new.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>(new.ends_at at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Giờ làm phải trong cùng một ngày.';end if;
 return new;end$$;
-- Keep old scheduled teaching checks and cover non-student work too.
create or replace function public.validate_relations() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.students s where s.active and not exists(select 1 from public.assignments a join public.employees e on e.id=a.employee_id where a.student_id=s.id and a.responsibility='primary' and e.active)) then raise exception 'Mỗi học sinh đang hoạt động cần một người phụ trách chính đang hoạt động.';end if;
 if exists(select 1 from public.lessons l join public.employees e on e.id=l.employee_id left join public.students s on s.id=l.student_id where l.status='scheduled' and not ((l.auto_recorded or l.work_kind='leave') and l.ends_at<=now()) and (not e.active or (l.student_id is not null and (not s.active or not exists(select 1 from public.assignments a where a.student_id=l.student_id and a.employee_id=l.employee_id))))) then raise exception 'Cần xử lý lịch chưa hoàn thành trước khi ngừng hoạt động hoặc đổi phân công.';end if;
 return null;end$$;
create function public.work_minutes(l public.lessons) returns integer language sql stable set search_path='' as $$
 select case when l.status in ('cancelled','absent') or l.work_kind='leave' then 0 when l.status='completed' then l.actual_minutes when l.auto_recorded and l.ends_at<=now() then (extract(epoch from(l.ends_at-l.starts_at))/60)::integer else 0 end
$$;
create function public.work_status(l public.lessons) returns text language sql stable set search_path='' as $$select case when public.work_minutes(l)>0 then 'completed' else l.status end$$;
create function public.save_work_location(p_record jsonb) returns void language plpgsql security definer set search_path='' as $$declare k text;oldrow public.work_locations;rid uuid;begin
 perform pg_advisory_xact_lock(742031);
 if not public.is_admin() then raise exception 'Chỉ admin quản lý địa điểm.' using errcode='42501';end if;
 for k in select jsonb_object_keys(p_record) loop if k not in ('id','version','name','mode','active') then raise exception 'Trường không hợp lệ.';end if;end loop;
 rid=(p_record->>'id')::uuid;select * into oldrow from public.work_locations where id=rid for update;
 if coalesce(oldrow.version,0) is distinct from (p_record->>'version')::integer then raise exception 'Dữ liệu đã thay đổi.' using errcode='40001';end if;
 if oldrow.id is null then insert into public.work_locations(id,name,mode,active) values(rid,trim(p_record->>'name'),p_record->>'mode',coalesce((p_record->>'active')::boolean,true));
 else update public.work_locations set name=trim(p_record->>'name'),mode=p_record->>'mode',active=(p_record->>'active')::boolean where id=rid;end if;
end$$;
-- New Employee creation only: no arbitrary updates, author or participant impersonation.
create function public.employee_create_work(p_records jsonb) returns void language plpgsql security definer set search_path='' as $$declare eid uuid;r jsonb;k text;l public.lessons;batch_series uuid:=gen_random_uuid();begin
 perform pg_advisory_xact_lock(742031);eid=public.current_employee();
 if eid is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 370 then raise exception 'Danh sách giờ làm không hợp lệ.';end if;
 for r in select value from jsonb_array_elements(p_records) loop
 for k in select jsonb_object_keys(r) loop if k not in ('id','version','employee_id','student_id','starts_at','ends_at','mode','location','location_id','meeting_url','content','work_kind','work_group','all_day','auto_recorded','status','actual_minutes','reason','note','series_id') then raise exception 'Trường không hợp lệ.' using errcode='42501';end if;end loop;
 l=jsonb_populate_record(null::public.lessons,r);
 if l.employee_id is distinct from eid or l.version is distinct from 0 or l.work_kind not in ('consultation','therapy','meeting','report') or l.work_kind is null or coalesce(l.all_day,false) or coalesce(l.status,'scheduled')<>'scheduled' or coalesce(l.actual_minutes,0)<>0 or coalesce(l.reason,'')<>'' or coalesce(l.note,'')<>'' then raise exception 'Chỉ được tạo giờ làm của chính mình.' using errcode='42501';end if;
 if trim(coalesce(l.content,''))='' then raise exception 'Nhập nội dung làm việc.';end if;
 if l.work_kind in ('consultation','therapy') and not public.employee_assigned(l.student_id) then raise exception 'Học sinh không được phân công.' using errcode='42501';end if;
 insert into public.lessons(id,employee_id,student_id,starts_at,ends_at,mode,location,location_id,meeting_url,content,work_kind,work_group,auto_recorded,status,actual_minutes,series_id)
 values(l.id,eid,l.student_id,l.starts_at,l.ends_at,coalesce(l.mode,'offline'),coalesce(nullif(l.location,''),'—'),l.location_id,coalesce(l.meeting_url,''),l.content,l.work_kind,null,true,'scheduled',0,case when jsonb_array_length(p_records)>1 then batch_series else null end);
 end loop;
end$$;
drop function public.employee_calendar(timestamptz,timestamptz);
create function public.employee_calendar(p_start timestamptz,p_end timestamptz) returns table(id uuid,student_id uuid,student_name text,employee_id uuid,employee_name text,color text,starts_at timestamptz,ends_at timestamptz,mode text,status text,actual_minutes integer,work_kind text,location text,all_day boolean,work_group uuid,employee_active boolean) language plpgsql stable security definer set search_path='' as $$begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '100 days' then raise exception 'Khoảng lịch không hợp lệ.';end if;
 return query select l.id,l.student_id,coalesce(s.name,''),l.employee_id,e.name,e.color,l.starts_at,l.ends_at,l.mode,public.work_status(l),public.work_minutes(l),l.work_kind,case when l.work_kind='legacy' then '' else l.location end,l.all_day,l.work_group,e.active
 from public.lessons l left join public.students s on s.id=l.student_id join public.employees e on e.id=l.employee_id where l.starts_at>=p_start and l.starts_at<p_end order by l.starts_at,l.id;
end$$;
create or replace function public.employee_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 select jsonb_build_object(
 'work_locations',coalesce((select jsonb_agg(to_jsonb(x)) from public.work_locations x),'[]'),
 'students',coalesce((select jsonb_agg(to_jsonb(s)) from public.students s where public.employee_assigned(s.id)),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.assignments a where public.employee_assigned(a.student_id)),'[]'),
 'goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.goals g where public.employee_assigned(g.student_id)),'[]'),
 'weekly',coalesce((select jsonb_agg(to_jsonb(w)) from public.weekly w where public.employee_assigned(w.student_id)),'[]'),
 'lessons',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('status',public.work_status(l),'actual_minutes',public.work_minutes(l)) order by l.starts_at desc) from public.lessons l where public.employee_assigned(l.student_id) or (l.student_id is null and l.employee_id=public.current_employee())),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color,'active',e.active)) from public.employees e where e.active or e.id=public.current_employee() or exists(select 1 from public.assignments a where a.employee_id=e.id and public.employee_assigned(a.student_id)) or exists(select 1 from public.lessons l where l.employee_id=e.id and public.employee_assigned(l.student_id))),'[]'),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where exists(select 1 from public.weekly w where w.updated_by=p.id and public.employee_assigned(w.student_id))),'[]')
 ) into result;return result;
end$$;

create or replace function public.parent_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if public.current_parent() is null then raise exception 'Không có quyền phụ huynh.' using errcode='42501';end if;
 return jsonb_build_object(
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active)) from public.students s where public.parent_linked(s.id)),'[]'),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'student_id',l.student_id,'employee_id',l.employee_id,'starts_at',l.starts_at,'ends_at',l.ends_at,'mode',l.mode,'status',public.work_status(l),'actual_minutes',public.work_minutes(l),'location',l.location,'meeting_url',l.meeting_url,'work_kind',l.work_kind)) from public.lessons l where public.parent_linked(l.student_id) and l.work_kind in ('legacy','therapy','consultation')),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color,'active',e.active)) from public.employees e where exists(select 1 from public.lessons l where l.employee_id=e.id and public.parent_linked(l.student_id))),'[]')
 );
end$$;
revoke all on function public.work_minutes(public.lessons),public.work_status(public.lessons),public.save_work_location(jsonb),public.employee_create_work(jsonb),public.employee_calendar(timestamptz,timestamptz) from public;
grant execute on function public.save_work_location(jsonb),public.employee_create_work(jsonb),public.employee_calendar(timestamptz,timestamptz) to authenticated;
commit;
