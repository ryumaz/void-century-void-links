-- =====================================================================
-- Void Links upgrade: short links on go.voids.wtf (run once, after run-this-once.sql)
-- Supabase → SQL Editor → paste everything → Run. Safe to run more than once.
-- A short link and a profile may now share a name (go.voids.wtf/x vs voids.wtf/x).
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

notify pgrst, 'reload schema';
