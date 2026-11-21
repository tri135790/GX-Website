-- Apply once after 007. All DDL precedes the data conversion it depends on.
begin;
select pg_advisory_xact_lock(742031);
do $$begin
 if to_regprocedure('public.update_my_work(uuid,integer,text,text)') is null then raise exception 'Áp dụng 007 trước 008.';end if;
end$$;
create table public.teachers(
 id uuid primary key default gen_random_uuid(),version integer not null default 1,
 name text not null check(length(trim(name))>0),short_name text not null default '',phone text not null default '',email text not null default '',address text not null default '',
 start_date date not null default current_date,employee_id uuid not null references public.employees,notes text not null default '',active boolean not null default true,deleted_at timestamptz
);
create table public.teacher_goals(id uuid primary key default gen_random_uuid(),version integer not null default 1,teacher_id uuid not null references public.teachers,title text not null check(length(trim(title))>0),status text not null default 'new' check(status in ('new','working','achieved','paused')));
create table public.teacher_weekly(id uuid primary key default gen_random_uuid(),version integer not null default 1,teacher_id uuid not null references public.teachers,week_start date not null check(extract(isodow from week_start)=1),progress text not null default '',challenges text not null default '',next_steps text not null default '',goal_snapshot jsonb not null default '[]' check(jsonb_typeof(goal_snapshot)='array'),updated_by uuid references public.profiles,updated_at timestamptz not null default now(),unique(teacher_id,week_start));
alter table public.students add column deleted_at timestamptz;
alter table public.lessons add column teacher_ids uuid[] not null default '{}',add column bm boolean not null default false;
alter table public.lessons drop constraint work_student;
alter table public.lessons add constraint work_subject check(
 (work_kind in ('legacy','therapy') and student_id is not null and cardinality(teacher_ids)=0) or
 (work_kind='consultation' and ((student_id is not null and cardinality(teacher_ids)=0) or (student_id is null and cardinality(teacher_ids)>0))) or
 (work_kind in ('meeting','report','leave') and student_id is null and cardinality(teacher_ids)=0));
