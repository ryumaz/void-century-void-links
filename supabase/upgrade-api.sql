-- =====================================================================
-- Void Links upgrade: public API (API keys + link functions)
-- Run AFTER run-this-once.sql. Supabase → SQL Editor → paste everything → Run.
-- Safe to run more than once.
--
-- How it works
--   • A signed-in user creates an API key in Settings. The full key is shown once;
--     only its SHA-256 fingerprint is stored, so nobody (us included) can read it back.
--   • The API (functions/api/v1/…) passes the key to the api_* functions below.
--     They find the key's owner and act only on that owner's links.
--   • Every rule still applies: reserved names, password hashing, the audit log and
--     rate limits (link creation shares the account's hourly limit).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users on delete cascade,
  name         text not null default 'API key' check (char_length(name) between 1 and 40),
  prefix       text not null,                 -- first characters, to recognise a key
  key_hash     text not null unique,          -- sha256 of the full key
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists api_keys_owner on public.api_keys (owner);
alter table public.api_keys enable row level security;
drop policy if exists "own api keys read" on public.api_keys;
create policy "own api keys read" on public.api_keys for select to authenticated using (owner = auth.uid());
revoke insert, update, delete on public.api_keys from anon, authenticated;

-- Bulk import and API users create more links: raise the per-account limit to 200 / hour
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
    ok := public.hit_limit('link:' || coalesce(new.owner::text, public.client_ip()), 200, interval '1 hour');
  end if;
  if not ok then
    raise exception 'Too many requests. Please wait a few minutes and try again.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_rate_limits() from public;

-- ---------------------------------------------------------------------
-- Dashboard: create and revoke your keys
-- ---------------------------------------------------------------------
create or replace function public.create_api_key(p_name text default 'API key')
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  k   text;
  row public.api_keys;
begin
  if uid is null then raise exception 'Log in first' using errcode = 'P0401'; end if;
  if (select count(*) from public.api_keys where owner = uid and revoked_at is null) >= 5 then
    raise exception 'You can have up to 5 active keys. Revoke one first.' using errcode = 'P0429';
  end if;
  k := 'vl_' || encode(gen_random_bytes(24), 'hex');
  insert into public.api_keys (owner, name, prefix, key_hash)
  values (uid, coalesce(nullif(left(trim(p_name), 40), ''), 'API key'), left(k, 10), encode(digest(k, 'sha256'), 'hex'))
  returning * into row;
  -- The only time the full key is ever returned
  return json_build_object('id', row.id, 'name', row.name, 'prefix', row.prefix, 'key', k, 'created_at', row.created_at);
end $$;

create or replace function public.revoke_api_key(p_id uuid)
returns boolean language sql security definer set search_path = public as $$
  update public.api_keys set revoked_at = now()
  where id = p_id and owner = auth.uid() and revoked_at is null
  returning true;
$$;

revoke execute on function public.create_api_key(text) from public, anon;
revoke execute on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.create_api_key(text) to authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- API: every call starts by turning the key into its owner
-- ---------------------------------------------------------------------
create or replace function public.api_owner(p_key text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare k public.api_keys;
begin
  select * into k from public.api_keys
  where key_hash = encode(digest(coalesce(p_key, ''), 'sha256'), 'hex') and revoked_at is null;
  if k.id is null then raise exception 'Invalid or revoked API key' using errcode = 'P0401'; end if;
  if not public.hit_limit('api:' || k.id, 600, interval '1 hour') then
    raise exception 'Too many requests. Please wait a few minutes and try again.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  update public.api_keys set last_used_at = now() where id = k.id and (last_used_at is null or last_used_at < now() - interval '1 minute');
  return k.owner;
end $$;
revoke execute on function public.api_owner(text) from public, anon, authenticated;

-- One link as the API returns it
create or replace function public.api_link_json(l public.short_links)
returns json language sql stable set search_path = public as $$
  select json_build_object(
    'slug', l.slug, 'destination', l.destination, 'clicks', l.clicks, 'status', l.status,
    'has_password', l.password_hash is not null, 'starts_at', l.starts_at, 'expires_at', l.expires_at,
    'max_clicks', l.max_clicks, 'created_at', l.created_at, 'updated_at', l.updated_at);
$$;
revoke execute on function public.api_link_json(public.short_links) from public, anon, authenticated;

create or replace function public.api_create_link(
  p_key text, p_url text, p_alias text default null, p_password text default null,
  p_starts_at timestamptz default null, p_expires_at timestamptz default null, p_max_clicks int default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  uid  uuid := public.api_owner(p_key);
  abc  text := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  s    text := nullif(trim(coalesce(p_alias, '')), '');
  l    public.short_links;
  i    int;
begin
  if p_url is null or p_url !~* '^https?://[^/\s]+\.[^/\s]+' then
    raise exception 'url must be a full http(s) address, like https://example.com/page' using errcode = 'P0400';
  end if;
  if s is not null and s !~ '^[A-Za-z0-9_-]{2,40}$' then
    raise exception 'alias must be 2-40 letters, numbers, - or _' using errcode = 'P0400';
  end if;
  if p_max_clicks is not null and p_max_clicks < 1 then
    raise exception 'max_clicks must be 1 or more' using errcode = 'P0400';
  end if;
  if p_starts_at is not null and p_expires_at is not null and p_expires_at <= p_starts_at then
    raise exception 'expires_at must be after starts_at' using errcode = 'P0400';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'expires_at is in the past' using errcode = 'P0400';
  end if;
  if s is null then
    -- Random 6-character ending, retried on the rare clash
    for attempt in 1..8 loop
      s := '';
      for i in 1..6 loop s := s || substr(abc, 1 + (get_byte(gen_random_bytes(1), 0) % length(abc)), 1); end loop;
      exit when not exists (select 1 from public.short_links where lower(slug) = lower(s));
    end loop;
  elsif exists (select 1 from public.short_links where lower(slug) = lower(s)) then
    raise exception 'That alias is already taken' using errcode = '23505';
  end if;
  insert into public.short_links (slug, owner, destination, password_hash, starts_at, expires_at, max_clicks)
  values (s, uid, p_url, nullif(p_password, ''), p_starts_at, p_expires_at, p_max_clicks)
  returning * into l;
  return public.api_link_json(l);
end $$;

create or replace function public.api_list_links(p_key text, p_limit int default 100, p_offset int default 0)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := public.api_owner(p_key);
begin
  return coalesce((
    select json_agg(public.api_link_json(l) order by l.created_at desc)
    from (select * from public.short_links where owner = uid
          order by created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0)) l
  ), '[]'::json);
end $$;

create or replace function public.api_get_link(p_key text, p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.api_owner(p_key);
  l   public.short_links;
begin
  select * into l from public.short_links where slug = p_slug and owner = uid;
  if l.slug is null then raise exception 'Link not found' using errcode = 'P0404'; end if;
  return (public.api_link_json(l)::jsonb || jsonb_build_object(
    'clicks_last_30_days', (select count(*) from public.clicks where slug = l.slug and at > now() - interval '30 days'),
    'top_countries', coalesce((select jsonb_agg(jsonb_build_object('country', country, 'clicks', n)) from (
        select country, count(*) n from public.clicks where slug = l.slug and at > now() - interval '30 days' and country is not null
        group by country order by n desc limit 5) c), '[]'::jsonb),
    'devices', coalesce((select jsonb_object_agg(coalesce(device, 'unknown'), n) from (
        select device, count(*) n from public.clicks where slug = l.slug and at > now() - interval '30 days' group by device) d), '{}'::jsonb)
  ))::json;
end $$;

create or replace function public.api_update_link(
  p_key text, p_slug text, p_url text default null, p_status text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.api_owner(p_key);
  l   public.short_links;
begin
  if p_url is not null and p_url !~* '^https?://[^/\s]+\.[^/\s]+' then
    raise exception 'url must be a full http(s) address' using errcode = 'P0400';
  end if;
  if p_status is not null and p_status not in ('active', 'paused', 'revoked') then
    raise exception 'status must be active, paused or revoked' using errcode = 'P0400';
  end if;
  select * into l from public.short_links where slug = p_slug and owner = uid;
  if l.slug is null then raise exception 'Link not found' using errcode = 'P0404'; end if;
  if l.status = 'revoked' and p_status is not null and p_status <> 'revoked' then
    raise exception 'A revoked link cannot be turned back on' using errcode = 'P0400';
  end if;
  update public.short_links
     set destination = coalesce(p_url, destination), status = coalesce(p_status, status)
   where slug = p_slug and owner = uid
  returning * into l;
  return public.api_link_json(l);
end $$;

create or replace function public.api_delete_link(p_key text, p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := public.api_owner(p_key);
begin
  delete from public.short_links where slug = p_slug and owner = uid;
  if not found then raise exception 'Link not found' using errcode = 'P0404'; end if;
  return json_build_object('deleted', p_slug);
end $$;

-- The API itself calls these with the public key; the API key inside decides everything
grant execute on function public.api_create_link(text, text, text, text, timestamptz, timestamptz, int) to anon, authenticated;
grant execute on function public.api_list_links(text, int, int) to anon, authenticated;
grant execute on function public.api_get_link(text, text) to anon, authenticated;
grant execute on function public.api_update_link(text, text, text, text) to anon, authenticated;
grant execute on function public.api_delete_link(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
