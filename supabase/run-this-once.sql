-- =====================================================================
-- Void Links: RUN THIS ONCE. Supabase → SQL Editor → paste everything → Run.
-- 1) Lets clicks follow a short link when its name changes
-- 2) admin.sql               (staff portal: staff roles, page reports)
-- 3) upgrade-clean-urls.sql  (clean addresses; reserved names)
-- 4) upgrade-rate-limits.sql (anti-abuse limits)
-- Safe to run more than once.
-- =====================================================================

alter table public.clicks drop constraint if exists clicks_slug_fkey;
alter table public.clicks add constraint clicks_slug_fkey
  foreign key (slug) references public.short_links (slug)
  on update cascade on delete cascade;


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
select id, lower(email), 'admin' from auth.users where lower(email) = lower('nirajmehtamain@gmail.com')
on conflict (user_id) do update set role = 'admin';

-- =====================================================================
-- Void Links upgrade: clean profile addresses (voids.wtf/<name>)
-- Run AFTER upgrade-links-cursors.sql. Supabase → SQL Editor → New query →
-- paste → Run. Safe to run more than once.
--
-- Profiles live at voids.wtf/<name> and short links at go.voids.wtf/<name>,
-- so the same name can be both. These rules keep the site's own addresses
-- (admin, assets…) from being taken, on the server, for everyone.
-- =====================================================================

create or replace function public.names_are_shared()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  reserved text[] := array['admin', 'go', 'index', 'assets', 'api', 'login', 'signup', 'dashboard',
                           'settings', 'help', 'about', 'terms', 'privacy', 'supabase', 'netlify', 'functions'];
begin
  -- Short links live on go.voids.wtf and profiles on voids.wtf, so the same name
  -- may be both. Only the site's own addresses are off limits.
  if tg_table_name = 'pages' then
    if tg_op = 'UPDATE' and new.username = old.username then return new; end if;
    if new.username = any(reserved) then
      raise exception 'That name is reserved' using errcode = '23505';
    end if;
  else
    if lower(new.slug) = any(reserved) then
      raise exception 'That name is reserved' using errcode = '23505';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists pages_names_are_shared on public.pages;
create trigger pages_names_are_shared
  before insert or update of username on public.pages
  for each row execute function public.names_are_shared();

drop trigger if exists short_links_names_are_shared on public.short_links;
create trigger short_links_names_are_shared
  before insert on public.short_links
  for each row execute function public.names_are_shared();

revoke execute on function public.names_are_shared() from public;

-- Lets the website check a username before you submit (true = free to use)
create or replace function public.name_is_free(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.pages where username = lower(p_name) and owner is distinct from auth.uid())
     and lower(p_name) <> all (array['admin', 'go', 'index', 'assets', 'api', 'login', 'signup', 'dashboard',
                                     'settings', 'help', 'about', 'terms', 'privacy', 'supabase', 'netlify', 'functions']);
$$;
revoke execute on function public.name_is_free(text) from public;
grant execute on function public.name_is_free(text) to anon, authenticated;

-- Still frame shown instantly while a video background downloads
alter table public.pages add column if not exists bg_poster text;

notify pgrst, 'reload schema';

-- Clicks follow a short link when its name changes (renaming keeps the stats)
alter table public.clicks drop constraint if exists clicks_slug_fkey;
alter table public.clicks add constraint clicks_slug_fkey
  foreign key (slug) references public.short_links (slug)
  on update cascade on delete cascade;