alter table public.lessons add constraint therapy_bm check(not bm or work_kind='therapy');
create table public.lesson_teachers(lesson_id uuid not null references public.lessons on delete cascade,teacher_id uuid not null references public.teachers,primary key(lesson_id,teacher_id));
create table public.legacy_support_archive(id uuid primary key default gen_random_uuid(),entity text not null,record jsonb not null,archived_at timestamptz not null default now());
alter table public.legacy_support_archive enable row level security;
revoke all on public.legacy_support_archive from anon,authenticated;
grant select on public.legacy_support_archive to authenticated;
create policy support_archive_admin on public.legacy_support_archive for select to authenticated using(public.is_admin());
create function public.can_access_teacher(p_teacher uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.teachers t where t.id=p_teacher and t.active and (t.employee_id=public.current_employee() or exists(select 1 from public.lessons l where t.id=any(l.teacher_ids) and l.employee_id=public.current_employee())))
$$;
do $$declare t text;begin foreach t in array array['teachers','teacher_goals','teacher_weekly'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.record_change()',t);
 execute format('create trigger version before update on public.%I for each row execute function public.bump_version()',t);
end loop;end$$;
create policy teacher_read on public.teachers for select to authenticated using(public.can_access_teacher(id));
create policy teacher_goal_read on public.teacher_goals for select to authenticated using(public.can_access_teacher(teacher_id));
create policy teacher_weekly_read on public.teacher_weekly for select to authenticated using(public.can_access_teacher(teacher_id));
alter table public.lesson_teachers enable row level security;
revoke all on public.lesson_teachers from anon,authenticated;
grant select on public.lesson_teachers to authenticated;
create policy lesson_teacher_read on public.lesson_teachers for select to authenticated using(public.can_access_teacher(teacher_id));
create function public.sync_lesson_teachers() returns trigger language plpgsql security definer set search_path='' as $$begin
 delete from public.lesson_teachers where lesson_id=new.id;
 insert into public.lesson_teachers select new.id,unnest(new.teacher_ids);
 return new;
end$$;
create trigger teacher_links after insert or update on public.lessons for each row execute function public.sync_lesson_teachers();
create function public.validate_teacher_record() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.active and not exists(select 1 from public.employees where id=new.employee_id and active) then raise exception 'Chọn Incharge đang hoạt động.';end if;
 if tg_op='UPDATE' and old.deleted_at is not null then raise exception 'Hồ sơ đã xóa không thể sửa.';end if;
 return new;
end$$;
create trigger teacher_record before insert or update on public.teachers for each row execute function public.validate_teacher_record();
create function public.validate_teacher_child() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.teachers where id=new.teacher_id and active) then raise exception 'Hồ sơ giáo viên không còn hoạt động.';end if;return new;
end$$;
create trigger teacher_goal_record before insert or update on public.teacher_goals for each row execute function public.validate_teacher_child();
create trigger teacher_weekly_record before insert or update on public.teacher_weekly for each row execute function public.validate_teacher_child();
create or replace function public.employee_assigned(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.students st where st.id=s and st.active and (exists(select 1 from public.assignments a where a.student_id=s and a.responsibility='primary' and a.employee_id=public.current_employee()) or exists(select 1 from public.lessons l where l.student_id=s and l.employee_id=public.current_employee())))
$$;
create or replace function public.validate_work_metadata() returns trigger language plpgsql security definer set search_path='' as $$declare clash public.lessons;who text;begin
 new.auto_recorded=false;
 new.support_employee_ids='{}';
 if array_position(new.teacher_ids,null) is not null or cardinality(new.teacher_ids)<>(select count(distinct x) from unnest(new.teacher_ids) x) then raise exception 'Danh sách giáo viên không hợp lệ.';end if;
 if exists(select 1 from unnest(new.teacher_ids) x where not exists(select 1 from public.teachers t where t.id=x and t.active)) then raise exception 'Giáo viên không tồn tại hoặc đã xóa.';end if;
 if new.status<>'cancelled' then
 select * into clash from public.lessons l where l.id<>new.id and l.status<>'cancelled'
 and ((not new.primary_pending and not l.primary_pending and l.employee_id=new.employee_id) or (new.student_id is not null and l.student_id=new.student_id) or l.teacher_ids && new.teacher_ids)
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
create or replace function public.validate_lesson_assignment() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.student_id is not null and (tg_op='INSERT' or new.student_id is distinct from old.student_id or new.employee_id is distinct from old.employee_id) then
 if not exists(select 1 from public.assignments a join public.employees e on e.id=a.employee_id join public.students s on s.id=a.student_id where a.student_id=new.student_id and a.employee_id=new.employee_id and a.responsibility='primary' and e.active and s.active) then raise exception 'Nhân sự phải thuộc nhóm phụ trách học sinh đang hoạt động.';end if;
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
create or replace function public.validate_relations() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.teachers t join public.employees e on e.id=t.employee_id where t.active and not e.active) then raise exception 'Chuyển Incharge cho giáo viên khách hàng trước khi ẩn nhân sự.';end if;
 if exists(select 1 from public.students s where s.active and not exists(select 1 from public.assignments a join public.employees e on e.id=a.employee_id where a.student_id=s.id and a.responsibility='primary' and e.active)) then raise exception 'Mỗi học sinh đang hoạt động cần một người phụ trách chính đang hoạt động.';end if;
 if exists(select 1 from public.lessons l join public.employees e on e.id=l.employee_id left join public.students s on s.id=l.student_id where l.status='scheduled' and (not e.active or (l.student_id is not null and (not s.active)))) then raise exception 'Cần xử lý lịch chưa hoàn thành trước khi ngừng hoạt động hoặc đổi phân công.';end if;
 return null;end$$;
