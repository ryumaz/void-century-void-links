-- Page views: count each visitor once a day per page, so refreshing doesn't pump the number.
-- Also skips the page owner looking at their own page. Safe to run more than once.

create table if not exists public.page_view_hits (
  username text not null,
  visitor  text not null,               -- a hash of the visitor's IP address, never the address itself
  at       timestamptz not null default now(),
  primary key (username, visitor)
);
create index if not exists page_view_hits_at on public.page_view_hits (at);
alter table public.page_view_hits enable row level security;   -- no policies: only the function below uses it

create or replace function public.count_page_view(p_username text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  u text := lower(p_username);
  hdr json := nullif(current_setting('request.headers', true), '')::json;
  ip text;
  who text;
  last timestamptz;
  n bigint;
begin
  -- The owner looking at their own page doesn't count
  if auth.uid() is not null and exists (select 1 from public.pages where username = u and owner = auth.uid()) then
    select views into n from public.pages where username = u;
    return n;
  end if;

  ip := coalesce(hdr->>'cf-connecting-ip', split_part(hdr->>'x-forwarded-for', ',', 1), hdr->>'x-real-ip');
  if ip is not null and ip <> '' then
    who := encode(digest(ip || ':' || u, 'sha256'), 'hex');
    select at into last from public.page_view_hits where username = u and visitor = who;
    if last is not null and last > now() - interval '24 hours' then
      select views into n from public.pages where username = u;   -- seen today: show the count, don't add
      return n;
    end if;
    insert into public.page_view_hits (username, visitor, at) values (u, who, now())
      on conflict (username, visitor) do update set at = excluded.at;
    -- Tidy up old entries now and then
    if random() < 0.02 then delete from public.page_view_hits where at < now() - interval '2 days'; end if;
  end if;

  update public.pages set views = views + 1 where username = u returning views into n;
  return n;
end $$;

revoke execute on function public.count_page_view(text) from public;
grant execute on function public.count_page_view(text) to anon, authenticated;
