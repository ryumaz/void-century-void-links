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
