// Void Links public API: /api/v1/links
//   GET  /api/v1/links?limit=100&offset=0   → your links, newest first
//   POST /api/v1/links                      → create a link
//        { "url": "https://…", "alias"?, "password"?, "starts_at"?, "expires_at"?, "max_clicks"? }
// Auth: "Authorization: Bearer vl_…" (create keys in Dashboard → Settings → API keys).
// Every rule lives in the database (supabase/upgrade-api.sql); this file only translates HTTP.

const SUPABASE_URL = 'https://agbsbbkrinewplajdwax.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eKJmkapRV3BNWNehHcRVMw_Go_JQkdg';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400',
};
const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
});
const fail = (status, message) => json({ error: { status, message } }, status);
const STATUS = { P0400: 400, P0401: 401, P0404: 404, P0429: 429, 23505: 409, 23514: 400, '22P02': 400, 22007: 400, 22008: 400, 22023: 400 };

const apiKey = request => {
  const auth = request.headers.get('authorization') || '';
  return (auth.match(/^Bearer\s+(\S+)$/i) || [])[1] || request.headers.get('x-api-key') || '';
};
const linkBase = request => {
  const u = new URL(request.url);
  return (u.hostname === 'voids.wtf' || u.hostname === 'www.voids.wtf') ? 'https://go.voids.wtf/' : u.origin + '/';
};
const withUrl = (request, link) => ({ ...link, short_url: linkBase(request) + link.slug });

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (res.ok) return { data };
  const code = data && data.code;
  const status = (data && data.hint === 'rate_limited') ? 429 : (STATUS[code] || (res.status >= 500 ? 502 : 400));
  return { error: fail(status, (data && data.message) || 'Request failed') };
}

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestGet({ request }) {
  const key = apiKey(request);
  if (!key) return fail(401, 'Missing API key. Send "Authorization: Bearer vl_…".');
  const q = new URL(request.url).searchParams;
  const { data, error } = await rpc('api_list_links', {
    p_key: key, p_limit: +q.get('limit') || 100, p_offset: +q.get('offset') || 0,
  });
  if (error) return error;
  return json({ links: (data || []).map(l => withUrl(request, l)) });
}

export async function onRequestPost({ request }) {
  const key = apiKey(request);
  if (!key) return fail(401, 'Missing API key. Send "Authorization: Bearer vl_…".');
  let body;
  try { body = await request.json(); } catch { return fail(400, 'Send a JSON body, like {"url": "https://example.com"}'); }
  if (!body || typeof body.url !== 'string') return fail(400, '"url" is required');
  const { data, error } = await rpc('api_create_link', {
    p_key: key,
    p_url: body.url.trim(),
    p_alias: body.alias ?? null,
    p_password: body.password ?? null,
    p_starts_at: body.starts_at ?? null,
    p_expires_at: body.expires_at ?? null,
    p_max_clicks: body.max_clicks ?? null,
  });
  if (error) return error;
  return json({ link: withUrl(request, data) }, 201);
}
