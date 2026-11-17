-- Apply after 001–005. Does not reset existing data.
begin;
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
