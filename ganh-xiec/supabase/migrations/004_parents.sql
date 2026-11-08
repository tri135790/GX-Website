-- Apply once after 001, 002 and 003. Existing internal notes remain private.
begin;
create function public.current_parent() returns uuid language sql stable security definer set search_path='' as $$
 select p.parent_id from public.profiles p join public.parents f on f.id=p.parent_id
 where p.id=auth.uid() and p.role='parents' and p.active and f.active
$$;
create function public.parent_linked(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.families f where f.student_id=s and f.parent_id=public.current_parent())
$$;
create table public.family_updates(
 id uuid primary key default gen_random_uuid(), version integer not null default 1,
 student_id uuid not null references public.students, author_id uuid not null references public.profiles,
 week_start date not null check(extract(isodow from week_start)=1),
 progress text not null default '', challenges text not null default '', practice text not null default '', questions text not null default '',
 updated_at timestamptz not null default now(), unique(student_id,author_id,week_start)
);
create table public.family_reports(
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
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.record_change()',t);
 execute format('create trigger version before update on public.%I for each row execute function public.bump_version()',t);
end loop;end$$;
create policy family_update_read on public.family_updates for select to authenticated using(public.is_admin() or public.employee_assigned(student_id) or public.parent_linked(student_id));
create policy family_report_read on public.family_reports for select to authenticated using(public.is_admin() or public.employee_assigned(student_id) or (published and public.parent_linked(student_id)));

create function public.parent_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if public.current_parent() is null then raise exception 'Không có quyền phụ huynh.' using errcode='42501';end if;
 return jsonb_build_object(
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active)) from public.students s where public.parent_linked(s.id)),'[]'),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'student_id',l.student_id,'employee_id',l.employee_id,'starts_at',l.starts_at,'ends_at',l.ends_at,'mode',l.mode,'status',l.status,'actual_minutes',l.actual_minutes,'location',l.location)) from public.lessons l where public.parent_linked(l.student_id)),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color)) from public.employees e where exists(select 1 from public.lessons l where l.employee_id=e.id and public.parent_linked(l.student_id))),'[]')
 );
end$$;
create function public.family_weekly(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare staff boolean;begin
 staff=public.is_admin() or public.employee_assigned(p_student);
 if not staff and not public.parent_linked(p_student) then raise exception 'Không còn quyền xem học sinh.' using errcode='42501';end if;
 return jsonb_build_object(
 'reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.family_reports r where r.student_id=p_student and (staff or r.published)),'[]'),
 'updates',coalesce((select jsonb_agg(to_jsonb(u)) from public.family_updates u where u.student_id=p_student),'[]'),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where exists(select 1 from public.family_updates u where u.student_id=p_student and u.author_id=p.id) or exists(select 1 from public.family_reports r where r.student_id=p_student and r.updated_by=p.id and (staff or r.published))),'[]'),
 'active',coalesce((select active from public.students where id=p_student),false)
 );
end$$;
create function public.save_family_weekly(p_kind text,p_record jsonb) returns void language plpgsql security definer set search_path='' as $$
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
commit;
