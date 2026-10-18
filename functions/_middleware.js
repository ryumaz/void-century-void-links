// Cloudflare Pages Function: clean addresses for short links and profile pages.
// (Same job as netlify/edge-functions/shortlink.ts, for hosting on Cloudflare.)
//   /abc     → short link (instant redirect, with the visitor's country)
//   /ryuma   → profile page, served by index.html while the address stays /ryuma
//   /@ryuma  → old style, permanently redirected to /ryuma
//   /admin   → staff portal (admin.html)
// Anything this can't answer is served go.html, which shows password, countdown and
// status screens. Uses only the public Supabase key; the database rules decide what it may do.

const SUPABASE_URL = 'https://agbsbbkrinewplajdwax.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eKJmkapRV3BNWNehHcRVMw_Go_JQkdg';
const NAME = /^\/([A-Za-z0-9_-]{2,40})\/?$/;
const OLD_PROFILE = /^\/@([a-z0-9_.-]{2,20})\/?$/i;
const RESERVED = new Set(['admin', 'go', 'index', 'assets', 'api', 'login', 'signup', 'dashboard', 'settings', 'help', 'about', 'terms', 'privacy', 'supabase', 'netlify', 'functions']);
const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };

// Serve one of the site's own pages while keeping the visitor's address
const page = (context, path) => context.env.ASSETS.fetch(new Request(new URL(path, context.request.url), context.request));

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Real files, the home page and the staff portal: nothing to do here
  if (path === '/' || path.includes('.') || path.startsWith('/assets/')) return context.next();
  if (path === '/admin' || path === '/admin/') return page(context, '/admin');

  const old = path.match(OLD_PROFILE);
  if (old) return Response.redirect(new URL('/' + old[1].toLowerCase(), url).toString(), 301);

  const m = path.match(NAME);
  if (m && !RESERVED.has(m[1].toLowerCase())) {
    const name = m[1];
    const ua = request.headers.get('user-agent') || '';
    const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
    let referrer = null;
    try {
      const r = request.headers.get('referer');
      if (r) referrer = new URL(r).hostname.replace(/^www\./, '');
    } catch { /* ignore bad referrers */ }

    try {
      // 1. A short link? Every rule (password, schedule, use limit, paused/revoked) is checked here.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/open_short_link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_slug: name, p_country: request.cf?.country ?? null, p_device: device, p_referrer: referrer }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.status === 'ok' && typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) {
        return new Response(null, { status: 302, headers: { Location: data.url, 'Cache-Control': 'no-store' } });
      }
      // Password, countdown, paused… need the visitor: go.html shows those screens
      if (data && data.status && data.status !== 'missing') return page(context, '/go');

      // 2. A profile page? Serve the app at this address; it opens the page itself.
      const username = name.toLowerCase();
      const p = await fetch(`${SUPABASE_URL}/rest/v1/pages?select=username&username=eq.${encodeURIComponent(username)}`, { headers });
      const rows = p.ok ? await p.json() : [];
      if (Array.isArray(rows) && rows.length) return page(context, '/');
    } catch { /* fall through to go.html */ }
    return page(context, '/go');
  }

  // Any other address: a real page if there is one, otherwise go.html
  const res = await context.next();
  return res.status === 404 ? page(context, '/go') : res;
}
