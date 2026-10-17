// Netlify Edge Function: clean addresses for short links and profile pages.
//   /abc     → short link (instant redirect, with the visitor's country)
//   /ryuma   → profile page, served by index.html while the address stays /ryuma
//   /@ryuma  → old style, permanently redirected to /ryuma
// Short links and usernames share one set of names (supabase/upgrade-clean-urls.sql),
// so a name is never both. Anything this can't answer falls through to go.html.
// Uses only the public Supabase key; the database rules decide what it may do.
import type { Context } from 'https://edge.netlify.com';

const SUPABASE_URL = 'https://agbsbbkrinewplajdwax.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eKJmkapRV3BNWNehHcRVMw_Go_JQkdg';
const NAME = /^\/([A-Za-z0-9_-]{2,40})\/?$/;
const OLD_PROFILE = /^\/@([a-z0-9_.-]{2,20})\/?$/i;
const RESERVED = new Set(['admin', 'go', 'index', 'assets', 'api', 'login', 'signup', 'dashboard', 'settings', 'help', 'about', 'terms', 'privacy', 'supabase', 'netlify']);
const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);

  const old = url.pathname.match(OLD_PROFILE);
  if (old) return Response.redirect(new URL('/' + old[1].toLowerCase(), url), 301);

  const m = url.pathname.match(NAME);
  if (!m || RESERVED.has(m[1].toLowerCase())) return context.next();
  const name = m[1];

  const ua = request.headers.get('user-agent') || '';
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  let referrer: string | null = null;
  try {
    const r = request.headers.get('referer');
    if (r) referrer = new URL(r).hostname.replace(/^www\./, '');
  } catch { /* ignore bad referrers */ }

  try {
    // 1. A short link? Every rule (password, schedule, use limit, paused/revoked) is checked here.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/open_short_link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_slug: name, p_country: context.geo?.country?.code ?? null, p_device: device, p_referrer: referrer }),
    });
    const data = res.ok ? await res.json() : null;
    if (data?.status === 'ok' && typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) {
      return new Response(null, { status: 302, headers: { Location: data.url, 'Cache-Control': 'no-store' } });
    }
    // Password, countdown, paused… need the visitor: go.html shows those screens
    if (data && data.status && data.status !== 'missing') return context.next();

    // 2. A profile page? Serve the app at this address; it opens the page itself.
    const username = name.toLowerCase();
    const page = await fetch(`${SUPABASE_URL}/rest/v1/pages?select=username&username=eq.${encodeURIComponent(username)}`, { headers });
    const rows = page.ok ? await page.json() : [];
    if (Array.isArray(rows) && rows.length) return new URL('/index.html', url);
  } catch { /* fall through to go.html */ }
  return context.next();
};

export const config = {
  path: '/*',
  excludedPath: ['/*.*', '/assets/*', '/admin', '/'],
};
