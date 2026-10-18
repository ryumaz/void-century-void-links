// Void Links public API: /api/v1/links/:slug
//   GET    → one link, with clicks in the last 30 days, top countries and devices
//   PATCH  → { "url"?, "status"?: "active" | "paused" | "revoked" }
//   DELETE → delete the link (its stats go with it)
// Auth and error format: see ./index.js

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

function start(request, params) {
  const key = apiKey(request);
  if (!key) return { error: fail(401, 'Missing API key. Send "Authorization: Bearer vl_…".') };
  const slug = String(params.slug || '');
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(slug)) return { error: fail(404, 'Link not found') };
  return { key, slug };
}

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestGet({ request, params }) {
  const s = start(request, params);
  if (s.error) return s.error;
  const { data, error } = await rpc('api_get_link', { p_key: s.key, p_slug: s.slug });
  if (error) return error;
  return json({ link: withUrl(request, data) });
}

export async function onRequestPatch({ request, params }) {
  const s = start(request, params);
  if (s.error) return s.error;
  let body;
  try { body = await request.json(); } catch { return fail(400, 'Send a JSON body, like {"status": "paused"}'); }
  if (!body || (body.url === undefined && body.status === undefined)) return fail(400, 'Send "url" and/or "status"');
  const { data, error } = await rpc('api_update_link', {
    p_key: s.key, p_slug: s.slug, p_url: body.url ?? null, p_status: body.status ?? null,
  });
  if (error) return error;
  return json({ link: withUrl(request, data) });
}

export async function onRequestDelete({ request, params }) {
  const s = start(request, params);
  if (s.error) return s.error;
  const { data, error } = await rpc('api_delete_link', { p_key: s.key, p_slug: s.slug });
  if (error) return error;
  return json(data);
}
