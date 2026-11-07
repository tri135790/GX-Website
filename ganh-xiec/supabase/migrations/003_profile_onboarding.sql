-- Apply once after 001 (and 002 when enabled), before deploying the frontend.
begin;
alter table public.profiles
 add column phone text not null default '',
 add column address text not null default '',
 add column onboarding_completed boolean not null default false;

-- Caller identity is determined by the verified JWT, never by a supplied ID.
create function public.complete_my_profile(p_name text, p_phone text default '', p_address text default '')
returns public.profiles language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
 perform pg_advisory_xact_lock(742031);
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.' using errcode='42501'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 120
    or length(coalesce(p_phone,''))>30 or length(coalesce(p_address,''))>500 then
   raise exception 'Họ tên, số điện thoại hoặc địa chỉ không hợp lệ.' using errcode='22023';
 end if;
 update public.profiles set name=trim(p_name), phone=trim(coalesce(p_phone,'')),
   address=trim(coalesce(p_address,'')), onboarding_completed=true
 where id=auth.uid() and active returning * into result;
 if not found then raise exception 'Tài khoản chưa được cấp quyền hoặc đã bị khóa.' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function public.complete_my_profile(text,text,text) from public,anon;
grant execute on function public.complete_my_profile(text,text,text) to authenticated;
commit;
