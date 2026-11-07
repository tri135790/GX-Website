-- Gánh Xiếc: run once in a NEW Supabase project's SQL Editor.
begin;
create extension if not exists btree_gist;
create table public.employees(id uuid primary key default gen_random_uuid(),version integer not null default 1,name text not null check(length(trim(name))>0),email text not null default '',phone text not null default '',specialty text not null default '',color text not null default '#3d8479',active boolean not null default true);
create table public.students(id uuid primary key default gen_random_uuid(),version integer not null default 1,name text not null check(length(trim(name))>0),birth_date date not null,start_date date not null,notes text not null default '',active boolean not null default true);
create table public.parents(id uuid primary key default gen_random_uuid(),version integer not null default 1,name text not null check(length(trim(name))>0),email text not null default '',phone text not null default '',active boolean not null default true);
create table public.assignments(id uuid primary key default gen_random_uuid(),version integer not null default 1,student_id uuid not null references public.students,employee_id uuid not null references public.employees,responsibility text not null check(responsibility in ('primary','support')),unique(student_id,employee_id));
create unique index one_primary on public.assignments(student_id) where responsibility='primary';
create table public.families(id uuid primary key default gen_random_uuid(),version integer not null default 1,student_id uuid not null references public.students,parent_id uuid not null references public.parents,relationship text not null default 'Phụ huynh',is_primary boolean not null default false,unique(student_id,parent_id));
create unique index one_primary_parent on public.families(student_id) where is_primary;
create table public.lessons(id uuid primary key default gen_random_uuid(),version integer not null default 1,student_id uuid not null references public.students,employee_id uuid not null references public.employees,starts_at timestamptz not null,ends_at timestamptz not null,mode text not null check(mode in ('online','offline')),location text not null check(length(trim(location))>0),status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled','absent')),actual_minutes integer not null default 0,reason text not null default '',content text not null default '',note text not null default '',series_id uuid,check(ends_at>starts_at),check((status='completed' and actual_minutes>0) or (status<>'completed' and actual_minutes=0)),check(status not in ('cancelled','absent') or length(trim(reason))>0),check(status<>'completed' or actual_minutes=extract(epoch from(ends_at-starts_at))/60 or length(trim(reason))>0),exclude using gist (employee_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelled'),exclude using gist (student_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelled'));
create index lesson_start on public.lessons(starts_at);
create table public.goals(id uuid primary key default gen_random_uuid(),version integer not null default 1,student_id uuid not null references public.students,title text not null check(length(trim(title))>0),status text not null default 'new' check(status in ('new','working','achieved','paused')));
create table public.weekly(id uuid primary key default gen_random_uuid(),version integer not null default 1,student_id uuid not null references public.students,week_start date not null check(extract(isodow from week_start)=1),progress text not null default '',challenges text not null default '',next_steps text not null default '',goal_snapshot jsonb not null default '[]'::jsonb,updated_at timestamptz not null default now(),updated_by uuid references auth.users,unique(student_id,week_start));
create table public.profiles(id uuid primary key references auth.users on delete restrict,version integer not null default 1,name text not null default '',email text not null,role text not null check(role in ('admin','employee','parents')),active boolean not null default true,employee_id uuid references public.employees,parent_id uuid references public.parents,check((role='admin' and employee_id is null and parent_id is null) or (role='employee' and employee_id is not null and parent_id is null) or (role='parents' and parent_id is not null and employee_id is null)));
create table public.invitations(id uuid primary key default gen_random_uuid(),version integer not null default 1,email text not null,role text not null check(role in ('admin','employee','parents')),employee_id uuid references public.employees,parent_id uuid references public.parents,expires_at timestamptz not null default now()+interval '7 days',status text not null default 'pending' check(status in ('pending','accepted','revoked')),check((role='admin' and employee_id is null and parent_id is null) or (role='employee' and employee_id is not null and parent_id is null) or (role='parents' and parent_id is not null and employee_id is null)));
create unique index pending_invite_email on public.invitations(lower(email)) where status='pending';
create table public.audit_log(id bigint generated always as identity primary key,actor uuid,entity text not null,record_id uuid,operation text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now());
create table public.bootstrap(singleton boolean primary key default true check(singleton),email text not null,claimed_by uuid);
insert into public.bootstrap(email) values ('tranthanhtrivn@gmail.com');
alter table public.bootstrap enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active)$$;
revoke all on function public.is_admin() from public;grant execute on function public.is_admin() to authenticated;
-- RLS applies even when a browser calls Supabase REST directly.
do $$declare t text;begin foreach t in array array['employees','students','parents','assignments','families','lessons','goals','weekly','profiles','invitations','audit_log'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t);end loop;end$$;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
-- Mutations ONLY through the checked transaction below or trusted invitation server.
revoke insert,update,delete on public.employees,public.students,public.parents,public.assignments,public.families,public.lessons,public.goals,public.weekly,public.profiles,public.invitations,public.audit_log,public.bootstrap from anon,authenticated;
grant select on public.employees,public.students,public.parents,public.assignments,public.families,public.lessons,public.goals,public.weekly,public.profiles,public.invitations,public.audit_log to authenticated;
create function public.record_change() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.audit_log(actor,entity,record_id,operation,before_data,after_data) values(auth.uid(),tg_table_name,coalesce(new.id,old.id),tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);end$$;
create function public.bump_version() returns trigger language plpgsql set search_path='' as $$begin new.version=old.version+1;return new;end$$;
do $$declare t text;begin foreach t in array array['employees','students','parents','assignments','families','lessons','goals','weekly','profiles','invitations'] loop execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.record_change()',t);execute format('create trigger version before update on public.%I for each row execute function public.bump_version()',t);end loop;end$$;
create function public.validate_relations() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.students s where s.active and not exists(select 1 from public.assignments a join public.employees e on e.id=a.employee_id where a.student_id=s.id and a.responsibility='primary' and e.active)) then raise exception 'Mỗi học sinh đang hoạt động cần một người phụ trách chính đang hoạt động.';end if;
 if exists(select 1 from public.lessons l join public.students s on s.id=l.student_id join public.employees e on e.id=l.employee_id where l.status='scheduled' and (not s.active or not e.active or not exists(select 1 from public.assignments a where a.student_id=l.student_id and a.employee_id=l.employee_id))) then raise exception 'Cần xử lý lịch chưa hoàn thành trước khi ngừng hoạt động hoặc đổi phân công.';end if;
 return null;end$$;