create or replace function public.save_bundle(changes jsonb,removed jsonb default '[]'::jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;r jsonb;t text;k text;cols text;vals text;sets text;n integer;expected integer;oldrow jsonb;begin
 if not public.is_admin() then raise exception 'Không có quyền quản trị.' using errcode='42501';end if;
 -- Serialize related changes, preventing last-admin and cross-table write skew.
 perform pg_advisory_xact_lock(742031);
 for item in select value from jsonb_array_elements(removed) loop
 t=item->>'table';r=item->'record';
 if t not in ('assignments','families') then raise exception 'Không hỗ trợ xóa hồ sơ; hãy ngừng hoạt động hoặc hủy buổi.';end if;
 execute format('delete from public.%I where id=$1 and version=$2',t) using (r->>'id')::uuid,(r->>'version')::integer;get diagnostics n=row_count;if n<>1 then raise exception 'Dữ liệu đã thay đổi. Vui lòng tải lại.';end if;
 end loop;
 for item in select value from jsonb_array_elements(changes) loop
 t=item->>'table';r=item->'record';
 if t not in ('employees','students','parents','assignments','families','lessons','goals','weekly','profiles','teachers','teacher_goals','teacher_weekly') then raise exception 'Loại dữ liệu không hợp lệ.';end if;
 expected=coalesce((r->>'version')::integer,0);
 execute format('select to_jsonb(x) from public.%I x where id=$1 for update',t) into oldrow using (r->>'id')::uuid;
 if t in ('students','teachers') and oldrow->>'deleted_at' is not null then raise exception 'Hồ sơ đã xóa không thể sửa.';end if;
 if oldrow is null and t='profiles' then raise exception 'Tài khoản chỉ được tạo qua xác thực lời mời.';end if;
 if t='profiles' and (r->>'email' is distinct from oldrow->>'email') then raise exception 'Không được đổi email xác thực.';end if;
 if t in ('weekly','teacher_weekly') then r=r||jsonb_build_object('updated_at',now(),'updated_by',auth.uid());end if;
 cols='';vals='';sets='';
 for k in select jsonb_object_keys(r) loop
 if k='version' then continue;end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name=k) then raise exception 'Trường không hợp lệ.';end if;
 cols=cols||case when cols='' then '' else ',' end||format('%I',k);
 vals=vals||case when vals='' then '' else ',' end||format('(jsonb_populate_record(null::public.%I,$1)).%I',t,k);
 if k<>'id' then sets=sets||case when sets='' then '' else ',' end||format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',k,t,k);end if;
 end loop;
 if oldrow is null then
 if expected<>0 then raise exception 'Không tìm thấy bản ghi. Vui lòng tải lại.';end if;
 execute format('insert into public.%I (%s) select %s',t,cols,vals) using r;
 else
 if (oldrow->>'version')::integer<>expected then raise exception 'Dữ liệu đã thay đổi. Vui lòng tải lại trước khi lưu.';end if;
 execute format('update public.%I set %s where id=$2',t,sets) using r,(r->>'id')::uuid;
 end if;
 end loop;
 if not exists(select 1 from public.profiles where active and role='admin') then raise exception 'Phải giữ ít nhất một admin đang hoạt động.';end if;
end$$;
create or replace function public.employee_create_work(p_records jsonb) returns void language plpgsql security definer set search_path='' as $$declare eid uuid;r jsonb;k text;l public.lessons;batch_series uuid:=gen_random_uuid();begin
 perform pg_advisory_xact_lock(742031);eid=public.current_employee();
 if eid is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 370 then raise exception 'Danh sách giờ làm không hợp lệ.';end if;
 for r in select value from jsonb_array_elements(p_records) loop
 for k in select jsonb_object_keys(r) loop if k not in ('id','version','employee_id','student_id','starts_at','ends_at','mode','location','location_id','meeting_url','content','work_kind','work_group','all_day','auto_recorded','status','actual_minutes','reason','note','series_id','support_employee_ids','primary_pending','report_content','report_status','report_submitted_at','report_submitted_by','teacher_ids','bm') then raise exception 'Trường không hợp lệ.' using errcode='42501';end if;end loop;
 l=jsonb_populate_record(null::public.lessons,r);
 if l.employee_id is distinct from eid or l.version is distinct from 0 or l.work_kind not in ('consultation','therapy','meeting','report') or l.work_kind is null or coalesce(l.all_day,false) or coalesce(l.status,'scheduled')<>'scheduled' or coalesce(l.actual_minutes,0)<>0 or coalesce(l.reason,'')<>'' or coalesce(l.note,'')<>'' then raise exception 'Chỉ được tạo giờ làm của chính mình.' using errcode='42501';end if;
 if cardinality(coalesce(l.support_employee_ids,'{}'))>0 or coalesce(l.primary_pending,false) or coalesce(l.report_content,'')<>'' or coalesce(l.report_status,'draft')<>'draft' or l.report_submitted_at is not null or l.report_submitted_by is not null then raise exception 'Chỉ admin quản lý người tham gia và báo cáo được nộp qua thao tác riêng.' using errcode='42501';end if;
 if exists(select 1 from unnest(coalesce(l.teacher_ids,'{}')) x where not public.can_access_teacher(x)) then raise exception 'Không có quyền với giáo viên được chọn.' using errcode='42501';end if;
 if l.work_kind in ('consultation','therapy') and cardinality(coalesce(l.teacher_ids,'{}'))=0 and not public.employee_assigned(l.student_id) then raise exception 'Học sinh không được phân công.' using errcode='42501';end if;
 insert into public.lessons(id,employee_id,student_id,starts_at,ends_at,mode,location,location_id,meeting_url,content,work_kind,work_group,auto_recorded,status,actual_minutes,series_id,teacher_ids,bm)
 values(l.id,eid,l.student_id,l.starts_at,l.ends_at,coalesce(l.mode,'offline'),coalesce(nullif(l.location,''),'—'),l.location_id,coalesce(l.meeting_url,''),coalesce(l.content,''),l.work_kind,null,false,'scheduled',0,case when jsonb_array_length(p_records)>1 then batch_series else null end,coalesce(l.teacher_ids,'{}'),coalesce(l.bm,false));
 end loop;
