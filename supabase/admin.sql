-- =====================================================================
-- Admin + support staff setup (run AFTER schema.sql)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
--
-- LAST LINE: replace YOUR_EMAIL_HERE with the email of your own account
-- (the one you signed up with on the website) to make yourself the first admin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Staff: which accounts can use admin.html, and with what role
--   admin   → everything, including adding/removing staff and deleting pages
--   support → tickets, reports and the user list
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users on delete cascade,
  email      text not null,
  role       text not null check (role in ('admin', 'support')),
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin');
$$;
revoke execute on function public.is_staff() from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "staff see staff"    on public.staff;
drop policy if exists "admins remove staff" on public.staff;
drop policy if exists "admins change staff" on public.staff;
create policy "staff see staff"     on public.staff for select to authenticated using (public.is_staff());
create policy "admins remove staff" on public.staff for delete to authenticated using (public.is_admin() and user_id <> auth.uid());
create policy "admins change staff" on public.staff for update to authenticated using (public.is_admin() and user_id <> auth.uid()) with check (public.is_admin());
grant select, update, delete on public.staff to authenticated;

-- Make an EXISTING account staff (by email). New logins with a password are
-- created by the admin-staff edge function, or in Supabase → Authentication → Add user.
create or replace function public.admin_add_staff(p_email text, p_role text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Only admins can add staff'; end if;
  if p_role not in ('admin', 'support') then raise exception 'Unknown role'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'No account with that email yet'; end if;
  insert into public.staff (user_id, email, role) values (uid, lower(p_email), p_role)
  on conflict (user_id) do update set role = excluded.role;
  return json_build_object('user_id', uid, 'email', lower(p_email), 'role', p_role);
end $$;
revoke execute on function public.admin_add_staff(text, text) from public;
grant execute on function public.admin_add_staff(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Support: staff can read every ticket, reply and change status
-- ---------------------------------------------------------------------
drop policy if exists "staff read tickets"   on public.support_tickets;
drop policy if exists "staff update tickets" on public.support_tickets;
drop policy if exists "staff read messages"  on public.support_messages;
drop policy if exists "staff reply"          on public.support_messages;
create policy "staff read tickets"   on public.support_tickets  for select to authenticated using (public.is_staff());
create policy "staff update tickets" on public.support_tickets  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff read messages"  on public.support_messages for select to authenticated using (public.is_staff());
create policy "staff reply"          on public.support_messages for insert to authenticated with check (public.is_staff() and sender = 'staff');
grant select, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
grant usage on sequence public.support_messages_id_seq to authenticated;

-- ---------------------------------------------------------------------
-- Reports: visitors can report a page; staff review them
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id         bigserial primary key,
  username   text not null,
  reason     text not null check (reason in ('spam', 'impersonation', 'harmful', 'other')),
  details    text check (char_length(details) <= 500),
  reporter   uuid references auth.users on delete set null,
  status     text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "staff read reports"   on public.reports;
drop policy if exists "staff update reports" on public.reports;
create policy "staff read reports"   on public.reports for select to authenticated using (public.is_staff());
create policy "staff update reports" on public.reports for update to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, update on public.reports to authenticated;

create or replace function public.report_page(p_username text, p_reason text, p_details text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.pages where username = lower(p_username)) then raise exception 'page not found'; end if;
  -- simple flood guard: max 5 reports per page per hour
  if (select count(*) from public.reports where username = lower(p_username) and created_at > now() - interval '1 hour') >= 5 then
    return;
  end if;
  insert into public.reports (username, reason, details, reporter)
  values (lower(p_username), p_reason, left(p_details, 500), auth.uid());
end $$;
revoke execute on function public.report_page(text, text, text) from public;
grant execute on function public.report_page(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Moderation: staff can remove any page; admins see all accounts
-- ---------------------------------------------------------------------
drop policy if exists "staff delete any page" on public.pages;
create policy "staff delete any page" on public.pages for delete to authenticated using (public.is_staff());

-- Account list for the portal (auth.users is private, so this function exposes
-- only what the portal needs, and only to staff)
create or replace function public.admin_list_users()
returns table (id uuid, email text, name text, username text, views bigint,
               joined timestamptz, last_sign_in timestamptz, confirmed boolean, provider text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  return query
    select u.id, u.email::text, p.display_name, pg.username, coalesce(pg.views, 0),
           u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
           coalesce(u.raw_app_meta_data->>'provider', 'email')
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.pages pg on pg.owner = u.id
    order by u.created_at desc;
end $$;
revoke execute on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------
-- First admin (you). Replace the email, then run.
-- ---------------------------------------------------------------------
insert into public.staff (user_id, email, role)
select id, lower(email), 'admin' from auth.users where lower(email) = lower('YOUR_EMAIL_HERE')
on conflict (user_id) do update set role = 'admin';
