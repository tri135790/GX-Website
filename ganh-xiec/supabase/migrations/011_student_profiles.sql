-- Apply after 010 and before the matching frontend. No legacy content is published.
begin;
select pg_advisory_xact_lock(742031);
create table public.student_weekly_notes (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students,
 week_start date not null check(extract(isodow from week_start)=1), content text not null check(length(trim(content)) between 1 and 20000),
 version integer not null default 1, updated_by uuid not null references public.profiles, updated_at timestamptz not null default now(), unique(student_id,week_start)
);
create table public.consultation_reports (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students,
 lesson_id uuid not null unique references public.lessons on delete restrict,
 participants text not null default '', general text not null check(length(trim(general)) between 1 and 20000),
 theory text not null default '', practice text not null default '', gratitude text not null default '',
 version integer not null default 1, updated_by uuid not null references public.profiles, updated_at timestamptz not null default now()
);
create table public.student_assessments (
 id uuid primary key, student_id uuid not null references public.students, kind text not null check(kind in ('atec','stress')),
 form_version integer not null check(form_version=1), parent_id uuid not null references public.parents, submitted_by uuid not null references public.profiles,
 answers jsonb not null, section_scores integer[] not null, total_score integer not null, submitted_at timestamptz not null default now()
);
create index assessments_history on public.student_assessments(student_id,kind,parent_id,submitted_at desc);
do $$declare t text;begin foreach t in array array['student_weekly_notes','consultation_reports','student_assessments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy profile_read on public.%I for select to authenticated using(public.is_admin() or public.employee_assigned(student_id) or public.parent_linked(student_id))',t);
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.record_change()',t);
 if t<>'student_assessments' then execute format('create trigger version before update on public.%I for each row execute function public.bump_version()',t);end if;
end loop;end$$;
create function public.consultation_eligible(l public.lessons) returns boolean language sql immutable set search_path='' as $$
 select l.work_kind='consultation' or (l.work_kind='consultation_therapy' and exists(select 1 from jsonb_each_text(l.participant_roles) r where r.value='consultation'))
$$;
create function public.protect_consultation_report() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.consultation_reports where lesson_id=old.id) and (new.student_id is distinct from old.student_id or new.work_kind is distinct from old.work_kind or not public.consultation_eligible(new)) then
 raise exception 'Buổi đã có báo cáo tư vấn; không thể đổi học sinh hoặc loại buổi.';end if;return new;
end$$;
create trigger protect_consultation_report before update on public.lessons for each row execute function public.protect_consultation_report();
create function public.save_student_report(p_kind text,p_record jsonb) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid; lid uuid; wk date; expected integer; current_version integer; k text; allowed text[];begin
 perform pg_advisory_xact_lock(742031);
 allowed=case p_kind when 'note' then array['student_id','week_start','version','content'] when 'consultation' then array['student_id','lesson_id','version','participants','general','theory','practice','gratitude'] end;
 if allowed is null or jsonb_typeof(p_record) is distinct from 'object' then raise exception 'Dữ liệu không hợp lệ.';end if;
 for k in select jsonb_object_keys(p_record) loop
 if not k=any(allowed) then raise exception 'Trường không hợp lệ: %',k;end if;
 if k not in ('version') and (jsonb_typeof(p_record->k)<>'string' or length(p_record->>k)>20000) then raise exception 'Nội dung không hợp lệ.';end if;
 end loop;
 sid=(p_record->>'student_id')::uuid;expected=(p_record->>'version')::integer;
 if not(public.is_admin() or public.employee_assigned(sid)) then raise exception 'Không có quyền cập nhật.' using errcode='42501';end if;
 if not exists(select 1 from public.students where id=sid and active) then raise exception 'Học sinh đã ngừng hoạt động.';end if;
 if expected is null or expected<0 then raise exception 'Thiếu phiên bản.';end if;
 if p_kind='note' then
 wk=(p_record->>'week_start')::date;
 select version into current_version from public.student_weekly_notes where student_id=sid and week_start=wk for update;
 else
 lid=(p_record->>'lesson_id')::uuid;
 if not exists(select 1 from public.lessons l where l.id=lid and l.student_id=sid and public.consultation_eligible(l) and l.status<>'cancelled') then raise exception 'Buổi tư vấn không hợp lệ.';end if;
 select version into current_version from public.consultation_reports where lesson_id=lid for update;
 end if;
 if coalesce(current_version,0)<>expected then raise exception 'Dữ liệu đã thay đổi. Tải lại để đối chiếu.' using errcode='40001';end if;
 if p_kind='note' then
 insert into public.student_weekly_notes(student_id,week_start,content,updated_by) values(sid,wk,p_record->>'content',auth.uid())
 on conflict(student_id,week_start) do update set content=excluded.content,updated_by=auth.uid(),updated_at=now();
 else
 insert into public.consultation_reports(student_id,lesson_id,participants,general,theory,practice,gratitude,updated_by)
 values(sid,lid,coalesce(p_record->>'participants',''),p_record->>'general',coalesce(p_record->>'theory',''),coalesce(p_record->>'practice',''),coalesce(p_record->>'gratitude',''),auth.uid())
 on conflict(lesson_id) do update set participants=excluded.participants,general=excluded.general,theory=excluded.theory,practice=excluded.practice,gratitude=excluded.gratitude,updated_by=auth.uid(),updated_at=now();
 end if;
