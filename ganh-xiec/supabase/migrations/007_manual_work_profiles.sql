-- Apply after 006. Run the family repair first if 004/006 are missing.
begin;
select pg_advisory_xact_lock(742031);
do $$begin
 if to_regprocedure('public.delete_work(uuid,text,jsonb)') is null then raise exception 'Áp dụng 006 hoặc repair_family_and_work.sql trước 007.';end if;
end$$;
alter table public.students
 add column father_name text not null default '', add column mother_name text not null default '',
 add column contact_phone text not null default '', add column contact_email text not null default '',
 add column address text not null default '', add column diagnosis text not null default '',
 add column short_name text not null default '', add column service_modes text[] not null default array['offline'];
alter table public.students add constraint valid_service_modes check(cardinality(service_modes)>0 and service_modes <@ array['online','offline'] and array_position(service_modes,null) is null);
update public.students s set service_modes=coalesce((select array_agg(distinct l.mode) from public.lessons l where l.student_id=s.id),array['offline']);
-- Drain deferred relation checks before later schema changes in this transaction.
set constraints all immediate;
set constraints all deferred;
alter table public.employees add column address text not null default '',add column "current_role" text not null default '',add column notes text not null default '';
alter table public.lessons
 add column support_employee_ids uuid[] not null default '{}', add column primary_pending boolean not null default false,
 add column report_content text not null default '',add column report_status text not null default 'draft' check(report_status in ('draft','submitted')),
 add column report_submitted_at timestamptz,add column report_submitted_by uuid references public.profiles;
alter table public.lessons alter column auto_recorded set default false;
update public.lessons set auto_recorded=false where auto_recorded;
-- Archive original group records before merging; retain their original contents and IDs.
create table public.legacy_work_archive(id uuid primary key,canonical_id uuid not null,record jsonb not null,archived_at timestamptz not null default now());
alter table public.legacy_work_archive enable row level security;
revoke all on public.legacy_work_archive from anon,authenticated;
grant select on public.legacy_work_archive to authenticated;
create policy archive_admin on public.legacy_work_archive for select to authenticated using(public.is_admin());
do $$declare g record;canonical uuid;participants uuid[];begin
 for g in select work_group,starts_at,ends_at,work_kind,mode,location,location_id,meeting_url,content,note,status,actual_minutes,reason,all_day,series_id,array_agg(id order by id) ids
 from public.lessons where work_group is not null and work_kind in ('meeting','leave')
 group by work_group,starts_at,ends_at,work_kind,mode,location,location_id,meeting_url,content,note,status,actual_minutes,reason,all_day,series_id having count(*)>1 loop
 canonical=g.ids[1];
 select array_agg(distinct employee_id) into participants from public.lessons where id=any(g.ids);
 insert into public.legacy_work_archive(id,canonical_id,record) select id,canonical,to_jsonb(l) from public.lessons l where id=any(g.ids);
 delete from public.lessons where id=any(g.ids) and id<>canonical;
 update public.lessons set support_employee_ids=array_remove(participants,employee_id),primary_pending=true where id=canonical;
 end loop;
end$$;
-- Pending legacy groups have no confirmed primary and do not reserve that person's time.
set constraints all immediate;
set constraints all deferred;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.lessons'::regclass and contype='x' and pg_get_constraintdef(oid) like '%employee_id%' loop
 execute format('alter table public.lessons drop constraint %I',c.conname);
 end loop;
