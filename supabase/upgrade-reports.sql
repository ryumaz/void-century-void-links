-- Shareable reports: a read-only stats page for one short link that anyone with the
-- link can open, no account needed. Safe to run more than once.
--
-- What a shared report shows: the short link, the destination's site name (not the full
-- address), total clicks, clicks per day, countries, devices, referring sites and busiest
-- hours. Never single clicks, and nothing about the owner.

create table if not exists public.report_shares (
  slug       text primary key references public.short_links on update cascade on delete cascade,
  token      text not null unique,
  owner      uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.report_shares enable row level security;   -- no policies: only the functions below touch it

-- Turn sharing on for one of your links. Returns the secret part of the report address.
create or replace function public.share_link_report(p_slug text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.short_links where slug = p_slug and owner = auth.uid()) then
    raise exception 'Link not found';
  end if;
  select token into t from public.report_shares where slug = p_slug;
  if t is null then
    t := encode(gen_random_bytes(16), 'hex');
    insert into public.report_shares (slug, token, owner) values (p_slug, t, auth.uid());
  end if;
  return t;
end $$;

-- Turn sharing off: the old report address stops working.
create or replace function public.unshare_link_report(p_slug text)
returns void language sql security definer set search_path = public as $$
  delete from public.report_shares where slug = p_slug and owner = auth.uid();
$$;

-- Which of your links are shared (for the dashboard).
create or replace function public.my_report_shares()
returns table (slug text, token text) language sql stable security definer set search_path = public as $$
  select slug, token from public.report_shares where owner = auth.uid();
$$;

-- The public report. Only totals and groups, from the last 90 days (plus the all-time total).
create or replace function public.get_shared_report(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare s text; dest text; total bigint; made timestamptz; since timestamptz := now() - interval '90 days';
begin
  if p_token is null or length(p_token) < 16 then return null; end if;
  select r.slug, l.destination, l.clicks, l.created_at into s, dest, total, made
    from public.report_shares r join public.short_links l on l.slug = r.slug
   where r.token = p_token;
  if s is null then return null; end if;
  return json_build_object(
    'slug', s,
    'site', regexp_replace(split_part(regexp_replace(dest, '^https?://', ''), '/', 1), '^www\.', ''),
    'created', made,
    'total', total,
    'days', coalesce((select json_agg(json_build_object('d', d, 'n', n) order by d)
                        from (select (at at time zone 'utc')::date as d, count(*) as n from public.clicks
                               where slug = s and at >= since group by 1) x), '[]'::json),
    'countries', coalesce((select json_agg(json_build_object('k', k, 'n', n) order by n desc)
                             from (select coalesce(nullif(country, ''), '??') as k, count(*) as n from public.clicks
                                    where slug = s and at >= since group by 1 order by 2 desc limit 8) x), '[]'::json),
    'devices', coalesce((select json_agg(json_build_object('k', k, 'n', n) order by n desc)
                           from (select coalesce(nullif(device, ''), 'other') as k, count(*) as n from public.clicks
                                  where slug = s and at >= since group by 1 order by 2 desc limit 6) x), '[]'::json),
    'referrers', coalesce((select json_agg(json_build_object('k', k, 'n', n) order by n desc)
                             from (select coalesce(nullif(referrer, ''), 'Direct') as k, count(*) as n from public.clicks
                                    where slug = s and at >= since group by 1 order by 2 desc limit 8) x), '[]'::json),
    'hours', coalesce((select json_agg(json_build_object('h', h, 'n', n) order by h)
                         from (select extract(hour from at at time zone 'utc')::int as h, count(*) as n from public.clicks
                                where slug = s and at >= since group by 1) x), '[]'::json)
  );
end $$;

revoke execute on function public.share_link_report(text) from public;
revoke execute on function public.unshare_link_report(text) from public;
revoke execute on function public.my_report_shares() from public;
revoke execute on function public.get_shared_report(text) from public;
grant execute on function public.share_link_report(text) to authenticated;
grant execute on function public.unshare_link_report(text) to authenticated;
grant execute on function public.my_report_shares() to authenticated;
grant execute on function public.get_shared_report(text) to anon, authenticated;