-- =====================================================================
-- Void Links upgrade: rate limits (anti-abuse)
-- Run AFTER upgrade-links-cursors.sql. Supabase → SQL Editor → New query →
-- paste → Run. Safe to run more than once.
--
-- Limits live in the database, so calling the API directly can't skip them.
--   • Link passwords: 8 tries per visitor per link / 10 min, 60 per link / 10 min
--   • Support tickets: 5 per visitor / hour (200 in total / hour)
--   • Support chat messages: 40 per visitor / hour
--   • Page reports: 10 per visitor / hour
--   • New short links: 60 per account / hour
-- Normal link clicks are NOT limited (they arrive through Netlify's servers).
-- Sign-up and login limits are Supabase's own: Authentication → Rate Limits.
-- =====================================================================

-- Counters, one row per "bucket" (what + who). Not reachable from the website API.
create table if not exists public.rate_limits (
  bucket       text primary key,
  hits         int  not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;   -- no policies = no API access
revoke all on public.rate_limits from anon, authenticated;

-- The visitor's IP address as Supabase sees it
create or replace function public.client_ip()
returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    nullif(trim(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown');
$$;

-- Counts one hit in a bucket. Returns true while still under the limit.
create or replace function public.hit_limit(p_bucket text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.rate_limits as r (bucket, hits, window_start)
  values (left(p_bucket, 200), 1, now())
  on conflict (bucket) do update
    set hits         = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into n;
  -- Now and then, forget old counters
  if random() < 0.01 then delete from public.rate_limits where window_start < now() - interval '1 day'; end if;
  return n <= p_max;
end $$;

revoke execute on function public.client_ip() from public;
revoke execute on function public.hit_limit(text, int, interval) from public;

-- ---------------------------------------------------------------------
-- Password guessing on protected links
-- (same function as before, plus the limit before each password check)
-- ---------------------------------------------------------------------
create or replace function public.open_short_link(
  p_slug text, p_password text default null,
  p_country text default null, p_device text default null, p_referrer text default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare l public.short_links;
begin
  select * into l from public.short_links where slug = p_slug;
  if not found then return json_build_object('status', 'missing'); end if;
  if l.status = 'revoked' then return json_build_object('status', 'revoked'); end if;
  if l.status = 'paused'  then return json_build_object('status', 'paused'); end if;
  if l.starts_at is not null and now() < l.starts_at then
    return json_build_object('status', 'scheduled', 'starts_at', l.starts_at);
  end if;
  if l.expires_at is not null and now() >= l.expires_at then return json_build_object('status', 'expired'); end if;
  if l.max_clicks is not null and l.clicks >= l.max_clicks then return json_build_object('status', 'used_up'); end if;

  if l.password_hash is not null then
    if coalesce(p_password, '') = '' then return json_build_object('status', 'password'); end if;
    if not public.hit_limit('pw:' || p_slug || ':' || public.client_ip(), 8, interval '10 minutes')
       or not public.hit_limit('pw:' || p_slug, 60, interval '10 minutes') then
      return json_build_object('status', 'rate_limited');
    end if;
    if crypt(p_password, l.password_hash) <> l.password_hash then
      perform pg_sleep(0.7);   -- makes guessing slow
      return json_build_object('status', 'wrong_password');
    end if;
  end if;

  -- Count the click (only while under the limit, so two visitors can't both take the last use)
  perform set_config('vortex.counting', 'on', true);
  update public.short_links set clicks = clicks + 1
   where slug = p_slug and (max_clicks is null or clicks < max_clicks)
   returning * into l;
  perform set_config('vortex.counting', 'off', true);
  if not found then return json_build_object('status', 'used_up'); end if;

  insert into public.clicks (slug, country, device, referrer)
  values (p_slug, left(p_country, 8), left(p_device, 20), left(p_referrer, 300));
  return json_build_object('status', 'ok', 'url', l.destination);
end $$;
revoke execute on function public.open_short_link(text, text, text, text, text) from public;
grant execute on function public.open_short_link(text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Tickets, chat messages, reports, new links: checked as rows are added
-- ---------------------------------------------------------------------
create or replace function public.enforce_rate_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare ok boolean := true;
begin
  if tg_table_name = 'support_tickets' then
    ok := public.hit_limit('ticket:' || public.client_ip(), 5, interval '1 hour')
          and public.hit_limit('ticket:all', 200, interval '1 hour');
  elsif tg_table_name = 'support_messages' then
    if new.sender = 'user' then
      ok := public.hit_limit('msg:' || public.client_ip(), 40, interval '1 hour');
    end if;
  elsif tg_table_name = 'reports' then
    ok := public.hit_limit('report:' || public.client_ip(), 10, interval '1 hour');
  elsif tg_table_name = 'short_links' then
    ok := public.hit_limit('link:' || coalesce(new.owner::text, public.client_ip()), 60, interval '1 hour');
  end if;
  if not ok then
    raise exception 'Too many requests. Please wait a few minutes and try again.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_rate_limits() from public;

drop trigger if exists rate_limit_tickets on public.support_tickets;
create trigger rate_limit_tickets before insert on public.support_tickets
  for each row execute function public.enforce_rate_limits();

drop trigger if exists rate_limit_messages on public.support_messages;
create trigger rate_limit_messages before insert on public.support_messages
  for each row execute function public.enforce_rate_limits();

drop trigger if exists rate_limit_reports on public.reports;
create trigger rate_limit_reports before insert on public.reports
  for each row execute function public.enforce_rate_limits();

drop trigger if exists rate_limit_links on public.short_links;
create trigger rate_limit_links before insert on public.short_links
  for each row execute function public.enforce_rate_limits();

notify pgrst, 'reload schema';
