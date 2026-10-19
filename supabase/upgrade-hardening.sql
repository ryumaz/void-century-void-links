-- Security hardening. Run AFTER the other upgrade files.
-- Supabase → SQL Editor → paste everything → Run. Safe to run more than once.
--
-- 1) Page view counts can't be edited by the page owner (no fake numbers).
--    Only the database's own view counter (count_page_view) changes them.
-- 2) Size limits on what a page or link can store, so nobody can stuff huge data in.
--    Limits only apply to new changes ("not valid" leaves old rows alone).

-- 1) View counts are read-only for users
create or replace function public.protect_page_views()
returns trigger language plpgsql as $$
begin
  -- Website and API calls run as "anon" or "authenticated"; the view counter runs as the database owner
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.views := 0;
    elsif new.views is distinct from old.views then
      new.views := old.views;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_page_views on public.pages;
create trigger protect_page_views before insert or update on public.pages
  for each row execute function public.protect_page_views();

-- 2) Size limits
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pages_links_limit') then
    alter table public.pages add constraint pages_links_limit
      check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 20 and pg_column_size(links) <= 24576) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pages_paths_limit') then
    alter table public.pages add constraint pages_paths_limit
      check (coalesce(char_length(avatar_path), 0) <= 300 and coalesce(char_length(bg_path), 0) <= 300
         and coalesce(char_length(audio_path), 0) <= 300 and coalesce(char_length(spotify), 0) <= 300) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'short_links_destination_limit') then
    alter table public.short_links add constraint short_links_destination_limit
      check (char_length(destination) <= 2048) not valid;
  end if;
end $$;

notify pgrst, 'reload schema';
