-- Recovery for missing/partially applied 004, followed by 006, in one transaction.
-- Requires the base app, Employee (002) and Work Hours (005) schema.
-- Existing family data is retained; existing parent_workspace is not overwritten.
begin;
do $$begin
 if to_regprocedure('public.employee_assigned(uuid)') is null or to_regprocedure('public.current_employee()') is null then
  raise exception 'Thiếu chức năng Nhân sự (002). Dừng để kiểm tra database trước khi cập nhật.';
 end if;
 if to_regprocedure('public.work_minutes(public.lessons)') is null then
  raise exception 'Thiếu chức năng giờ làm (005). Dừng để kiểm tra database trước khi cập nhật.';
 end if;
end$$;
create or replace function public.current_parent() returns uuid language sql stable security definer set search_path='' as $$
 select p.parent_id from public.profiles p join public.parents f on f.id=p.parent_id
 where p.id=auth.uid() and p.role='parents' and p.active and f.active
$$;
create or replace function public.parent_linked(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.families f where f.student_id=s and f.parent_id=public.current_parent())
$$;
create table if not exists public.family_updates(
 id uuid primary key default gen_random_uuid(), version integer not null default 1,
 student_id uuid not null references public.students, author_id uuid not null references public.profiles,
 week_start date not null check(extract(isodow from week_start)=1),
 progress text not null default '', challenges text not null default '', practice text not null default '', questions text not null default '',
 updated_at timestamptz not null default now(), unique(student_id,author_id,week_start)
);
create table if not exists public.family_reports(
 id uuid primary key default gen_random_uuid(), version integer not null default 1,
 student_id uuid not null references public.students, week_start date not null check(extract(isodow from week_start)=1),
 goals text not null default '', progress text not null default '', guidance text not null default '',
 published boolean not null default false, updated_by uuid not null references public.profiles,
 updated_at timestamptz not null default now(), unique(student_id,week_start)
);
do $$declare t text;begin foreach t in array array['family_updates','family_reports'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('drop trigger if exists audit on public.%I',t);
 execute format('drop trigger if exists version on public.%I',t);
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.record_change()',t);
 execute format('create trigger version before update on public.%I for each row execute function public.bump_version()',t);
end loop;end$$;
drop policy if exists family_update_read on public.family_updates;
create policy family_update_read on public.family_updates for select to authenticated using(public.is_admin() or public.employee_assigned(student_id) or public.parent_linked(student_id));
drop policy if exists family_report_read on public.family_reports;
create policy family_report_read on public.family_reports for select to authenticated using(public.is_admin() or public.employee_assigned(student_id) or (published and public.parent_linked(student_id)));

do $repair$ begin
 if to_regprocedure('public.parent_workspace()') is null then
 execute $definition$create function public.parent_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if public.current_parent() is null then raise exception 'Không có quyền phụ huynh.' using errcode='42501';end if;
 return jsonb_build_object(
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active)) from public.students s where public.parent_linked(s.id)),'[]'),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'student_id',l.student_id,'employee_id',l.employee_id,'starts_at',l.starts_at,'ends_at',l.ends_at,'mode',l.mode,'status',public.work_status(l),'actual_minutes',public.work_minutes(l),'location',l.location,'meeting_url',l.meeting_url,'work_kind',l.work_kind)) from public.lessons l where public.parent_linked(l.student_id) and l.work_kind in ('legacy','therapy','consultation')),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color,'active',e.active)) from public.employees e where exists(select 1 from public.lessons l where l.employee_id=e.id and public.parent_linked(l.student_id))),'[]')
 );
end$$;$definition$;
 end if;
end $repair$;
create or replace function public.family_weekly(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare staff boolean;begin
 staff=public.is_admin() or public.employee_assigned(p_student);
 if not staff and not public.parent_linked(p_student) then raise exception 'Không còn quyền xem học sinh.' using errcode='42501';end if;
 return jsonb_build_object(
 'reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.family_reports r where r.student_id=p_student and (staff or r.published)),'[]'),
 'updates',coalesce((select jsonb_agg(to_jsonb(u)) from public.family_updates u where u.student_id=p_student),'[]'),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where exists(select 1 from public.family_updates u where u.student_id=p_student and u.author_id=p.id) or exists(select 1 from public.family_reports r where r.student_id=p_student and r.updated_by=p.id and (staff or r.published))),'[]'),
 'active',coalesce((select active from public.students where id=p_student),false)
 );