end$$;
alter table public.lessons add constraint lessons_primary_time_excl exclude using gist(employee_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelled' and not primary_pending);
create table public.lesson_participants(lesson_id uuid not null references public.lessons on delete cascade,employee_id uuid not null references public.employees,role text not null check(role in ('primary','support')),primary key(lesson_id,employee_id));
create unique index one_primary_per_lesson on public.lesson_participants(lesson_id) where role='primary';
alter table public.lesson_participants enable row level security;
revoke all on public.lesson_participants from anon,authenticated;
grant select on public.lesson_participants to authenticated;
create policy participant_read on public.lesson_participants for select to authenticated using(public.is_admin() or employee_id=public.current_employee());
insert into public.lesson_participants select id,employee_id,case when primary_pending then 'support' else 'primary' end from public.lessons;
insert into public.lesson_participants select id,unnest(support_employee_ids),'support' from public.lessons;
-- Flush participant foreign-key checks before installing triggers on lessons.
set constraints all immediate;
set constraints all deferred;
create function public.sync_lesson_participants() returns trigger language plpgsql security definer set search_path='' as $$begin
 delete from public.lesson_participants where lesson_id=new.id;
 insert into public.lesson_participants values(new.id,new.employee_id,case when new.primary_pending then 'support' else 'primary' end);
 insert into public.lesson_participants select new.id,unnest(new.support_employee_ids),'support';
 return new;
end$$;
create trigger participants after insert or update on public.lessons for each row execute function public.sync_lesson_participants();
create function public.validate_work_metadata() returns trigger language plpgsql security definer set search_path='' as $$declare clash public.lessons;who text;begin
 new.auto_recorded=false;
 if new.status<>'cancelled' then
 select * into clash from public.lessons l where l.id<>new.id and l.status<>'cancelled'
 and ((not new.primary_pending and not l.primary_pending and l.employee_id=new.employee_id) or (new.student_id is not null and l.student_id=new.student_id))
 and tstzrange(l.starts_at,l.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)') limit 1;
 if clash.id is not null then
 select name into who from public.employees where id=clash.employee_id;
 raise exception 'Trùng lịch % vào % – %.',who,to_char(clash.starts_at at time zone 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI'),to_char(clash.ends_at at time zone 'Asia/Ho_Chi_Minh','HH24:MI');
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
create trigger work_metadata before insert or update on public.lessons for each row execute function public.validate_work_metadata();
create or replace function public.work_minutes(l public.lessons) returns integer language sql stable set search_path='' as $$
 select case when not l.primary_pending and l.status='completed' and l.work_kind<>'leave' then l.actual_minutes else 0 end
$$;
create or replace function public.work_status(l public.lessons) returns text language sql stable set search_path='' as $$select l.status$$;
create or replace function public.validate_relations() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.students s where s.active and not exists(select 1 from public.assignments a join public.employees e on e.id=a.employee_id where a.student_id=s.id and a.responsibility='primary' and e.active)) then raise exception 'Mỗi học sinh đang hoạt động cần một người phụ trách chính đang hoạt động.';end if;
 if exists(select 1 from public.lessons l join public.employees e on e.id=l.employee_id left join public.students s on s.id=l.student_id where l.status='scheduled' and (not e.active or (l.student_id is not null and (not s.active or not exists(select 1 from public.assignments a where a.student_id=l.student_id and a.employee_id=l.employee_id))))) then raise exception 'Cần xử lý lịch chưa hoàn thành trước khi ngừng hoạt động hoặc đổi phân công.';end if;
 return null;end$$;
create or replace function public.employee_create_work(p_records jsonb) returns void language plpgsql security definer set search_path='' as $$declare eid uuid;r jsonb;k text;l public.lessons;batch_series uuid:=gen_random_uuid();begin
 perform pg_advisory_xact_lock(742031);eid=public.current_employee();
 if eid is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 370 then raise exception 'Danh sách giờ làm không hợp lệ.';end if;
 for r in select value from jsonb_array_elements(p_records) loop
 for k in select jsonb_object_keys(r) loop if k not in ('id','version','employee_id','student_id','starts_at','ends_at','mode','location','location_id','meeting_url','content','work_kind','work_group','all_day','auto_recorded','status','actual_minutes','reason','note','series_id','support_employee_ids','primary_pending','report_content','report_status','report_submitted_at','report_submitted_by') then raise exception 'Trường không hợp lệ.' using errcode='42501';end if;end loop;
 l=jsonb_populate_record(null::public.lessons,r);
 if l.employee_id is distinct from eid or l.version is distinct from 0 or l.work_kind not in ('consultation','therapy','meeting','report') or l.work_kind is null or coalesce(l.all_day,false) or coalesce(l.status,'scheduled')<>'scheduled' or coalesce(l.actual_minutes,0)<>0 or coalesce(l.reason,'')<>'' or coalesce(l.note,'')<>'' then raise exception 'Chỉ được tạo giờ làm của chính mình.' using errcode='42501';end if;
 if cardinality(coalesce(l.support_employee_ids,'{}'))>0 or coalesce(l.primary_pending,false) or coalesce(l.report_content,'')<>'' or coalesce(l.report_status,'draft')<>'draft' or l.report_submitted_at is not null or l.report_submitted_by is not null then raise exception 'Chỉ admin quản lý người tham gia và báo cáo được nộp qua thao tác riêng.' using errcode='42501';end if;
 if l.work_kind in ('consultation','therapy') and not public.employee_assigned(l.student_id) then raise exception 'Học sinh không được phân công.' using errcode='42501';end if;
 insert into public.lessons(id,employee_id,student_id,starts_at,ends_at,mode,location,location_id,meeting_url,content,work_kind,work_group,auto_recorded,status,actual_minutes,series_id)
 values(l.id,eid,l.student_id,l.starts_at,l.ends_at,coalesce(l.mode,'offline'),coalesce(nullif(l.location,''),'—'),l.location_id,coalesce(l.meeting_url,''),coalesce(l.content,''),l.work_kind,null,false,'scheduled',0,case when jsonb_array_length(p_records)>1 then batch_series else null end);
 end loop;
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
 (p_scope='future' and l.series_id=anchor.series_id and l.employee_id=anchor.employee_id and l.starts_at>=anchor.starts_at) order by l.id for update;
 checked_at=clock_timestamp();
 select jsonb_agg(jsonb_build_object('id',l.id,'version',l.version,'deletable',
  l.status<>'completed' and l.actual_minutes=0) order by l.id)
 into actual from public.lessons l where (p_scope='one' and l.id=anchor.id) or
 (p_scope='future' and l.series_id=anchor.series_id and l.employee_id=anchor.employee_id and l.starts_at>=anchor.starts_at);
 select jsonb_agg(value order by (value->>'id')::uuid) into expected from jsonb_array_elements(p_snapshot);
 if actual is distinct from expected then raise exception 'Lịch hoặc giờ đã tính đã thay đổi. Vui lòng tải lại trước khi xóa.' using errcode='40001';end if;
 if not exists(select 1 from jsonb_array_elements(actual) x where (x->>'deletable')::boolean) then raise exception 'Không có lịch đủ điều kiện xóa.';end if;
 delete from public.lessons where id in (select (x->>'id')::uuid from jsonb_array_elements(actual) x where (x->>'deletable')::boolean);
end$$;
create or replace function public.employee_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 select jsonb_build_object(
 'work_locations',coalesce((select jsonb_agg(to_jsonb(x)) from public.work_locations x),'[]'),
 'students',coalesce((select jsonb_agg(to_jsonb(s)) from public.students s where public.employee_assigned(s.id)),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.assignments a where public.employee_assigned(a.student_id)),'[]'),
 'goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.goals g where public.employee_assigned(g.student_id)),'[]'),
 'weekly',coalesce((select jsonb_agg(to_jsonb(w)) from public.weekly w where public.employee_assigned(w.student_id)),'[]'),
 'lessons',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('status',public.work_status(l),'actual_minutes',public.work_minutes(l)) order by l.starts_at desc) from public.lessons l where public.employee_assigned(l.student_id) or l.employee_id=public.current_employee() or public.current_employee()=any(l.support_employee_ids)),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color,'active',e.active)) from public.employees e where e.active or exists(select 1 from public.lessons l where e.id=any(l.support_employee_ids)) or e.id=public.current_employee() or exists(select 1 from public.assignments a where a.employee_id=e.id and public.employee_assigned(a.student_id)) or exists(select 1 from public.lessons l where l.employee_id=e.id and public.employee_assigned(l.student_id))),'[]'),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where exists(select 1 from public.weekly w where w.updated_by=p.id and public.employee_assigned(w.student_id))),'[]')
 ) into result;return result;
