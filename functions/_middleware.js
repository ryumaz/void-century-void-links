// Cloudflare Pages Function: clean addresses for short links and profile pages.
// Two addresses, so a short link and a profile can share a name:
//   go.voids.wtf/abc → short link (instant redirect, with the visitor's country)
//   voids.wtf/ryuma  → profile page, served by index.html while the address stays /ryuma
//                      (if no profile has that name, an old-style short link there still opens)
//   voids.wtf/@ryuma → old style, permanently redirected to /ryuma
//   voids.wtf/admin  → staff portal (admin.html)
// Anything this can't answer is served go.html, which shows password, countdown and
// status screens. Uses only the public Supabase key; the database rules decide what it may do.

const SUPABASE_URL = 'https://agbsbbkrinewplajdwax.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eKJmkapRV3BNWNehHcRVMw_Go_JQkdg';
const NAME = /^\/([A-Za-z0-9_-]{2,40})\/?$/;
const OLD_PROFILE = /^\/@([a-z0-9_.-]{2,20})\/?$/i;
const RESERVED = new Set(['admin', 'go', 'index', 'assets', 'api', 'login', 'signup', 'dashboard', 'settings', 'help', 'about', 'terms', 'privacy', 'supabase', 'netlify', 'functions', 'report', 'radio']);
const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };

// Serve one of the site's own pages while keeping the visitor's address
const page = (context, path) => context.env.ASSETS.fetch(new Request(new URL(path, context.request.url), context.request));

// Open a short link. Returns a redirect, go.html for screens that need the visitor
// (password, countdown, paused…), or null when there is no such link.
async function openLink(context, name) {
  const { request } = context;
  const ua = request.headers.get('user-agent') || '';
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  let referrer = null;
  try {
    const r = request.headers.get('referer');
    if (r) referrer = new URL(r).hostname.replace(/^www\./, '');
  } catch { /* ignore bad referrers */ }
  // Every rule (password, schedule, use limit, paused/revoked) is checked in the database
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/open_short_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_slug: name, p_country: request.cf?.country ?? null, p_device: device, p_referrer: referrer }),
  });
  const data = res.ok ? await res.json() : null;
  if (data?.status === 'ok' && typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) {
    return new Response(null, { status: 302, headers: { Location: data.url, 'Cache-Control': 'no-store' } });
  }
  if (data && data.status && data.status !== 'missing') return page(context, '/go');
  return null;
}

// The profile with this name (only what a link preview needs), or null
async function findProfile(name) {
  const p = await fetch(`${SUPABASE_URL}/rest/v1/pages?select=username,name,bio,avatar_path&username=eq.${encodeURIComponent(name.toLowerCase())}`, { headers });
  const rows = p.ok ? await p.json() : [];
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// Serve the app for a profile, with a link preview card made for that person:
// sharing voids.wtf/name in WhatsApp, Discord or X shows their name, bio and photo
async function profilePage(context, profile, url) {
  const res = await page(context, '/');
  const who = (profile.name || profile.username).slice(0, 60);
  const title = `${who} (@${profile.username}) · Void Links`;
  const desc = (profile.bio || `${who}'s links, all in one place.`).slice(0, 200);
  const photo = profile.avatar_path
    ? (profile.avatar_path.startsWith('site:') ? `${url.origin}/${profile.avatar_path.slice(5)}` : `${SUPABASE_URL}/storage/v1/object/public/media/${profile.avatar_path}`)
    : `${url.origin}/assets/brand/og-image.jpg`;
  const set = (value) => ({ element(el) { el.setAttribute('content', value); } });
  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', set(desc))
    .on('meta[property="og:type"]', set('profile'))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[property="og:url"]', set(`${url.origin}/${profile.username}`))
    .on('meta[property="og:image"]', set(photo))
    .on('meta[property="og:image:width"]', { element(el) { if (profile.avatar_path) el.remove(); } })
    .on('meta[property="og:image:height"]', { element(el) { if (profile.avatar_path) el.remove(); } })
    .on('meta[property="og:image:alt"]', set(`${who}'s profile photo`))
    .on('meta[name="twitter:card"]', set(profile.avatar_path ? 'summary' : 'summary_large_image'))
    .on('meta[name="twitter:title"]', set(title))
    .on('meta[name="twitter:description"]', set(desc))
    .on('meta[name="twitter:image"]', set(photo))
    .transform(res);
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const linksHost = url.hostname.startsWith('go.');
  const mainSite = linksHost ? `https://${url.hostname.slice(3)}` : url.origin;

  // ---------- go.voids.wtf: short links only ----------
  if (linksHost) {
    // The home page's radio player lives here (its own origin, see radio.html)
    if (path === '/radio' || path === '/radio.html') return context.next();
    const m = path.match(NAME);
    if (m && !RESERVED.has(m[1].toLowerCase())) {
      try {
        const res = await openLink(context, m[1]);
        if (res) return res;
      } catch { /* fall through to go.html */ }
      return page(context, '/go');   // shows "this link doesn't exist"
    }
    // Real files (scripts, images) load as normal; everything else belongs to the main site
    if (path.startsWith('/assets/') || /\.(js|css|png|jpe?g|webp|svg|ico|glb|woff2?)$/i.test(path)) return context.next();
    return Response.redirect(mainSite + path.replace(/^\/@/, '/') + url.search, 301);
  }

  // ---------- voids.wtf ----------
  // The public API answers for itself (functions/api/v1/…), errors included
  if (path === '/api' || path.startsWith('/api/')) return context.next();
  if (path === '/' || path.startsWith('/assets/')) return context.next();
  // A dot usually means a file, but usernames may contain dots too (/john.doe):
  // if no such file exists, go.html looks the name up and opens the profile
  if (path.includes('.')) {
    const res = await context.next();
    return res.status === 404 ? page(context, '/go') : res;
  }
  if (path === '/admin' || path === '/admin/') return page(context, '/admin');

  const old = path.match(OLD_PROFILE);
  if (old) return Response.redirect(new URL('/' + old[1].toLowerCase(), url).toString(), 301);

  const m = path.match(NAME);
  if (m && !RESERVED.has(m[1].toLowerCase())) {
    try {
      // 1. A profile page? Serve the app at this address; it opens the page itself.
      const profile = await findProfile(m[1]);
      if (profile) return profilePage(context, profile, url);
      // 2. Links shared before go.voids.wtf existed (voids.wtf/abc) keep working
      const res = await openLink(context, m[1]);
      if (res) return res;
    } catch { /* fall through to go.html */ }
    return page(context, '/go');
  }

  // Any other address: a real page if there is one, otherwise go.html
  const res = await context.next();
  return res.status === 404 ? page(context, '/go') : res;
}