end$$;
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
 'lessons',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('status',public.work_status(l),'actual_minutes',public.work_minutes(l)) order by l.starts_at desc) from public.lessons l where public.employee_assigned(l.student_id) or l.employee_id=public.current_employee() or exists(select 1 from public.teachers t where t.id=any(l.teacher_ids) and public.can_access_teacher(t.id))),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color,'active',e.active)) from public.employees e where e.active or exists(select 1 from public.lessons l where e.id=any(l.support_employee_ids)) or e.id=public.current_employee() or exists(select 1 from public.assignments a where a.employee_id=e.id and public.employee_assigned(a.student_id)) or exists(select 1 from public.lessons l where l.employee_id=e.id and public.employee_assigned(l.student_id))),'[]'),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where exists(select 1 from public.weekly w where w.updated_by=p.id and public.employee_assigned(w.student_id))),'[]')
 ) into result;return result;
end$$;
create or replace function public.employee_calendar_v3(p_start timestamptz,p_end timestamptz) returns table(id uuid,student_id uuid,student_name text,employee_id uuid,employee_name text,color text,starts_at timestamptz,ends_at timestamptz,mode text,status text,actual_minutes integer,work_kind text,location text,all_day boolean,work_group uuid,employee_active boolean,support_employee_ids uuid[],primary_pending boolean,report_status text,teacher_ids uuid[],bm boolean) language plpgsql stable security definer set search_path='' as $$begin
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '100 days' then raise exception 'Khoảng lịch không hợp lệ.';end if;
 return query select l.id,l.student_id,coalesce(nullif(s.short_name,''),s.name,''),l.employee_id,e.name,e.color,l.starts_at,l.ends_at,l.mode,public.work_status(l),public.work_minutes(l),l.work_kind,case when l.work_kind='legacy' then '' else l.location end,l.all_day,l.work_group,e.active,l.support_employee_ids,l.primary_pending,l.report_status,l.teacher_ids,l.bm
 from public.lessons l left join public.students s on s.id=l.student_id join public.employees e on e.id=l.employee_id where l.starts_at>=p_start and l.starts_at<p_end order by l.starts_at,l.id;
end$$;