end$$;
create function public.submit_student_assessment(p_id uuid,p_student uuid,p_kind text,p_form_version integer,p_answers jsonb) returns public.student_assessments language plpgsql security definer set search_path='' as $$
declare result public.student_assessments; counts integer[]; scores integer[]:=array[0,0,0,0]; i integer; j integer; pos integer:=0; choice integer; value integer;begin
 perform pg_advisory_xact_lock(742031);
 if public.current_parent() is null or not public.parent_linked(p_student) then raise exception 'Không có quyền nộp bài.' using errcode='42501';end if;
 select * into result from public.student_assessments where id=p_id;
 if found then
 if result.submitted_by=auth.uid() and result.student_id=p_student and result.kind=p_kind and result.form_version=p_form_version and result.answers=p_answers then return result;end if;
 raise exception 'Mã lần nộp đã được sử dụng.';end if;
 if not exists(select 1 from public.students where id=p_student and active) then raise exception 'Học sinh đã ngừng hoạt động.';end if;
 if p_id is null or p_kind is null or p_kind not in ('atec','stress') or p_form_version is distinct from 1 or jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Bài đánh giá không hợp lệ.';end if;
 counts=case when p_kind='atec' then array[14,20,18,25] else array[7,16,4,3] end;
 if jsonb_array_length(p_answers)<>(case when p_kind='atec' then 77 else 30 end) then raise exception 'Cần trả lời đủ số câu.';end if;
 for i in 1..4 loop for j in 1..counts[i] loop
 if jsonb_typeof(p_answers->pos)<>'number' or (p_answers->>pos)!~'^[0-9]+$' then raise exception 'Lựa chọn không hợp lệ.';end if;
 choice=(p_answers->>pos)::integer;
 if choice<0 or choice>(case when p_kind='stress' then 4 when i=4 then 3 else 2 end) then raise exception 'Lựa chọn không hợp lệ.';end if;
 value=case when p_kind='stress' then choice+1 when i in (1,3) then 2-choice else choice end;
 scores[i]=scores[i]+value;pos=pos+1;
 end loop;end loop;
 insert into public.student_assessments(id,student_id,kind,form_version,parent_id,submitted_by,answers,section_scores,total_score)
 values(p_id,p_student,p_kind,1,public.current_parent(),auth.uid(),p_answers,scores,scores[1]+scores[2]+scores[3]+scores[4]) returning * into result;
 return result;
end$$;
create function public.student_profile(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare staff boolean;begin
 staff=public.is_admin() or public.employee_assigned(p_student);
 if not staff and not public.parent_linked(p_student) then raise exception 'Không còn quyền xem học sinh.' using errcode='42501';end if;
 return jsonb_build_object(
 'student',(select to_jsonb(s) from public.students s where s.id=p_student),
 'can_edit',staff and exists(select 1 from public.students where id=p_student and active),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.assignments a where student_id=p_student),'[]'),
 'families',coalesce((select jsonb_agg(to_jsonb(f)) from public.families f where student_id=p_student),'[]'),
 'parents',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'phone',p.phone,'email',p.email,'active',p.active,'version',p.version)) from public.parents p where exists(select 1 from public.families f where f.student_id=p_student and f.parent_id=p.id)),'[]'),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'color',e.color)) from public.employees e where exists(select 1 from public.assignments a where a.student_id=p_student and a.employee_id=e.id) or exists(select 1 from public.lessons l where l.student_id=p_student and (l.employee_id=e.id or e.id=any(l.support_employee_ids)))),'[]'),
 'lessons',coalesce((select jsonb_agg((to_jsonb(l)-array['report_content','report_submitted_at','report_submitted_by'])||jsonb_build_object('status',public.work_status(l),'actual_minutes',public.work_minutes(l)) order by l.starts_at desc) from public.lessons l where l.student_id=p_student),'[]'),
 'notes',coalesce((select jsonb_agg(to_jsonb(n) order by week_start desc) from public.student_weekly_notes n where student_id=p_student),'[]'),
 'reports',coalesce((select jsonb_agg(to_jsonb(r) order by updated_at desc) from public.consultation_reports r where student_id=p_student),'[]'),
 'assessments',coalesce((select jsonb_agg(to_jsonb(a) order by submitted_at desc,id) from public.student_assessments a where student_id=p_student),'[]'),
 'legacy',public.family_weekly(p_student),
 'authors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.profiles p where p.id in (select updated_by from public.student_weekly_notes where student_id=p_student union select updated_by from public.consultation_reports where student_id=p_student union select submitted_by from public.student_assessments where student_id=p_student)),'[]')
 );end$$;
revoke all on function public.consultation_eligible(public.lessons),public.protect_consultation_report(),public.save_student_report(text,jsonb),public.submit_student_assessment(uuid,uuid,text,integer,jsonb),public.student_profile(uuid) from public,anon;
grant execute on function public.save_student_report(text,jsonb),public.submit_student_assessment(uuid,uuid,text,integer,jsonb),public.student_profile(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