do $$declare t text;begin foreach t in array array['students','employees','assignments','lessons'] loop execute format('create constraint trigger relations after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.validate_relations()',t);end loop;end$$;
create function public.validate_lesson_assignment() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' or new.student_id<>old.student_id or new.employee_id<>old.employee_id then
 if not exists(select 1 from public.assignments a join public.employees e on e.id=a.employee_id join public.students s on s.id=a.student_id where a.student_id=new.student_id and a.employee_id=new.employee_id and e.active and s.active) then raise exception 'Giáo viên phải thuộc nhóm phụ trách học sinh đang hoạt động.';end if;
 end if;return new;end$$;
create trigger lesson_assignment before insert or update on public.lessons for each row execute function public.validate_lesson_assignment();
revoke all on function public.validate_lesson_assignment() from public;
create function public.save_bundle(changes jsonb,removed jsonb default '[]'::jsonb) returns void language plpgsql security definer set search_path='' as $$
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
 if t not in ('employees','students','parents','assignments','families','lessons','goals','weekly','profiles') then raise exception 'Loại dữ liệu không hợp lệ.';end if;
 expected=coalesce((r->>'version')::integer,0);
 execute format('select to_jsonb(x) from public.%I x where id=$1 for update',t) into oldrow using (r->>'id')::uuid;
 if oldrow is null and t='profiles' then raise exception 'Tài khoản chỉ được tạo qua xác thực lời mời.';end if;
 if t='profiles' and (r->>'email' is distinct from oldrow->>'email') then raise exception 'Không được đổi email xác thực.';end if;
 if t='weekly' then r=r||jsonb_build_object('updated_at',now(),'updated_by',auth.uid());end if;
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
revoke all on function public.save_bundle(jsonb,jsonb) from public;grant execute on function public.save_bundle(jsonb,jsonb) to authenticated;
-- Only confirmed identities can claim the bootstrap email or an unexpired invitation.
create function public.claim_identity() returns trigger language plpgsql security definer set search_path='' as $$declare inv public.invitations;boot public.bootstrap;begin
 if new.email_confirmed_at is null or new.email is null then return new;end if;
 if exists(select 1 from public.profiles where id=new.id) then return new;end if;
 select * into boot from public.bootstrap where singleton for update;
 if boot.claimed_by is null and lower(new.email)=lower(boot.email) then
 insert into public.profiles(id,name,email,role) values(new.id,'Thanh Trí',new.email,'admin');update public.bootstrap set claimed_by=new.id where singleton;return new;end if;
 select * into inv from public.invitations where lower(email)=lower(new.email) and status='pending' and expires_at>now() for update;
 if inv.id is not null then
 insert into public.profiles(id,name,email,role,employee_id,parent_id) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,inv.role,inv.employee_id,inv.parent_id);
 update public.invitations set status='accepted' where id=inv.id;
 end if;return new;end$$;
create trigger claim_gx_identity after insert or update of email_confirmed_at,last_sign_in_at on auth.users for each row execute function public.claim_identity();
revoke all on function public.claim_identity(),public.record_change(),public.validate_relations(),public.bump_version() from public;
commit;
