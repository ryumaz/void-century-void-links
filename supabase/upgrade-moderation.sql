-- Background templates + link moderation. Run AFTER run-this-once.sql.
-- Supabase → SQL Editor → paste everything → Run. Safe to run more than once.
--
-- 1) bg_templates: backgrounds people share for others to use on their page.
--    Anyone can browse them; signed-in users can add up to 10 a day; staff can ban or delete them.
-- 2) blocked_domains: websites staff have blocked. New links to them are refused,
--    and existing links to them stop opening.
-- 3) blocked_links: single short links staff have switched off.
-- 4) Staff tools for the portal (/admin): list all links, block/unblock, manage templates.

-- ---------------------------------------------------------------------
-- 1) Background templates
-- ---------------------------------------------------------------------
create table if not exists public.bg_templates (
  id         bigserial primary key,
  path       text not null check (char_length(path) <= 300),
  kind       text not null default 'image' check (kind in ('image', 'video')),
  title      text check (char_length(title) <= 40),
  uploader   uuid not null default auth.uid() references auth.users on delete cascade,
  status     text not null default 'active' check (status in ('active', 'banned')),
  created_at timestamptz not null default now()
);
create index if not exists bg_templates_recent on public.bg_templates (status, created_at desc);
alter table public.bg_templates enable row level security;

drop policy if exists "templates browse"       on public.bg_templates;
drop policy if exists "templates browse staff" on public.bg_templates;
drop policy if exists "templates add own"      on public.bg_templates;
drop policy if exists "templates delete own"   on public.bg_templates;
drop policy if exists "templates staff update" on public.bg_templates;
drop policy if exists "templates staff delete" on public.bg_templates;
create policy "templates browse" on public.bg_templates for select to anon using (status = 'active');
create policy "templates browse staff" on public.bg_templates for select to authenticated
  using (status = 'active' or uploader = auth.uid() or public.is_staff());
-- You can only share a file from your own folder
create policy "templates add own" on public.bg_templates for insert to authenticated
  with check (uploader = auth.uid() and status = 'active' and path like auth.uid()::text || '/template-%');
create policy "templates delete own" on public.bg_templates for delete to authenticated using (uploader = auth.uid());
create policy "templates staff update" on public.bg_templates for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "templates staff delete" on public.bg_templates for delete to authenticated using (public.is_staff());

-- At most 10 new templates per person per day
create or replace function public.limit_templates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.hit_limit('tpl:' || coalesce(auth.uid()::text, public.client_ip()), 10, interval '1 day') then
    raise exception 'You can share up to 10 templates a day. Try again tomorrow.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end $$;
revoke execute on function public.limit_templates() from public;
drop trigger if exists rate_limit_templates on public.bg_templates;
create trigger rate_limit_templates before insert on public.bg_templates
  for each row execute function public.limit_templates();

-- Staff can remove any shared template file from storage (users can already remove their own)
drop policy if exists "media delete by staff" on storage.objects;
create policy "media delete by staff" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_staff());

-- ---------------------------------------------------------------------
-- 2) + 3) Blocked websites and blocked links (staff only)
-- ---------------------------------------------------------------------
create table if not exists public.blocked_domains (
  domain     text primary key check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  reason     text check (char_length(reason) <= 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.blocked_links (
  slug       text primary key references public.short_links on update cascade on delete cascade,
  reason     text check (char_length(reason) <= 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.blocked_domains enable row level security;
alter table public.blocked_links enable row level security;
drop policy if exists "staff manage blocked domains" on public.blocked_domains;
drop policy if exists "staff manage blocked links" on public.blocked_links;
create policy "staff manage blocked domains" on public.blocked_domains for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage blocked links" on public.blocked_links for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- The website name of an address: https://www.Example.com:8080/x → example.com
create or replace function public.url_host(p_url text)
returns text language sql immutable as $$
  select regexp_replace(split_part(split_part(split_part(lower(regexp_replace(coalesce(p_url, ''), '^[a-z]+://', '', 'i')), '/', 1), '?', 1), ':', 1), '^www\.', '');
$$;

-- Is this address on a blocked website (or a subdomain of one)?
create or replace function public.url_blocked(p_url text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocked_domains d, (select public.url_host(p_url) as h) x
    where x.h = d.domain or x.h like '%.' || d.domain);
$$;
revoke execute on function public.url_blocked(text) from public;

-- New links (website, API, CSV import) and changed destinations can't point at a blocked website
create or replace function public.refuse_blocked_links()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.destination is distinct from old.destination) and public.url_blocked(new.destination) then
    raise exception 'Links to this website are not allowed on Void Links.' using errcode = 'P0001', hint = 'blocked';
  end if;
  return new;
end $$;
revoke execute on function public.refuse_blocked_links() from public;
drop trigger if exists refuse_blocked_links on public.short_links;
create trigger refuse_blocked_links before insert or update of destination on public.short_links
  for each row execute function public.refuse_blocked_links();

-- Opening a link: same rules as before, plus "blocked" for switched-off links and blocked websites
create or replace function public.open_short_link(
  p_slug text, p_password text default null,
  p_country text default null, p_device text default null, p_referrer text default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare l public.short_links;
begin
  select * into l from public.short_links where slug = p_slug;
  if not found then return json_build_object('status', 'missing'); end if;
  if exists (select 1 from public.blocked_links where slug = p_slug) or public.url_blocked(l.destination) then
    return json_build_object('status', 'blocked');
  end if;
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
-- 4) Staff tools
-- ---------------------------------------------------------------------
-- Every short link (newest first), with its owner's email and whether it's blocked
create or replace function public.admin_list_links(p_search text default null, p_limit int default 300)
returns table (slug text, destination text, owner_email text, clicks bigint, created_at timestamptz,
               status text, blocked boolean, block_reason text, site_blocked boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  return query
    select l.slug, l.destination, u.email::text, l.clicks, l.created_at, coalesce(l.status, 'active'),
           b.slug is not null, b.reason, public.url_blocked(l.destination)
      from public.short_links l
      left join auth.users u on u.id = l.owner
      left join public.blocked_links b on b.slug = l.slug
     where coalesce(p_search, '') = ''
        or l.slug ilike '%' || p_search || '%'
        or l.destination ilike '%' || p_search || '%'
        or u.email ilike '%' || p_search || '%'
     order by l.created_at desc
     limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end $$;
revoke execute on function public.admin_list_links(text, int) from public;
grant execute on function public.admin_list_links(text, int) to authenticated;

-- Templates for the portal, with the uploader's email
create or replace function public.admin_list_templates()
returns table (id bigint, path text, kind text, title text, uploader_email text, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  return query
    select t.id, t.path, t.kind, t.title, u.email::text, t.status, t.created_at
      from public.bg_templates t left join auth.users u on u.id = t.uploader
     order by t.created_at desc limit 500;
end $$;
revoke execute on function public.admin_list_templates() from public;
grant execute on function public.admin_list_templates() to authenticated;

notify pgrst, 'reload schema';