end$$;
create or replace function public.save_family_weekly(p_kind text,p_record jsonb) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;wk date;expected integer;oldrow jsonb;allowed text[];k text;staff boolean;begin
 perform pg_advisory_xact_lock(742031);
 allowed=case p_kind when 'update' then array['student_id','week_start','version','progress','challenges','practice','questions'] when 'report' then array['student_id','week_start','version','goals','progress','guidance','published'] end;
 if allowed is null or jsonb_typeof(p_record) is distinct from 'object' then raise exception 'Loại cập nhật không hợp lệ.' using errcode='42501';end if;
 for k in select jsonb_object_keys(p_record) loop
 if not k=any(allowed) then raise exception 'Không được sửa trường %.',k using errcode='42501';end if;end loop;
 sid=(p_record->>'student_id')::uuid;wk=(p_record->>'week_start')::date;expected=(p_record->>'version')::integer;
 if sid is null or wk is null or expected is null or expected<0 then raise exception 'Thiếu học sinh, tuần hoặc phiên bản.';end if;
 staff=public.is_admin() or public.employee_assigned(sid);
 if (p_kind='update' and not public.parent_linked(sid)) or (p_kind='report' and not staff) then raise exception 'Không còn quyền cập nhật học sinh.' using errcode='42501';end if;
 if not exists(select 1 from public.students where id=sid and active) then raise exception 'Học sinh đã ngừng hoạt động.' using errcode='42501';end if;
 if p_kind='update' then select to_jsonb(u) into oldrow from public.family_updates u where student_id=sid and week_start=wk and author_id=auth.uid() for update;
 else select to_jsonb(r) into oldrow from public.family_reports r where student_id=sid and week_start=wk for update;end if;
 if coalesce((oldrow->>'version')::integer,0)<>expected then raise exception 'Dữ liệu đã thay đổi. Tải bản mới để đối chiếu.' using errcode='40001';end if;
 if p_kind='update' then
 if oldrow is null then insert into public.family_updates(student_id,author_id,week_start,progress,challenges,practice,questions) values(sid,auth.uid(),wk,coalesce(p_record->>'progress',''),coalesce(p_record->>'challenges',''),coalesce(p_record->>'practice',''),coalesce(p_record->>'questions',''));
 else update public.family_updates set progress=coalesce(p_record->>'progress',progress),challenges=coalesce(p_record->>'challenges',challenges),practice=coalesce(p_record->>'practice',practice),questions=coalesce(p_record->>'questions',questions),updated_at=now() where id=(oldrow->>'id')::uuid;end if;
 else
 if oldrow is null then insert into public.family_reports(student_id,week_start,goals,progress,guidance,published,updated_by) values(sid,wk,coalesce(p_record->>'goals',''),coalesce(p_record->>'progress',''),coalesce(p_record->>'guidance',''),coalesce((p_record->>'published')::boolean,false),auth.uid());
 else update public.family_reports set goals=coalesce(p_record->>'goals',goals),progress=coalesce(p_record->>'progress',progress),guidance=coalesce(p_record->>'guidance',guidance),published=coalesce((p_record->>'published')::boolean,published),updated_by=auth.uid(),updated_at=now() where id=(oldrow->>'id')::uuid;end if;
 end if;
end$$;
revoke all on function public.current_parent(),public.parent_linked(uuid),public.parent_workspace(),public.family_weekly(uuid),public.save_family_weekly(text,jsonb) from public;
grant execute on function public.current_parent(),public.parent_linked(uuid),public.parent_workspace(),public.family_weekly(uuid),public.save_family_weekly(text,jsonb) to authenticated;

do $$begin
 if to_regclass('public.family_reports') is null or to_regclass('public.family_updates') is null or to_regprocedure('public.parent_linked(uuid)') is null then
  raise exception 'Thiếu cập nhật Phụ huynh. Áp dụng migration 004 và các phụ thuộc trước 006.';
 end if;
 if to_regprocedure('public.work_minutes(public.lessons)') is null then
  raise exception 'Thiếu cập nhật giờ làm. Áp dụng migration 005 trước 006.';
 end if;
