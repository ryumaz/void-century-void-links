-- =====================================================================
-- Void Links upgrade: advanced link options, audit log, profile cursors
-- Run AFTER schema.sql (and admin.sql). Paste into Supabase → SQL Editor →
-- New query → Run. Safe to run more than once.
--
-- Adds to short links (all optional):
--   • a password          (stored only as a bcrypt hash, checked on the server)
--   • a start and end time (the link only works inside that window)
--   • a maximum number of uses
--   • pause / resume, and revoke (permanent)
-- Every change to a link is written to public.link_audit by triggers, so the
-- history can't be skipped or edited from the website.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- New link columns
-- ---------------------------------------------------------------------
alter table public.short_links
  add column if not exists password_hash text,
  add column if not exists starts_at     timestamptz,
  add column if not exists expires_at    timestamptz,
  add column if not exists max_clicks    int,
  add column if not exists status        text not null default 'active',
  add column if not exists updated_at    timestamptz not null default now();

alter table public.short_links
  add column if not exists has_password boolean generated always as (password_hash is not null) stored;

do $$ begin
  alter table public.short_links add constraint short_links_status_chk check (status in ('active', 'paused', 'revoked'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.short_links add constraint short_links_max_chk check (max_clicks is null or max_clicks between 1 and 1000000000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.short_links add constraint short_links_window_chk check (starts_at is null or expires_at is null or expires_at > starts_at);
exception when duplicate_object then null; end $$;

-- The website sends a new password in password_hash; this hashes it before it is
-- stored, so the plain text never lands in the table.
create or replace function public.short_links_before_write()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.password_hash = '' then new.password_hash := null; end if;
  if new.password_hash is not null
     and (tg_op = 'INSERT' or new.password_hash is distinct from old.password_hash) then
    if char_length(new.password_hash) not between 4 and 72 then
      raise exception 'Password must be 4 to 72 characters';
    end if;
    new.password_hash := crypt(new.password_hash, gen_salt('bf', 10));
  end if;

  if tg_op = 'INSERT' then
    new.clicks := 0;
    new.status := coalesce(new.status, 'active');
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'revoked' and new.status <> 'revoked' then
      raise exception 'A revoked link cannot be turned back on';
    end if;
    -- Owners can't rewrite the click counter from the website
    if new.clicks <> old.clicks and current_setting('vortex.counting', true) is distinct from 'on' then
      new.clicks := old.clicks;
    end if;
    if (new.destination, new.password_hash, new.starts_at, new.expires_at, new.max_clicks, new.status)
       is distinct from (old.destination, old.password_hash, old.starts_at, old.expires_at, old.max_clicks, old.status) then
      new.updated_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists short_links_before_write on public.short_links;
create trigger short_links_before_write
  before insert or update on public.short_links
  for each row execute function public.short_links_before_write();

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
create table if not exists public.link_audit (
  id     bigserial primary key,
  owner  uuid not null,
  slug   text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  actor  text not null default 'you' check (actor in ('you', 'system')),
  at     timestamptz not null default now()
);
create index if not exists link_audit_owner_at on public.link_audit (owner, at desc);
alter table public.link_audit enable row level security;

drop policy if exists "own audit read" on public.link_audit;
create policy "own audit read" on public.link_audit for select to authenticated using (owner = auth.uid());
grant select on public.link_audit to authenticated;   -- read only: rows come from the triggers below

create or replace function public.short_links_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  log_row public.link_audit;
begin
  if tg_op = 'INSERT' then
    insert into public.link_audit (owner, slug, action, detail)
    values (new.owner, new.slug, 'created', jsonb_strip_nulls(jsonb_build_object(
      'destination', new.destination,
      'password',    case when new.password_hash is not null then true end,
      'starts_at',   new.starts_at,
      'expires_at',  new.expires_at,
      'max_clicks',  new.max_clicks)));
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Skip when the whole account is being deleted
    if exists (select 1 from auth.users where id = old.owner) then
      insert into public.link_audit (owner, slug, action, detail)
      values (old.owner, old.slug, 'deleted', jsonb_build_object('destination', old.destination, 'clicks', old.clicks));
    end if;
    return old;
  end if;

  -- UPDATE: one row per kind of change
  if new.destination is distinct from old.destination then
    insert into public.link_audit (owner, slug, action, detail)
    values (new.owner, new.slug, 'destination_changed', jsonb_build_object('from', old.destination, 'to', new.destination));
  end if;
  if new.password_hash is distinct from old.password_hash then
    insert into public.link_audit (owner, slug, action)
    values (new.owner, new.slug, case when old.password_hash is null then 'password_set'
                                      when new.password_hash is null then 'password_removed'
                                      else 'password_changed' end);
  end if;
  if new.status is distinct from old.status then
    insert into public.link_audit (owner, slug, action)
    values (new.owner, new.slug, case new.status when 'paused' then 'paused' when 'revoked' then 'revoked' else 'resumed' end);
  end if;
  if (new.starts_at, new.expires_at) is distinct from (old.starts_at, old.expires_at) then
    insert into public.link_audit (owner, slug, action, detail)
    values (new.owner, new.slug, 'schedule_changed', jsonb_build_object('starts_at', new.starts_at, 'expires_at', new.expires_at));
  end if;
  if new.max_clicks is distinct from old.max_clicks then
    insert into public.link_audit (owner, slug, action, detail)
    values (new.owner, new.slug, 'limit_changed', jsonb_build_object('from', old.max_clicks, 'to', new.max_clicks));
  end if;
  if new.max_clicks is not null and new.clicks >= new.max_clicks and old.clicks < new.max_clicks then
    insert into public.link_audit (owner, slug, action, detail, actor)
    values (new.owner, new.slug, 'limit_reached', jsonb_build_object('clicks', new.clicks), 'system');
  end if;
  return new;
end $$;

drop trigger if exists short_links_audit on public.short_links;
create trigger short_links_audit
  after insert or update or delete on public.short_links
  for each row execute function public.short_links_audit();

-- ---------------------------------------------------------------------
-- Opening a short link: every rule is checked here, on the server.
-- Returns {status:'ok', url} or {status:'password'|'wrong_password'|'scheduled'|
-- 'expired'|'used_up'|'paused'|'revoked'|'missing'}.
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

-- The old function now follows the same rules (used by older copies of go.html)
create or replace function public.follow_short_link(p_slug text, p_country text default null, p_device text default null, p_referrer text default null)
returns text language sql security definer set search_path = public as $$
  select case when r->>'status' = 'ok' then r->>'url' end
  from (select public.open_short_link(p_slug, null, p_country, p_device, p_referrer) as r) x;
$$;

-- ---------------------------------------------------------------------
-- What the website may do with links now
-- The password hash is never sent to the browser: only `has_password` is readable.
-- ---------------------------------------------------------------------
revoke select on public.short_links from authenticated;
grant select (slug, owner, destination, clicks, created_at, starts_at, expires_at, max_clicks, status, updated_at, has_password)
  on public.short_links to authenticated;

revoke execute on function public.short_links_before_write() from public;
revoke execute on function public.short_links_audit() from public;
revoke execute on function public.open_short_link(text, text, text, text, text) from public;
revoke execute on function public.follow_short_link(text, text, text, text) from public;
grant execute on function public.open_short_link(text, text, text, text, text) to anon, authenticated;
grant execute on function public.follow_short_link(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Profile pages: custom cursor
-- ---------------------------------------------------------------------
alter table public.pages
  add column if not exists cursor         text not null default 'default',
  add column if not exists cursor_path    text,
  add column if not exists cursor_hotspot text not null default 'tip';
do $$ begin
  alter table public.pages add constraint pages_cursor_chk check (cursor in ('default', 'crosshair', 'dot', 'custom'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pages add constraint pages_cursor_hotspot_chk check (cursor_hotspot in ('tip', 'center'));
exception when duplicate_object then null; end $$;

-- Tell the API about the new columns right away
notify pgrst, 'reload schema';