create function public.save_teacher_progress(p_table text,p_record jsonb) returns void language plpgsql security definer set search_path='' as $$
declare rid uuid;tid uuid;expected integer;oldrow jsonb;k text;allowed text[];begin
 perform pg_advisory_xact_lock(742031);
 if public.current_employee() is null then raise exception 'Không có quyền nhân sự.' using errcode='42501';end if;
 allowed=case p_table when 'teacher_goals' then array['id','version','teacher_id','title','status'] when 'teacher_weekly' then array['id','version','teacher_id','week_start','progress','challenges','next_steps','goal_snapshot'] end;
 if allowed is null or jsonb_typeof(p_record) is distinct from 'object' then raise exception 'Dữ liệu không hợp lệ.';end if;
 for k in select jsonb_object_keys(p_record) loop if not k=any(allowed) then raise exception 'Trường không hợp lệ.';end if;end loop;
 rid=(p_record->>'id')::uuid;tid=(p_record->>'teacher_id')::uuid;expected=(p_record->>'version')::integer;
 if rid is null or tid is null or expected is null or not public.can_access_teacher(tid) then raise exception 'Không có quyền hồ sơ.' using errcode='42501';end if;
 execute format('select to_jsonb(x) from public.%I x where id=$1 for update',p_table) into oldrow using rid;
 if coalesce((oldrow->>'version')::integer,0)<>expected or (oldrow is not null and (oldrow->>'teacher_id')::uuid<>tid) then raise exception 'Dữ liệu đã thay đổi.' using errcode='40001';end if;
 if p_table='teacher_goals' then
 if oldrow is null then insert into public.teacher_goals(id,teacher_id,title,status) values(rid,tid,p_record->>'title',p_record->>'status);
 else update public.teacher_goals set title=p_record->>'title',status=p_record->>'status' where id=rid;end if;
 else
 if oldrow is not null and oldrow->>'week_start' is distinct from p_record->>'week_start' then raise exception 'Không được đổi tuần.';end if;
 if oldrow is null then insert into public.teacher_weekly(id,teacher_id,week_start,progress,challenges,next_steps,goal_snapshot,updated_by) values(rid,tid,(p_record->>'week_start')::date,coalesce(p_record->>'progress',''),coalesce(p_record->>'challenges',''),coalesce(p_record->>'next_steps',''),coalesce(p_record->'goal_snapshot','[]'),auth.uid());
 else update public.teacher_weekly set progress=coalesce(p_record->>'progress',''),challenges=coalesce(p_record->>'challenges',''),next_steps=coalesce(p_record->>'next_steps',''),goal_snapshot=coalesce(p_record->'goal_snapshot','[]'),updated_by=auth.uid(),updated_at=now() where id=rid;end if;
 end if;
end$$;
-- Explicit destructive action; never route this through the ordinary Save form.
create function public.delete_client_profile(p_kind text,p_id uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare expected integer;deleted timestamptz;begin
 if not public.is_admin() then raise exception 'Chỉ admin được xóa hồ sơ.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(742031);
 if p_kind='student' then
 select version,deleted_at into expected,deleted from public.students where id=p_id for update;
 elsif p_kind='teacher' then
 select version,deleted_at into expected,deleted from public.teachers where id=p_id for update;
 else raise exception 'Loại hồ sơ không hợp lệ.';end if;
 if expected is null or expected is distinct from p_version or deleted is not null then raise exception 'Hồ sơ đã thay đổi hoặc đã xóa. Tải lại trước khi tiếp tục.' using errcode='40001';end if;
 if p_kind='student' then
 delete from public.lessons where student_id=p_id;
 delete from public.goals where student_id=p_id;
 delete from public.weekly where student_id=p_id;
 delete from public.family_reports where student_id=p_id;
 delete from public.family_updates where student_id=p_id;
 delete from public.assignments where student_id=p_id;
 delete from public.families where student_id=p_id;
 update public.students set active=false,deleted_at=now() where id=p_id;
 else
 -- Keep shared sessions and their shared report for remaining participants.
 delete from public.lessons where p_id=any(teacher_ids) and cardinality(teacher_ids)=1;
 update public.lessons set teacher_ids=array_remove(teacher_ids,p_id) where p_id=any(teacher_ids);
 delete from public.teacher_goals where teacher_id=p_id;
 delete from public.teacher_weekly where teacher_id=p_id;
 update public.teachers set active=false,deleted_at=now() where id=p_id;
 end if;
end$$;
-- Preserve old support assignments for audit, then remove them from active access.
insert into public.legacy_support_archive(entity,record) select 'assignments',to_jsonb(a) from public.assignments a where responsibility='support';
insert into public.legacy_support_archive(entity,record) select 'lessons',jsonb_build_object('id',id,'support_employee_ids',support_employee_ids) from public.lessons where cardinality(support_employee_ids)>0;
update public.lessons set support_employee_ids='{}' where cardinality(support_employee_ids)>0;
delete from public.assignments where responsibility='support';
set constraints all immediate;
set constraints all deferred;
alter table public.assignments add constraint primary_assignment_only check(responsibility='primary');
alter table public.lessons add constraint single_incharge_only check(cardinality(support_employee_ids)=0);
revoke all on function public.can_access_teacher(uuid),public.sync_lesson_teachers(),public.validate_teacher_record(),public.validate_teacher_child(),public.save_teacher_progress(text,jsonb),public.delete_client_profile(text,uuid,integer),public.employee_calendar_v3(timestamptz,timestamptz) from public,anon;
grant execute on function public.can_access_teacher(uuid),public.save_teacher_progress(text,jsonb),public.delete_client_profile(text,uuid,integer),public.employee_calendar_v3(timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
