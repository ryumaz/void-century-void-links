-- =====================================================================
-- Void Links database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Profiles: one row per account (name + account photo)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Create the profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Pages: the link-in-bio pages (one per account)
-- ---------------------------------------------------------------------
create table if not exists public.pages (
  username    text primary key check (username ~ '^[a-z0-9_.-]{2,20}$'),
  owner       uuid not null unique references auth.users on delete cascade,
  name        text check (char_length(name) <= 40),
  bio         text check (char_length(bio) <= 160),
  dim         int  not null default 35 check (dim between 0 and 85),
  blur        int  not null default 0  check (blur between 0 and 24),
  layout      text not null default 'buttons' check (layout in ('buttons', 'icons')),
  sound       text not null default 'none'    check (sound in ('none', 'video', 'file')),
  volume      int  not null default 60 check (volume between 0 and 100),
  spotify     text,
  discord_id  text check (discord_id is null or discord_id ~ '^[0-9]{17,20}$'),
  now_playing boolean not null default false,
  links       jsonb not null default '[]'::jsonb,
  avatar_path text,          -- files live in the "media" storage bucket
  bg_path     text,
  bg_type     text check (bg_type is null or bg_type in ('', 'image', 'video')),
  audio_path  text,
  views       bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Short links + click log
-- ---------------------------------------------------------------------
create table if not exists public.short_links (
  slug        text primary key check (slug ~ '^[A-Za-z0-9_-]{2,40}$'),
  owner       uuid not null references auth.users on delete cascade,
  destination text not null check (destination ~* '^https?://'),
  clicks      bigint not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.clicks (
  id       bigserial primary key,
  slug     text not null references public.short_links on delete cascade,
  at       timestamptz not null default now(),
  country  text,
  device   text,
  referrer text
);
create index if not exists clicks_slug_at on public.clicks (slug, at desc);

-- ---------------------------------------------------------------------
-- Support: tickets + messages (visitors don't need an account)
-- Only reachable through the functions further down, never directly.
-- ---------------------------------------------------------------------
create table if not exists public.support_tickets (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  secret     uuid not null default gen_random_uuid(),   -- lets the visitor reopen their own thread
  user_id    uuid references auth.users on delete set null,
  name       text not null check (char_length(name) between 1 and 60),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic      text not null,
  status     text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id         bigserial primary key,
  ticket_id  uuid not null references public.support_tickets on delete cascade,
  sender     text not null check (sender in ('user', 'staff', 'system')),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Security: Row Level Security (who can read / write what)
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.pages            enable row level security;
alter table public.short_links      enable row level security;
alter table public.clicks           enable row level security;
alter table public.support_tickets  enable row level security;
alter table public.support_messages enable row level security;

-- Profiles: you see and edit only your own
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Pages: everyone can read a published page; only the owner can change it
drop policy if exists "pages are public"   on public.pages;
drop policy if exists "owner inserts page" on public.pages;
drop policy if exists "owner updates page" on public.pages;
drop policy if exists "owner deletes page" on public.pages;
create policy "pages are public"   on public.pages for select to anon, authenticated using (true);
create policy "owner inserts page" on public.pages for insert to authenticated with check (owner = auth.uid());
create policy "owner updates page" on public.pages for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner deletes page" on public.pages for delete to authenticated using (owner = auth.uid());

-- Visitors can't edit `views` directly, so counting goes through this function
create or replace function public.count_page_view(p_username text)
returns bigint language sql security definer set search_path = public as $$
  update public.pages set views = views + 1 where username = lower(p_username) returning views;
$$;

-- Short links: you manage your own
drop policy if exists "own links read"   on public.short_links;
drop policy if exists "own links insert" on public.short_links;
drop policy if exists "own links update" on public.short_links;
drop policy if exists "own links delete" on public.short_links;
create policy "own links read"   on public.short_links for select to authenticated using (owner = auth.uid());
create policy "own links insert" on public.short_links for insert to authenticated with check (owner = auth.uid());
create policy "own links update" on public.short_links for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own links delete" on public.short_links for delete to authenticated using (owner = auth.uid());

-- Clicks: you can read clicks on your own links
drop policy if exists "own clicks read" on public.clicks;
create policy "own clicks read" on public.clicks for select to authenticated
  using (exists (select 1 from public.short_links l where l.slug = clicks.slug and l.owner = auth.uid()));

-- Following a short link: logs the click and returns where to go
create or replace function public.follow_short_link(p_slug text, p_country text default null, p_device text default null, p_referrer text default null)
returns text language plpgsql security definer set search_path = public as $$
declare dest text;
begin
  update public.short_links set clicks = clicks + 1 where slug = p_slug returning destination into dest;
  if dest is not null then
    insert into public.clicks (slug, country, device, referrer)
    values (p_slug, left(p_country, 8), left(p_device, 20), left(p_referrer, 300));
  end if;
  return dest;
end $$;

-- Support (no direct table access: everything goes through these)
create or replace function public.create_ticket(p_name text, p_email text, p_topic text, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare t public.support_tickets;
begin
  insert into public.support_tickets (code, user_id, name, email, topic)
  values ('LP-' || upper(substr(md5(gen_random_uuid()::text), 1, 5)), auth.uid(), p_name, p_email, left(p_topic, 40))
  returning * into t;
  insert into public.support_messages (ticket_id, sender, body) values (t.id, 'user', p_body);
  return json_build_object('id', t.id, 'code', t.code, 'secret', t.secret);
end $$;

create or replace function public.add_ticket_message(p_id uuid, p_secret uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.support_tickets where id = p_id and secret = p_secret) then
    raise exception 'ticket not found';
  end if;
  insert into public.support_messages (ticket_id, sender, body) values (p_id, 'user', p_body);
  update public.support_tickets set status = 'open' where id = p_id;
end $$;

create or replace function public.get_ticket(p_id uuid, p_secret uuid)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'code', t.code, 'topic', t.topic, 'email', t.email, 'status', t.status,
    'messages', coalesce((select json_agg(json_build_object('sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.created_at)
                          from public.support_messages m where m.ticket_id = t.id), '[]'::json))
  from public.support_tickets t where t.id = p_id and t.secret = p_secret;
$$;

-- Table access for the website's API (the project has "auto-expose new tables" off,
-- so only what's listed here is reachable; RLS above still decides which rows).
grant select on public.pages to anon, authenticated;
grant insert, update, delete on public.pages to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.short_links to authenticated;
grant select on public.clicks to authenticated;
-- support_* tables get no direct grants: visitors use the functions below.

-- Functions run with the owner's rights, so lock them down and allow only these calls
revoke execute on function public.count_page_view(text) from public;
revoke execute on function public.follow_short_link(text, text, text, text) from public;
revoke execute on function public.create_ticket(text, text, text, text) from public;
revoke execute on function public.add_ticket_message(uuid, uuid, text) from public;
revoke execute on function public.get_ticket(uuid, uuid) from public;
grant execute on function public.count_page_view(text) to anon, authenticated;
grant execute on function public.follow_short_link(text, text, text, text) to anon, authenticated;
grant execute on function public.create_ticket(text, text, text, text) to anon, authenticated;
grant execute on function public.add_ticket_message(uuid, uuid, text) to anon, authenticated;
grant execute on function public.get_ticket(uuid, uuid) to anon, authenticated;

-- =====================================================================
-- Storage: one public bucket for page media
-- Files are stored as <user id>/<file>, and you can only write your own folder.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
        array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm',
              'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/webm'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media upload own folder" on storage.objects;
drop policy if exists "media update own folder" on storage.objects;
drop policy if exists "media delete own folder" on storage.objects;
create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