end$$;
create or replace function public.employee_create_work(p_records jsonb) returns void language plpgsql security definer set search_path='' as $$declare eid uuid;r jsonb;k text;l public.lessons;batch_series uuid:=gen_random_uuid();begin
 perform pg_advisory_xact_lock(742031);eid=public.current_employee();
 if eid is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 370 then raise exception 'Danh sách giờ làm không hợp lệ.';end if;
 for r in select value from jsonb_array_elements(p_records) loop
 for k in select jsonb_object_keys(r) loop if k not in ('id','version','employee_id','student_id','starts_at','ends_at','mode','location','location_id','meeting_url','content','work_kind','work_group','all_day','auto_recorded','status','actual_minutes','reason','note','series_id') then raise exception 'Trường không hợp lệ.' using errcode='42501';end if;end loop;
 l=jsonb_populate_record(null::public.lessons,r);
 if l.employee_id is distinct from eid or l.version is distinct from 0 or l.work_kind not in ('consultation','therapy','meeting','report') or l.work_kind is null or coalesce(l.all_day,false) or coalesce(l.status,'scheduled')<>'scheduled' or coalesce(l.actual_minutes,0)<>0 or coalesce(l.reason,'')<>'' or coalesce(l.note,'')<>'' then raise exception 'Chỉ được tạo giờ làm của chính mình.' using errcode='42501';end if;
 if l.work_kind in ('consultation','therapy') and not public.employee_assigned(l.student_id) then raise exception 'Học sinh không được phân công.' using errcode='42501';end if;
 insert into public.lessons(id,employee_id,student_id,starts_at,ends_at,mode,location,location_id,meeting_url,content,work_kind,work_group,auto_recorded,status,actual_minutes,series_id)
 values(l.id,eid,l.student_id,l.starts_at,l.ends_at,coalesce(l.mode,'offline'),coalesce(nullif(l.location,''),'—'),l.location_id,coalesce(l.meeting_url,''),coalesce(l.content,''),l.work_kind,null,true,'scheduled',0,case when jsonb_array_length(p_records)>1 then batch_series else null end);
 end loop;
end$$;
create or replace function public.family_weekly(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare staff boolean;begin
 staff=public.is_admin() or public.employee_assigned(p_student);
 if not staff and not public.parent_linked(p_student) then raise exception 'Không còn quyền xem học sinh.' using errcode='42501';end if;
 return jsonb_build_object(
 'reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.family_reports r where r.student_id=p_student and (staff or r.published)),'[]'),
 'updates',coalesce((select jsonb_agg(to_jsonb(u)) from public.family_updates u where u.student_id=p_student),'[]'),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where exists(select 1 from public.family_updates u where u.student_id=p_student and u.author_id=p.id) or exists(select 1 from public.family_reports r where r.student_id=p_student and r.updated_by=p.id and (staff or r.published))),'[]'),
 'active',coalesce((select active from public.students where id=p_student),false)
 );
end$$;

-- Compare every scoped row with the preview, including protected rows, before deletion.
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
  l.status<>'completed' and l.actual_minutes=0 and not (l.status='scheduled' and l.auto_recorded and l.work_kind<>'leave' and l.ends_at<=checked_at)) order by l.id)
 into actual from public.lessons l where (p_scope='one' and l.id=anchor.id) or
 (p_scope='future' and l.series_id=anchor.series_id and l.employee_id=anchor.employee_id and l.starts_at>=anchor.starts_at);
 select jsonb_agg(value order by (value->>'id')::uuid) into expected from jsonb_array_elements(p_snapshot);
 if actual is distinct from expected then raise exception 'Lịch hoặc giờ đã tính đã thay đổi. Vui lòng tải lại trước khi xóa.' using errcode='40001';end if;
 if not exists(select 1 from jsonb_array_elements(actual) x where (x->>'deletable')::boolean) then raise exception 'Không có lịch đủ điều kiện xóa.';end if;
 delete from public.lessons where id in (select (x->>'id')::uuid from jsonb_array_elements(actual) x where (x->>'deletable')::boolean);
end$$;
revoke all on function public.delete_work(uuid,text,jsonb),public.employee_create_work(jsonb),public.family_weekly(uuid) from public,anon;
grant execute on function public.delete_work(uuid,text,jsonb),public.employee_create_work(jsonb),public.family_weekly(uuid) to authenticated;
notify pgrst, 'reload schema';

commit;