end$$;
create or replace function public.employee_calendar_v2(p_start timestamptz,p_end timestamptz) returns table(id uuid,student_id uuid,student_name text,employee_id uuid,employee_name text,color text,starts_at timestamptz,ends_at timestamptz,mode text,status text,actual_minutes integer,work_kind text,location text,all_day boolean,work_group uuid,employee_active boolean,support_employee_ids uuid[],primary_pending boolean,report_status text) language plpgsql stable security definer set search_path='' as $$begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '100 days' then raise exception 'Khoảng lịch không hợp lệ.';end if;
 return query select l.id,l.student_id,coalesce(nullif(s.short_name,''),s.name,''),l.employee_id,e.name,e.color,l.starts_at,l.ends_at,l.mode,public.work_status(l),public.work_minutes(l),l.work_kind,case when l.work_kind='legacy' then '' else l.location end,l.all_day,l.work_group,e.active,l.support_employee_ids,l.primary_pending,l.report_status
 from public.lessons l left join public.students s on s.id=l.student_id join public.employees e on e.id=l.employee_id where l.starts_at>=p_start and l.starts_at<p_end order by l.starts_at,l.id;
end$$;

-- Complete and report independently, with optimistic concurrency and server-side ownership.
create function public.update_my_work(p_id uuid,p_version integer,p_action text,p_content text default '') returns void language plpgsql security definer set search_path='' as $$
declare l public.lessons;begin
 perform pg_advisory_xact_lock(742031);
 select * into l from public.lessons where id=p_id for update;
 if l.id is null or l.version is distinct from p_version then raise exception 'Dữ liệu đã thay đổi. Tải lại trước khi cập nhật.' using errcode='40001';end if;
 if not public.is_admin() and (public.current_employee() is null or l.employee_id<>public.current_employee() or l.primary_pending) then raise exception 'Chỉ nhân sự chính được cập nhật.' using errcode='42501';end if;
 if p_action='complete' then
 if l.status<>'scheduled' or l.work_kind='leave' or l.primary_pending then raise exception 'Lịch không thể xác nhận hoàn thành.';end if;
 update public.lessons set status='completed',actual_minutes=extract(epoch from(ends_at-starts_at))::integer/60 where id=p_id;
 elsif p_action in ('draft','submit') then
 if l.status='cancelled' or l.work_kind='leave' then raise exception 'Lịch này không cần báo cáo.';end if;
 update public.lessons set report_content=coalesce(p_content,''),report_status=case when p_action='submit' then 'submitted' else 'draft' end where id=p_id;
 else raise exception 'Thao tác không hợp lệ.';end if;
end$$;
create function public.archive_employee_access() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.active and not new.active then
 if exists(select 1 from public.lessons l where l.status='scheduled' and (l.employee_id=new.id or new.id=any(l.support_employee_ids))) then raise exception 'Chuyển hoặc hủy các lịch chưa hoàn thành trước khi ẩn nhân sự.';end if;
 update public.profiles set active=false where employee_id=new.id and active;
 update public.invitations set status='revoked' where employee_id=new.id and status='pending';
 end if;return new;
end$$;
create trigger archive_access after update on public.employees for each row execute function public.archive_employee_access();
revoke all on function public.sync_lesson_participants(),public.validate_work_metadata(),public.archive_employee_access(),public.update_my_work(uuid,integer,text,text),public.employee_calendar_v2(timestamptz,timestamptz) from public,anon;
grant execute on function public.update_my_work(uuid,integer,text,text),public.employee_calendar_v2(timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
