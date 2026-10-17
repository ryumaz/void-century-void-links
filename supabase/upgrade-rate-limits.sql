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
