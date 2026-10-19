// ===== PROFILE PAGES =====
// A link-in-bio builder: username, avatar, bio, background image/GIF/video with sound,
// links with platform or custom icons, a Spotify embed and a live Discord status card.
// Pages are stored in Supabase (table `pages`, files in the `media` bucket) through
// window.DB (backend.js), so anyone can open them at index.html#@username.
(function () {
  const t = key => (window.i18n ? window.i18n.t(key) : key);
  const $ = id => document.getElementById(id);

  const MUTE_KEY = 'lp-muted';
  const MAX_MEDIA = 40 * 1024 * 1024;
  const MAX_AUDIO = 15 * 1024 * 1024;
  const MAX_ICON = 1024 * 1024;
  const MAX_LINKS = 10;
  const USER_RE = /^[a-z0-9_.-]{2,20}$/;
  const cleanUser = v => (v || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 20);

  // ---------- storage ----------
  // The signed-in user's own page (one per account), as last loaded from the database
  let myPageCache = null;
  // Unsaved changes: a fingerprint of the editor as last saved (or loaded)
  let savedSnap = '';
  let syncing = Promise.resolve();
  const takenCache = {};   // username → owner id, from availability checks

  // ---------- icons ----------
  // fill: brand marks drawn as solid shapes; stroke: line icons (24×24 grid)
  const ICONS = {
    github: { name: 'GitHub', hosts: ['github.com'], handle: h => `github.com/${h}`,
      fill: 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z' },
    discord: { name: 'Discord', hosts: ['discord.gg', 'discord.com', 'discordapp.com'],
      handle: h => (/^\d{17,20}$/.test(h) ? `discord.com/users/${h}` : `discord.gg/${h}`),
      fill: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.128 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z' },
    x: { name: 'X', hosts: ['x.com', 'twitter.com'], handle: h => `x.com/${h}`,
      fill: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
    instagram: { name: 'Instagram', hosts: ['instagram.com'], handle: h => `instagram.com/${h}`,
      stroke: '<rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>' },
    youtube: { name: 'YouTube', hosts: ['youtube.com', 'youtu.be'], handle: h => `youtube.com/@${h}`,
      stroke: '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>' },
    spotify: { name: 'Spotify', hosts: ['open.spotify.com', 'spotify.com', 'spotify.link'], handle: h => `open.spotify.com/user/${h}`,
      stroke: '<circle cx="12" cy="12" r="10"/><path d="M7 9.6c3.4-1 6.9-.7 10 .9"/><path d="M7.6 12.9c2.9-.8 5.7-.5 8.2.9"/><path d="M8.2 16c2.2-.6 4.3-.4 6.3.6"/>' },
    tiktok: { name: 'TikTok', hosts: ['tiktok.com'], handle: h => `tiktok.com/@${h}`,
      stroke: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.3 4.4 5 4.6"/>' },
    twitch: { name: 'Twitch', hosts: ['twitch.tv'], handle: h => `twitch.tv/${h}`,
      stroke: '<path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7"/>' },
    telegram: { name: 'Telegram', hosts: ['t.me', 'telegram.me'], handle: h => `t.me/${h}`,
      stroke: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>' },
    linkedin: { name: 'LinkedIn', hosts: ['linkedin.com'], handle: h => `linkedin.com/in/${h}`,
      stroke: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>' },
    email: { name: 'Email', hosts: [], handle: h => (h.includes('@') ? `mailto:${h}` : null),
      stroke: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>' },
    website: { name: 'Website', hosts: [], handle: null,
      stroke: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>' },
  };
  const ICON_KEYS = Object.keys(ICONS);

  function iconSvg(key, size = 20) {
    const ic = ICONS[key] || ICONS.website;
    return ic.fill
      ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${ic.fill}"/></svg>`
      : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic.stroke}</svg>`;
  }
  const AUTO_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z"/></svg>';
  const UPLOAD_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  const EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';
  const MUSIC = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  // ---------- link resolving ----------
  const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
  function iconForHost(host) {
    return ICON_KEYS.find(k => ICONS[k].hosts.some(h => host === h || host.endsWith('.' + h))) || null;
  }
  function iconForLabel(label) {
    const l = (label || '').trim().toLowerCase();
    if (!l) return null;
    if (l === 'twitter') return 'x';
    if (l === 'mail' || l === 'e-mail') return 'email';
    return ICON_KEYS.find(k => k === l || ICONS[k].name.toLowerCase() === l) || null;
  }
  function normalizeUrl(raw) {
    let v = (raw || '').trim();
    if (!v) return null;
    if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v)) return v;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
    try {
      const u = new URL(v);
      if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.')) return u.href;
    } catch (_) {}
    return null;   // javascript:, data:, garbage → dropped
  }
  // Turns what the user typed into { href, icon } or null.
  // Handles plain usernames: label "Instagram" + "dsms" → https://instagram.com/dsms
  function resolveLink(link) {
    const raw = (link.url || '').trim();
    if (!raw) return null;
    const chosen = ICONS[link.icon] ? link.icon : null;
    if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(raw)) {
      return { href: 'mailto:' + raw, icon: chosen || 'email' };
    }
    const looksLikeHandle = !/[./:]/.test(raw.replace(/^@/, ''));
    if (looksLikeHandle) {
      const platform = chosen || iconForLabel(link.label);
      const build = platform && ICONS[platform].handle;
      const path = build ? build(raw.replace(/^@/, '')) : null;
      if (!path) return null;
      return { href: path.startsWith('mailto:') ? path : 'https://' + path, icon: platform };
    }
    const href = normalizeUrl(raw);
    if (!href) return null;
    return { href, icon: chosen || iconForHost(hostOf(href)) || iconForLabel(link.label) || 'website' };
  }

  function spotifyEmbed(raw) {
    const m = (raw || '').match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,40})/)
      || (raw || '').match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{10,40})$/);
    if (!m) return null;
    return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0`, height: (m[1] === 'track' || m[1] === 'episode') ? 80 : 152 };
  }

  // ---------- Discord status (Lanyard) ----------
  // Lanyard is a free public API that exposes a Discord user's live presence,
  // including what they're listening to on Spotify, once they join discord.gg/lanyard.
  const lanyardCache = new Map();
  async function lanyard(id) {
    const hit = lanyardCache.get(id);
    if (hit && Date.now() - hit.at < 25000) return hit.data;
    let data = 'error';
    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${id}`);
      const json = await res.json();
      data = json.success ? json.data : null;
    } catch (_) {}
    lanyardCache.set(id, { at: Date.now(), data });
    return data;
  }


  // ---------- Spotify "now playing" ----------
  // Uses Spotify's Authorization Code + PKCE flow, so no client secret is needed in the browser.
  // Setup: create an app at https://developer.spotify.com/dashboard, add this page's address
  // (e.g. https://voids.wtf/) as a Redirect URI, and put the Client ID in supabase-config.js.
  // It can't run from file:// because Spotify needs a web address to send you back to.
  // Until the backend exists the token lives in this browser, so only you see your live song;
  // a Supabase function holding your token will let every visitor see it.
  const SPOTIFY_CLIENT_ID = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.spotifyClientId) || '';
  const SP_KEY = 'lp-spotify';
  const SP_SCOPES = 'user-read-currently-playing user-read-playback-state';
  // Must match a Redirect URI in the Spotify app exactly: the site root (or /index.html)
  const spRedirect = () => location.origin + (/\/index\.html$/.test(location.pathname) ? location.pathname : '/');
  const spBlocker = () => (!SPOTIFY_CLIENT_ID ? 'noid' : (!/^https?:$/.test(location.protocol) ? 'file' : ''));
  const spLoad = () => { try { return JSON.parse(localStorage.getItem(SP_KEY)); } catch (_) { return null; } };
  const spSave = v => { try { v ? localStorage.setItem(SP_KEY, JSON.stringify(v)) : localStorage.removeItem(SP_KEY); } catch (_) {} };
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // Spotify login opens in its own small window (like Discord does), so the editor
  // and anything not yet published stay exactly as they are in this tab.
  const SP_PKCE = 'lp-sp-pkce';
  const spChannel = 'BroadcastChannel' in window ? new BroadcastChannel('vl-spotify') : null;
  async function spConnect() {
    // Open the window during the click (or browsers block it), then point it at Spotify
    const pw = 480, ph = 720;
    const left = Math.max(0, Math.round((screen.availWidth - pw) / 2)), top = Math.max(0, Math.round((screen.availHeight - ph) / 2));
    const win = window.open('', 'vl-spotify', `popup=yes,width=${pw},height=${ph},left=${left},top=${top}`);
    if (!win) { toast(t('b.sp_popup')); return; }
    try {
      win.document.title = 'Connecting to Spotify…';
      win.document.body.style.cssText = 'margin:0;height:100vh;display:grid;place-items:center;background:#000;color:#fff;font:500 16px Inter,Segoe UI,sans-serif';
      win.document.body.textContent = 'Connecting to Spotify…';
    } catch (_) {}
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
    // localStorage, so the Spotify window (a different tab) can read it when it comes back
    localStorage.setItem(SP_PKCE, JSON.stringify({ verifier, state, popup: true, at: Date.now() }));
    const q = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: spRedirect(),
      code_challenge_method: 'S256', code_challenge: challenge, scope: SP_SCOPES, state,
    });
    win.location.href = 'https://accounts.spotify.com/authorize?' + q;
    win.focus();
  }
  // The editor tab hears back from the Spotify window
  function spConnected(ok) {
    npCache = { at: 0, data: null };
    try { if (ok && !fNowPlaying.checked) fNowPlaying.checked = true; } catch (_) {}
    toast(t(ok ? 'toast.sp_ok' : 'toast.sp_fail'));
    update();
  }
  if (spChannel) spChannel.onmessage = e => { if (e.data && e.data.type === 'spotify') spConnected(e.data.ok); };
  window.addEventListener('storage', e => { if (e.key === SP_KEY && e.newValue && !spChannel) spConnected(true); });
  async function spToken(body) {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...body }),
    });
    if (!res.ok) throw new Error('spotify token ' + res.status);
    const j = await res.json();
    const prev = spLoad() || {};
    const v = { access: j.access_token, refresh: j.refresh_token || prev.refresh, expires: Date.now() + (j.expires_in - 60) * 1000 };
    spSave(v);
    return v;
  }
  // Coming back from Spotify's login page: swap the code for a token
  async function spHandleRedirect() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code'), state = params.get('state'), err = params.get('error');
    if (!code && !err) return false;
    let pkce = null;
    try { pkce = JSON.parse(localStorage.getItem(SP_PKCE) || sessionStorage.getItem(SP_PKCE)); } catch (_) {}
    if (!pkce || state !== pkce.state) return false;   // not ours (e.g. a social-login return)
    history.replaceState(null, '', location.pathname + location.hash);
    try { localStorage.removeItem(SP_PKCE); sessionStorage.removeItem(SP_PKCE); } catch (_) {}
    let ok = false;
    if (!err) {
      try {
        await spToken({ grant_type: 'authorization_code', code, redirect_uri: spRedirect(), code_verifier: pkce.verifier });
        ok = true;
      } catch (_) {}
    }
    if (pkce.popup) {
      // This is the Spotify window: tell the editor tab, then close
      if (spChannel) spChannel.postMessage({ type: 'spotify', ok });
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;height:100vh;display:grid;place-items:center;background:#000;color:#fff;font:500 17px Inter,Segoe UI,sans-serif;text-align:center;padding:24px';
      document.body.textContent = ok ? 'Spotify connected. You can close this window.' : "Couldn't connect Spotify. Close this window and try again.";
      setTimeout(() => window.close(), 600);
      return 'popup';
    }
    toast(t(ok ? 'toast.sp_ok' : 'toast.sp_fail'));
    return true;
  }
  async function spAccess() {
    let v = spLoad();
    if (!v) return null;
    if (Date.now() > v.expires) {
      try { v = await spToken({ grant_type: 'refresh_token', refresh_token: v.refresh }); } catch (_) { return null; }
    }
    return v.access;
  }
  let npCache = { at: 0, data: null };
  async function spNowPlaying() {
    if (Date.now() - npCache.at < 10000) return npCache.data;
    const token = await spAccess();
    let data = null;
    if (token) {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 200) {
          const j = await res.json();
          if (j.item && j.currently_playing_type === 'track') {
            const imgs = j.item.album.images || [];
            data = {
              song: j.item.name, artist: j.item.artists.map(a => a.name).join(', '),
              art: (imgs[1] || imgs[0] || {}).url || '', url: j.item.external_urls.spotify, album: j.item.album.name,
              progress: j.progress_ms, duration: j.item.duration_ms, playing: j.is_playing, at: Date.now(),
            };
          }
        }
      } catch (_) {}
    }
    npCache = { at: Date.now(), data };
    return data;
  }
  const exampleNp = () => ({ song: 'No. 1 Party Anthem', artist: 'Arctic Monkeys', art: '', duration: 243000, progress: 7000, playing: true, at: Date.now() });
  const fmtTime = ms => { const sec = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };

  // Spotify via Discord (Lanyard): what visitors can see, since it needs no login of theirs
  const fromLanyard = d => {
    if (!d || typeof d !== 'object' || !d.listening_to_spotify || !d.spotify) return null;
    const sp = d.spotify, ts = sp.timestamps || {};
    return {
      song: sp.song, artist: (sp.artist || '').replace(/; /g, ', '), album: sp.album || '', art: sp.album_art_url || '',
      url: sp.track_id ? 'https://open.spotify.com/track/' + sp.track_id : '',
      progress: ts.start ? Date.now() - ts.start : 0, duration: ts.start && ts.end ? ts.end - ts.start : 0, playing: true, at: Date.now(),
    };
  };
  // Lyrics: lines of text with a music note (karaoke), not a microphone
  const SVG_LYRICS = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11M3 11h11M3 16h6"/><path d="M17 18V8l4-1.5"/><circle cx="15" cy="18" r="2"/></svg>';
  const SVG_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
  // A CD with the album art printed on it; spins while the song plays
  function discEl(np, big) {
    const wrap = el('div', 'np-disc-wrap' + (big ? ' big' : ''));
    const disc = el('div', 'np-disc' + (np.playing ? ' spin' : ''));
    if (np.art) disc.style.setProperty('--art', `url("${np.art.replace(/"/g, '%22')}")`);
    else disc.classList.add('no-art');
    disc.appendChild(el('span', 'np-hole'));
    wrap.append(disc, el('span', 'np-sheen'));
    return wrap;
  }

  function renderNowPlaying(box, np, example) {
    box.textContent = '';
    box.classList.toggle('np-example', !!example);
    const top = el('div', 'np-top');
    const label = el('p', 'np-head');
    label.innerHTML = iconSvg('spotify', 14);
    label.appendChild(document.createTextNode(' ' + t(example ? 'np.example' : 'np.listening')));
    top.append(label);
    if (!example) {
      const lyr = el('button', 'np-btn');
      lyr.type = 'button';
      lyr.innerHTML = SVG_LYRICS;
      lyr.title = 'Lyrics';
      lyr.setAttribute('aria-label', 'Show lyrics');
      lyr.addEventListener('click', () => openLyrics(box));
      top.appendChild(lyr);
      if (np.url) {
        const open = el('a', 'np-btn');
        open.href = np.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
        open.innerHTML = SVG_OPEN; open.title = 'Open in Spotify';
        open.setAttribute('aria-label', 'Open in Spotify');
        top.appendChild(open);
      }
    }
    const row = el('div', 'np-row');
    const disc = discEl(np);
    if (!example) { disc.title = 'Show lyrics'; disc.addEventListener('click', () => openLyrics(box)); }
    const info = el('div', 'np-info');
    let song = el('strong', 'np-song', np.song);
    if (np.url) { song = el('a', 'np-song', np.song); song.href = np.url; song.target = '_blank'; song.rel = 'noopener noreferrer'; }
    const bar = el('div', 'np-bar');
    const fill = el('span');
    bar.appendChild(fill);
    const cur = el('span');
    const times = el('div', 'np-times');
    times.append(cur, el('span', '', fmtTime(np.duration)));
    info.append(song, el('span', 'np-artist', np.artist));
    if (np.album && np.album !== np.song) info.appendChild(el('span', 'np-album', np.album));
    info.append(bar, times);
    row.append(disc, info);
    box.append(top, row);
    box._np = { ...np, fill, cur };
    tickNp(box);
  }
  function tickNp(box) {
    const n = box._np;
    if (!n || !n.duration) return;
    const pos = Math.min(n.duration, n.progress + (n.playing ? Date.now() - n.at : 0));
    n.fill.style.width = (pos / n.duration * 100).toFixed(2) + '%';
    n.cur.textContent = fmtTime(pos);
  }

  // ---------- lyrics (LRCLIB: free, open, time-synced lyrics) ----------
  const lyricsCache = new Map();
  async function fetchLyrics(np) {
    const key = (np.artist + '|' + np.song).toLowerCase();
    if (lyricsCache.has(key)) return lyricsCache.get(key);
    // Artist names can contain commas ("Peter, Paul and Mary", "Tyler, The Creator"), and
    // Spotify also joins several artists with commas, so try the full name first, then the first artist
    const full = np.artist.trim();
    const first = full.split(',')[0].trim();
    const secs = np.duration ? Math.round(np.duration / 1000) : 0;
    // Prefer time-synced lyrics from the version whose length is closest to this song
    const pick = list => {
      const ok = (list || []).filter(x => x && (x.syncedLyrics || x.plainLyrics));
      const near = x => (secs && x.duration ? Math.abs(x.duration - secs) : 0);
      ok.sort((a, b) => (!!b.syncedLyrics - !!a.syncedLyrics) || near(a) - near(b));
      return ok[0] || null;
    };
    const search = async params => {
      const r = await fetch('https://lrclib.net/api/search?' + new URLSearchParams(params));
      return r.ok ? r.json() : [];
    };
    let out = null;
    try {
      const exact = new URLSearchParams({ track_name: np.song, artist_name: full });
      if (np.album) exact.set('album_name', np.album);
      if (secs) exact.set('duration', String(secs));
      const r = await fetch('https://lrclib.net/api/get?' + exact);
      if (r.ok) out = await r.json();
      // No timestamps on the exact match? Look for a version that has them
      if (!out || !out.syncedLyrics) {
        const tries = [{ track_name: np.song, artist_name: full }];
        if (first && first !== full) tries.push({ track_name: np.song, artist_name: first });
        tries.push({ q: np.song + ' ' + full });
        for (const params of tries) {
          const found = pick(await search(params));
          if (found && (found.syncedLyrics || !out)) out = found;
          if (out && out.syncedLyrics) break;
        }
      }
    } catch (_) { out = 'error'; }
    const lines = [];
    if (out && out !== 'error' && out.syncedLyrics) {
      out.syncedLyrics.split('\n').forEach(line => {
        const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
        if (m) lines.push({ t: (+m[1] * 60 + +m[2]) * 1000, text: m[3].trim() });
      });
    }
    const res = out === 'error' ? { error: true } : lines.length ? { synced: lines } : out && out.plainLyrics ? { plain: out.plainLyrics.split('\n') } : { none: true };
    if (!res.error) lyricsCache.set(key, res);
    return res;
  }

  let lyr = null;   // the open viewer
  const SVG_ZOOM_IN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const SVG_ZOOM_OUT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  function lyricsShell() {
    if (document.getElementById('lyr')) return document.getElementById('lyr');
    const v = el('div', 'lyr');
    v.id = 'lyr';
    v.hidden = true;
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-modal', 'true');
    v.setAttribute('aria-label', 'Lyrics');
    v.innerHTML = `<div class="lyr-bg"></div>
      <div class="lyr-stage">
        <div class="lyr-box">
          <div class="lyr-head">
            <button type="button" class="lyr-icon" data-act="zoom" title="Full screen" aria-label="Full screen">${SVG_ZOOM_IN}</button>
            <div class="lyr-title"><span class="lyr-mini"></span><div class="lyr-tt"><strong></strong><span></span></div></div>
            <a class="lyr-icon lyr-sp" target="_blank" rel="noopener noreferrer" title="Play on Spotify" aria-label="Play on Spotify">${iconSvg('spotify', 18)}</a>
            <button type="button" class="lyr-icon" data-act="close" title="Close" aria-label="Close lyrics"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
          <div class="lyr-lines" tabindex="0"></div>
          <div class="lyr-foot"><span class="lyr-cur">0:00</span><div class="lyr-bar"><i></i></div><span class="lyr-left">-0:00</span></div>
        </div>
      </div>`;
    v.addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'close') closeLyrics();
      else if (a && a.dataset.act === 'zoom') setZoom(!v.classList.contains('max'));
      else if (e.target === v || e.target.classList.contains('lyr-bg') || e.target.classList.contains('lyr-stage')) closeLyrics();
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !lyr) return;
      if (v.classList.contains('max') && !document.fullscreenElement) setZoom(false); else if (!document.fullscreenElement) closeLyrics();
    });
    // Leaving the browser's full screen (Esc) zooms back out too
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && v.classList.contains('max')) setZoom(false, true); });
    document.body.appendChild(v);
    return v;
  }
  // Zoom in: the lyrics fill the whole window (and the screen, where the browser allows it)
  function setZoom(on, fromBrowser) {
    const v = document.getElementById('lyr');
    v.classList.toggle('max', on);
    const btn = v.querySelector('[data-act="zoom"]');
    btn.innerHTML = on ? SVG_ZOOM_OUT : SVG_ZOOM_IN;
    btn.title = on ? 'Exit full screen' : 'Full screen';
    btn.setAttribute('aria-label', btn.title);
    if (!fromBrowser) {
      if (on && v.requestFullscreen && !document.fullscreenElement) v.requestFullscreen().catch(() => {});
      if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    // Re-centre the current line once the window has finished resizing
    if (lyr) setTimeout(() => { if (lyr) { lyr.idx = -2; tickLyrics(); } }, 500);
  }
  function closeLyrics() {
    const v = document.getElementById('lyr');
    if (!v || !lyr) return;
    cancelAnimationFrame(lyr.raf); clearInterval(lyr.poll);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    v.classList.remove('max');
    v.hidden = true;
    document.body.classList.remove('lyr-open');
    const back = lyr.box && lyr.box.querySelector('.np-btn');
    lyr = null;
    if (back) back.focus({ preventScroll: true });
  }
  async function openLyrics(box) {
    const np = box._np;
    if (!np) return;
    const v = lyricsShell();
    v.hidden = false;
    v.classList.remove('max');
    setZoom(false, true);
    document.body.classList.add('lyr-open');
    if (lyr) { cancelAnimationFrame(lyr.raf); clearInterval(lyr.poll); }
    lyr = { box, np, key: '', lines: null, idx: -2 };
    await showTrack(np);
    const loop = () => { if (!lyr) return; tickLyrics(); lyr.raf = requestAnimationFrame(loop); };
    lyr.raf = requestAnimationFrame(loop);
    // Follow the song: re-read what's playing every 15 s
    lyr.poll = setInterval(async () => {
      if (!lyr || !lyr.box._refresh) return;
      const fresh = await lyr.box._refresh();
      if (fresh && lyr) { lyr.np = fresh; if ((fresh.artist + fresh.song) !== lyr.key) showTrack(fresh); }
    }, 15000);
    v.querySelector('[data-act="close"]').focus({ preventScroll: true });
  }
  async function showTrack(np) {
    const v = document.getElementById('lyr');
    lyr.key = np.artist + np.song;
    lyr.np = np;
    lyr.idx = -2;
    v.querySelector('.lyr-tt strong').textContent = np.song;
    v.querySelector('.lyr-tt span').textContent = np.artist;
    v.querySelector('.lyr-bg').style.backgroundImage = np.art ? `url("${np.art.replace(/"/g, '%22')}")` : '';
    const mini = v.querySelector('.lyr-mini');
    mini.textContent = '';
    mini.appendChild(discEl(np, false));
    const sp = v.querySelector('.lyr-sp');
    sp.hidden = !np.url;
    if (np.url) sp.href = np.url;
    const box = v.querySelector('.lyr-lines');
    box.className = 'lyr-lines';
    box.innerHTML = '<p class="lyr-msg">Loading lyrics…</p>';
    const res = await fetchLyrics(np);
    if (!lyr || lyr.key !== np.artist + np.song) return;
    box.textContent = '';
    if (res.synced) {
      lyr.lines = res.synced;
      res.synced.forEach(l => box.appendChild(el('p', 'lyr-line' + (l.text ? '' : ' gap'), l.text || '♪')));
    } else if (res.plain) {
      lyr.lines = null;
      box.classList.add('plain');
      res.plain.forEach(text => box.appendChild(el('p', 'lyr-line', text || ' ')));
      box.appendChild(el('p', 'lyr-msg', 'These lyrics are not time-synced.'));
    } else {
      lyr.lines = null;
      box.appendChild(el('p', 'lyr-msg', res.error ? "Couldn't load lyrics. Check your connection." : 'No lyrics found for this song.'));
    }
    box.scrollTop = 0;
  }
  function tickLyrics() {
    if (!lyr) return;
    const v = document.getElementById('lyr');
    const n = lyr.np;
    const pos = Math.min(n.duration || Infinity, n.progress + (n.playing ? Date.now() - n.at : 0));
    if (n.duration) {
      v.querySelector('.lyr-bar i').style.width = (pos / n.duration * 100).toFixed(2) + '%';
      v.querySelector('.lyr-cur').textContent = fmtTime(pos);
      v.querySelector('.lyr-left').textContent = '-' + fmtTime(n.duration - pos);
    }
    if (!lyr.lines) return;
    const lines = lyr.lines;
    let i = -1;
    for (let k = 0; k < lines.length; k++) { if (lines[k].t <= pos + 120) i = k; else break; }
    const box = v.querySelector('.lyr-lines');
    if (i !== lyr.idx) {
      lyr.idx = i;
      [...box.children].forEach((p, k) => { p.classList.toggle('on', k === i); p.classList.toggle('past', k < i); if (k !== i) p.style.removeProperty('--p'); });
      const cur = box.children[Math.max(0, i)];
      if (cur) box.scrollTo({ top: cur.offsetTop - box.clientHeight / 2 + cur.clientHeight / 2, behavior: 'smooth' });
    }
    // Karaoke fill: sweep the current line until the next one starts
    if (i >= 0) {
      const start = lines[i].t, end = lines[i + 1] ? lines[i + 1].t : start + 5000;
      const p = Math.max(0, Math.min(1, (pos - start) / Math.max(400, Math.min(end - start, 9000) - 250)));
      const cur = box.children[i];
      if (cur) cur.style.setProperty('--p', (p * 100).toFixed(1) + '%');
    }
  }
  setInterval(() => document.querySelectorAll('.pc-np:not([hidden])').forEach(tickNp), 1000);

  // ---------- DOM helpers ----------
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const toast = msg => (typeof showToast === 'function' ? showToast(msg) : null);
  // Shareable page address: yoursite/@name once hosted, or a #@name link locally
  const pageUrl = user => (window.DB ? DB.pageUrl(user) : `${location.href.split('#')[0]}#@${user}`);
  const uid = () => Math.random().toString(36).slice(2, 10);
  // currentUser is a top-level `let` in index.html, so it isn't on window
  const me = () => (typeof currentUser !== 'undefined' ? currentUser : null);

  // ---------- rendering (shared by preview, demo and full page) ----------
  // data:  { username, name, bio, dim, layout, links, views, spotify, discordId }
  // media: { avatarUrl, bgUrl, bgType, icons: { [linkId]: url } }
  // opts:  { discord: <lanyard-like object> } to show a static status (demo)
  function ensureCard(root) {
    const card = root.querySelector('.profile-card');
    if (!card.dataset.ready) {
      card.dataset.ready = '1';
      card.innerHTML = `
        <div class="pc-avatar"></div>
        <h3 class="pc-name"></h3>
        <p class="pc-handle"></p>
        <p class="pc-bio"></p>
        <div class="pc-discord" hidden></div>
        <div class="pc-np" hidden></div>
        <div class="pc-links"></div>
        <div class="pc-spotify" hidden></div>`;
    }
    return card;
  }

  // ---------- background trim: black bars inside the file itself ----------
  // Some clips and pictures have letterbox bars baked in, so even a full-screen "cover" shows
  // black strips. Look at a few frames, find the edges that stay black, and zoom in just
  // enough to hide them. Only small bars are trimmed, so real content never gets cut off.
  const TRIM_MAX = 1.35;               // never zoom in more than this
  const trimCanvas = document.createElement('canvas');
  function measureBars(src) {
    const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight;
    if (!sw || !sh) return null;
    const w = 96, h = Math.max(8, Math.round(w * sh / sw));
    trimCanvas.width = w; trimCanvas.height = h;
    const ctx = trimCanvas.getContext('2d', { willReadFrequently: true });
    let px;
    try { ctx.drawImage(src, 0, 0, w, h); px = ctx.getImageData(0, 0, w, h).data; } catch (e) { return null; }
    // Is this row (or column) black? Allow a few noisy pixels from video compression
    const dark = (x, y, dx, dy, n) => {
      let sum = 0, bright = 0;
      for (let i = 0; i < n; i++) {
        const o = ((y + dy * i) * w + x + dx * i) * 4;
        const l = px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11;
        sum += l;
        if (l > 30) bright++;
      }
      return sum / n < 14 && bright <= n * 0.03;
    };
    let t = 0, b = 0, l = 0, r = 0;
    while (t < h && dark(0, t, 1, 0, w)) t++;
    if (t === h) return null;          // an all-black frame (a fade, or not drawn yet)
    while (b < h - t && dark(0, h - 1 - b, 1, 0, w)) b++;
    while (l < w && dark(l, 0, 0, 1, h)) l++;
    while (r < w - l && dark(w - 1 - r, 0, 0, 1, h)) r++;
    // The row where a bar ends is half black: take one more so no thin line is left
    const edge = (n, of) => (n ? Math.min(n + 1, of) / of : 0);
    return { t: edge(t, h), b: edge(b, h), l: edge(l, w), r: edge(r, w), w: sw, h: sh };
  }
  function applyTrim(bg) {
    const wrap = bg.querySelector('.bg-trim'), m = bg._bars;
    if (!wrap) return;
    let tf = '';
    const W = bg.clientWidth, H = bg.clientHeight;
    if (m && W && H) {
      // Where the picture (without its bars) lands once "cover" has sized it
      const s0 = Math.max(W / m.w, H / m.h), vw = m.w * s0, vh = m.h * s0;
      const ox = (W - vw) / 2, oy = (H - vh) / 2;
      const x0 = ox + m.l * vw, x1 = ox + (1 - m.r) * vw, y0 = oy + m.t * vh, y1 = oy + (1 - m.b) * vh;
      const k = Math.max(1, W / (x1 - x0), H / (y1 - y0));
      if (k > 1.004 && k <= TRIM_MAX) {
        const tx = W / 2 - k * (x0 + x1) / 2, ty = H / 2 - k * (y0 + y1) / 2;
        tf = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${k.toFixed(4)})`;
      }
    }
    wrap.style.transform = tf;
  }
  const trimObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(es => es.forEach(e => applyTrim(e.target))) : null;
  function watchBars(bg, media) {
    bg._bars = null;
    const take = () => {
      if (!media.isConnected) return;
      const m = measureBars(media), p = bg._bars;
      if (!m) return;
      // Keep the smallest bars seen: real bars are on every frame, a dark scene is not
      bg._bars = p ? { ...m, t: Math.min(p.t, m.t), b: Math.min(p.b, m.b), l: Math.min(p.l, m.l), r: Math.min(p.r, m.r) } : m;
      applyTrim(bg);
    };
    if (trimObserver) trimObserver.observe(bg);
    if (media.tagName !== 'VIDEO') {
      if (media.complete && media.naturalWidth) take(); else media.addEventListener('load', take, { once: true });
      return;
    }
    media.addEventListener('loadeddata', take, { once: true });
    const marks = [0.7, 2, 4.5];
    let next = 0;
    const onTime = () => {
      if (media.currentTime < marks[next]) return;
      next++;
      take();
      if (next >= marks.length) media.removeEventListener('timeupdate', onTime);
    };
    media.addEventListener('timeupdate', onTime);
  }
  // Reading pixels needs CORS (storage allows it); if a file is ever served without it, load it plainly
  function corsFallback(m, src) {
    m.addEventListener('error', () => {
      if (!m.crossOrigin || m._plain) return;
      m._plain = true;
      m.removeAttribute('crossorigin');
      m.src = src;
      if (m.tagName === 'VIDEO') m.play().catch(() => {});
    });
  }

  function renderBackground(root, media, dimPct, blurPx) {
    const bg = root.querySelector('.profile-bg');
    const dim = root.querySelector('.profile-dim');
    const src = media.bgUrl || '';
    // Only rebuild when the source changes, so videos don't restart on every keystroke
    if (bg.dataset.src !== src) {
      bg.dataset.src = src;
      bg.textContent = '';
      bg._bars = null;
      const wrap = el('div', 'bg-trim');
      bg.appendChild(wrap);
      bg.style.backgroundImage = src && media.bgType === 'video' && media.bgPosterUrl ? `url("${media.bgPosterUrl}")` : '';
      if (src && media.bgType === 'video') {
        const v = el('video');
        v.crossOrigin = 'anonymous';
        corsFallback(v, src);
        Object.assign(v, { src, muted: true, loop: true, autoplay: true, playsInline: true, preload: 'auto' });
        if (media.bgPosterUrl) v.poster = media.bgPosterUrl;
        v.disablePictureInPicture = true;
        v.setAttribute('muted', '');
        v.setAttribute('playsinline', '');
        wrap.appendChild(v);
        watchBars(bg, v);
        v.play().catch(() => {});
      } else if (src) {
        const img = el('img');
        img.crossOrigin = 'anonymous';
        corsFallback(img, src);
        img.src = src;
        img.alt = '';
        wrap.appendChild(img);
        watchBars(bg, img);
      }
    }
    root.classList.toggle('show-void', !src);
    dim.style.opacity = src ? ((dimPct ?? 35) / 100).toFixed(2) : '0';
    // Blur is set for the full screen; the small preview phone scales it down to match
    const mediaEl = bg.querySelector('video, img');
    if (mediaEl) {
      const scale = root.id === 'profile-view' ? 1 : Math.max(0.25, root.clientWidth / Math.max(window.innerWidth, 1));
      const b = (blurPx || 0) * scale;
      // A blurred picture has no fine detail, so the blur is drawn at half width and height
      // (a quarter of the pixels) and scaled back up: it looks the same, and phones keep up
      // even with a full-screen video. The 108% size hides the soft edge blur creates.
      const soft = !!b;
      const changed = mediaEl.classList.contains('bg-soft') !== soft;
      mediaEl.classList.toggle('bg-soft', soft);
      mediaEl.style.filter = soft ? `blur(${(b / 2).toFixed(1)}px)` : '';
      // Switching blur on/off resizes the layer; Chrome can keep showing the old (blurred)
      // video frame until something else repaints, so hide it for one frame to force a fresh one
      if (changed) {
        mediaEl.style.display = 'none';
        requestAnimationFrame(() => { mediaEl.style.display = ''; if (mediaEl.tagName === 'VIDEO' && mediaEl.paused) mediaEl.play().catch(() => {}); });
      }
    }
  }

  function renderDiscordCard(box, data) {
    box.textContent = '';
    if (data === 'loading') { box.appendChild(el('p', 'dc-note', '…')); return; }
    if (!data || data === 'error') {
      const row = el('div', 'dc-row');
      row.appendChild(el('span', 'dc-x', '✕'));
      const txt = el('div', 'dc-text');
      txt.appendChild(el('strong', '', data === 'error' ? t('dc.error') : t('dc.notfound')));
      const note = el('p', 'dc-note');
      note.append(t('dc.join') + ' ');
      const a = el('a', '', 'discord.gg/lanyard');
      a.href = 'https://discord.gg/lanyard';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      note.appendChild(a);
      txt.appendChild(note);
      row.appendChild(txt);
      box.appendChild(row);
      return;
    }
    const u = data.discord_user || {};
    const row = el('div', 'dc-row');
    const av = el('div', 'dc-avatar');
    if (u.avatar && u.id) {
      const img = el('img');
      img.src = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
      img.alt = '';
      av.appendChild(img);
    } else {
      av.innerHTML = iconSvg('discord', 20);
    }
    const status = ['online', 'idle', 'dnd'].includes(data.discord_status) ? data.discord_status : 'offline';
    av.appendChild(el('span', 'dc-dot dc-' + status));
    row.appendChild(av);

    const txt = el('div', 'dc-text');
    txt.appendChild(el('strong', '', u.global_name || u.display_name || u.username || 'Discord'));
    let line = t('dc.' + status);
    let art = null;
    if (data.listening_to_spotify && data.spotify) {
      line = `${t('dc.listening')} ${data.spotify.song} · ${data.spotify.artist}`;
      art = data.spotify.album_art_url || '';
    } else {
      const acts = data.activities || [];
      const game = acts.find(a => a.type === 0);
      const custom = acts.find(a => a.type === 4 && a.state);
      if (game) line = `${t('dc.playing')} ${game.name}`;
      else if (custom) line = custom.state;
    }
    txt.appendChild(el('p', 'dc-note', line));
    row.appendChild(txt);
    if (art !== null) {
      const cover = el('div', 'dc-art');
      if (art) {
        const img = el('img');
        img.src = art;
        img.alt = '';
        cover.appendChild(img);
      } else {
        cover.innerHTML = MUSIC;
      }
      row.appendChild(cover);
    }
    box.appendChild(row);
  }

  // ---------- custom cursor ----------
  // Presets are tiny SVGs; uploaded images are turned into a 32x32 PNG (the size every browser accepts).
  const svgCursor = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const CURSOR_PRESETS = {
    crosshair: svgCursor("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><g stroke-linecap='round'><path d='M16 4v7M16 21v7M4 16h7M21 16h7' stroke='black' stroke-opacity='.55' stroke-width='3.5'/><path d='M16 4v7M16 21v7M4 16h7M21 16h7' stroke='white' stroke-width='1.5'/></g><circle cx='16' cy='16' r='1.7' fill='white' stroke='black' stroke-opacity='.5'/></svg>") + ' 16 16, crosshair',
  };
  function cursorCss(data, url) {
    if (!data) return '';
    if (data.cursor === 'custom' && url) return `url("${url}") ${data.cursorHotspot === 'center' ? '16 16' : '0 0'}, auto`;
    return CURSOR_PRESETS[data.cursor] || '';
  }
  function applyCursor(root, css) {
    root.classList.toggle('has-cursor', !!css);
    if (css) root.style.setProperty('--page-cursor', css);
    else root.style.removeProperty('--page-cursor');
  }
  // Any image -> 32x32 transparent PNG, centred and scaled to fit
  async function makeCursor(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const iw = img.naturalWidth || 32, ih = img.naturalHeight || 32;
      const k = Math.min(32 / iw, 32 / ih);
      const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, Math.round((32 - w) / 2), Math.round((32 - h) / 2), w, h);
      return await new Promise(r => c.toBlob(r, 'image/png'));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function renderProfile(root, data, media, opts = {}) {
    renderBackground(root, media, data.dim, data.blur);
    applyCursor(root, cursorCss(data, media.cursorUrl || data.cursorUrl));
    const card = ensureCard(root);

    const avatar = card.querySelector('.pc-avatar');
    avatar.textContent = '';
    if (media.avatarUrl) {
      const img = el('img');
      img.src = media.avatarUrl;
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = (data.name || data.username || '?').trim().charAt(0).toUpperCase() || '?';
    }
    card.querySelector('.pc-name').textContent = data.name || t('b.name_ph');

    const handle = card.querySelector('.pc-handle');
    handle.textContent = '@' + (data.username || 'you');
    if (data.views !== undefined) {
      const views = el('span', 'pc-views');
      views.innerHTML = EYE;
      views.appendChild(document.createTextNode(` ${Number(data.views).toLocaleString()} ${t(data.views === 1 ? 'b.view' : 'b.views')}`));
      handle.appendChild(views);
    }
    const bio = card.querySelector('.pc-bio');
    bio.textContent = data.bio || '';
    bio.hidden = !data.bio;

    // Discord status
    const dBox = card.querySelector('.pc-discord');
    const discordId = (data.discordId || '').trim();
    if (opts.discord) {
      dBox.hidden = false;
      renderDiscordCard(dBox, opts.discord);
    } else if (/^\d{17,20}$/.test(discordId)) {
      dBox.hidden = false;
      if (dBox.dataset.id !== discordId) {
        dBox.dataset.id = discordId;
        renderDiscordCard(dBox, 'loading');
      }
      lanyard(discordId).then(d => {
        if (dBox.dataset.id !== discordId) return;
        renderDiscordCard(dBox, d);
        if (opts.onDiscord) opts.onDiscord(d);
      });
    } else {
      dBox.hidden = true;
      dBox.dataset.id = '';
    }

    // Spotify now playing (owner opted in)
    const npBox = card.querySelector('.pc-np');
    npBox.dataset.want = data.nowPlaying ? '1' : '';
    if (!data.nowPlaying) {
      npBox.hidden = true;
    } else {
      const readNp = async () => {
        let np = await spNowPlaying();
        if (!np && /^\d{17,20}$/.test(discordId)) np = fromLanyard(await lanyard(discordId));
        return np;
      };
      npBox._refresh = readNp;
      readNp().then(np => {
        if (!npBox.dataset.want) return;
        if (np) { npBox.hidden = false; renderNowPlaying(npBox, np, false); }
        else if (opts.preview) { npBox.hidden = false; renderNowPlaying(npBox, exampleNp(), true); }
        else npBox.hidden = true;
      });
    }

    // Links
    const list = card.querySelector('.pc-links');
    list.textContent = '';
    const asIcons = data.layout === 'icons';
    list.classList.toggle('as-icons', asIcons);
    (data.links || []).forEach(l => {
      const r = resolveLink(l);
      if (!r) return;
      const a = el('a', asIcons ? 'pc-icon' : 'pc-link');
      a.href = r.href;
      if (!r.href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      const label = l.label || ICONS[r.icon]?.name || hostOf(r.href);
      const customUrl = l.icon === 'custom' && media.icons && media.icons[l.id];
      const glyph = el('span', asIcons ? 'pc-icon-glyph' : 'pc-link-icon');
      if (customUrl) {
        const img = el('img');
        img.src = customUrl;
        img.alt = '';
        glyph.appendChild(img);
      } else {
        glyph.innerHTML = iconSvg(r.icon, asIcons ? 30 : 18);
      }
      a.appendChild(glyph);
      if (asIcons) {
        a.title = label;
        a.setAttribute('aria-label', label);
      } else {
        a.appendChild(el('span', 'pc-link-label', label));
        a.insertAdjacentHTML('beforeend', ARROW);
      }
      list.appendChild(a);
    });

    // Spotify embed (rebuilt only when the link changes)
    const sBox = card.querySelector('.pc-spotify');
    const embed = spotifyEmbed(data.spotify);
    if (!embed) {
      sBox.hidden = true;
      sBox.textContent = '';
      sBox.dataset.src = '';
    } else if (sBox.dataset.src !== embed.src) {
      sBox.hidden = false;
      sBox.dataset.src = embed.src;
      sBox.textContent = '';
      const f = el('iframe');
      Object.assign(f, { src: embed.src, height: embed.height, loading: 'lazy', title: 'Spotify' });
      f.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
      f.setAttribute('frameborder', '0');
      sBox.appendChild(f);
    }
  }

  // ---------- segmented controls ----------
  function seg(root, value) {
    root.querySelectorAll('button[data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === value));
  }
  const segValue = root => (root.querySelector('button[aria-pressed="true"]') || root.querySelector('button[data-v]')).dataset.v;

  // ---------- builder ----------
  const builder = document.querySelector('.builder');
  const form = $('builder-form');
  if (!builder || !form) return;
  const home = builder.parentElement;
  const phone = $('pb-phone');
  const fUser = $('pb-username'), fName = $('pb-name'), fBio = $('pb-bio'), fDim = $('pb-dim');
  const fAvatar = $('pb-avatar'), fBg = $('pb-bg'), drop = $('pb-drop');
  const fAudio = $('pb-audio'), fVolume = $('pb-volume'), fSpotify = $('pb-spotify'), fDiscord = $('pb-discord');
  const fBlur = $('pb-blur'), fNowPlaying = $('pb-nowplaying');
  const segSound = $('pb-sound'), segLayout = $('pb-layout');
  const segCursor = $('pb-cursor'), segCursorHot = $('pb-cursor-hot'), fCursor = $('pb-cursor-file');
  const linksBox = $('pb-links');

  // Each media slot is either a new local file (Blob, not uploaded yet) or a file
  // already in storage ({ url, path }). Uploads happen on Publish.
  const draft = {
    avatarBlob: null, avatarUrl: '', avatarPath: null,
    bgBlob: null, bgUrl: '', bgPath: null, bgType: '', bgName: '',
    bgPosterBlob: null, bgPosterUrl: '', bgPosterPath: null,   // still frame of a video background
    audioBlob: null, audioUrl: '', audioPath: null, audioName: '',
    cursorBlob: null, cursorUrl: '', cursorPath: null,
    icons: {},          // linkId → { blob, url, path }
  };
  const revoke = url => { if (url && url.startsWith('blob:')) URL.revokeObjectURL(url); };

  function setBlob(kind, blob, name, remote) {
    revoke(draft[kind + 'Url']);
    draft[kind + 'Blob'] = blob || null;
    draft[kind + 'Url'] = blob ? URL.createObjectURL(blob) : (remote ? remote.url : '');
    draft[kind + 'Path'] = !blob && remote ? remote.path : null;
    const has = !!(blob || remote);
    if (kind === 'bg') {
      draft.bgType = blob ? (blob.type.startsWith('video/') ? 'video' : 'image') : (remote ? remote.type || 'image' : '');
      draft.bgName = has ? (name || draft.bgType) : '';
      // A new background replaces its still frame; a stored one brings its own back
      revoke(draft.bgPosterUrl);
      draft.bgPosterBlob = null;
      draft.bgPosterUrl = remote && remote.posterUrl ? remote.posterUrl : '';
      draft.bgPosterPath = remote && remote.posterPath ? remote.posterPath : null;
      if (blob && draft.bgType === 'video') {
        const forBlob = blob;
        makePoster(blob).then(p => {
          if (!p || draft.bgBlob !== forBlob) return;
          draft.bgPosterBlob = p;
          draft.bgPosterUrl = URL.createObjectURL(p);
        });
      }
    }
    if (kind === 'audio') draft.audioName = has ? (name || 'audio') : '';
  }
  // First frame of a video (max 1280px, WebP), shown while the video itself downloads
  function makePoster(blob) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const v = document.createElement('video');
      let finished = false;
      const done = b => { if (finished) return; finished = true; URL.revokeObjectURL(url); v.removeAttribute('src'); resolve(b || null); };
      Object.assign(v, { muted: true, playsInline: true, preload: 'auto', src: url });
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.3, (v.duration || 1) / 2); } catch (_) { done(null); } };
      v.onseeked = () => {
        try {
          const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight, 1));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(v.videoWidth * k));
          c.height = Math.max(1, Math.round(v.videoHeight * k));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          c.toBlob(done, 'image/webp', 0.82);
        } catch (_) { done(null); }
      };
      v.onerror = () => done(null);
      setTimeout(() => done(null), 10000);
    });
  }
  function setIcon(id, blob, remote) {
    if (draft.icons[id]) revoke(draft.icons[id].url);
    if (blob) draft.icons[id] = { blob, url: URL.createObjectURL(blob), path: null };
    else if (remote) draft.icons[id] = { blob: null, url: remote.url, path: remote.path };
    else delete draft.icons[id];
  }
  const iconUrls = () => Object.fromEntries(Object.entries(draft.icons).map(([k, v]) => [k, v.url]));

  // --- link rows ---
  let openMenu = null;
  function closeIconMenu() {
    if (openMenu) { openMenu.remove(); openMenu = null; }
  }
  document.addEventListener('click', e => {
    if (openMenu && !e.target.closest('.icon-menu, .icon-pick')) closeIconMenu();
  });

  function paintIconButton(row) {
    const btn = row.querySelector('.icon-pick');
    const link = rowLink(row);
    const r = resolveLink(link);
    if (link.icon === 'custom' && draft.icons[link.id]) {
      btn.innerHTML = '';
      const img = el('img');
      img.src = draft.icons[link.id].url;
      img.alt = '';
      btn.appendChild(img);
    } else if (ICONS[link.icon]) {
      btn.innerHTML = iconSvg(link.icon, 18);
    } else {
      btn.innerHTML = r ? iconSvg(r.icon, 18) : AUTO_SVG;
    }
    btn.title = t('b.icon');
  }

  function showIconMenu(row) {
    closeIconMenu();
    const menu = el('div', 'icon-menu');
    menu.setAttribute('role', 'menu');
    const add = (key, html, title) => {
      const b = el('button');
      b.type = 'button';
      b.innerHTML = html;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.dataset.icon = key;
      if ((row.dataset.icon || 'auto') === key) b.classList.add('on');
      menu.appendChild(b);
    };
    add('auto', AUTO_SVG, t('b.icon_auto'));
    ICON_KEYS.forEach(k => add(k, iconSvg(k, 18), ICONS[k].name));
    add('custom', UPLOAD_SVG, t('b.icon_upload'));
    menu.addEventListener('click', e => {
      const b = e.target.closest('button[data-icon]');
      if (!b) return;
      if (b.dataset.icon === 'custom') {
        row.querySelector('.icon-file').click();
      } else {
        row.dataset.icon = b.dataset.icon;
        setIcon(row.dataset.id, null);
        update();
      }
      closeIconMenu();
    });
    row.appendChild(menu);
    openMenu = menu;
  }

  function linkRow(link = {}) {
    const row = el('div', 'link-row-edit');
    row.dataset.id = link.id || uid();
    row.dataset.icon = link.icon || 'auto';
    const pick = el('button', 'icon-pick');
    pick.type = 'button';
    pick.setAttribute('aria-haspopup', 'menu');
    pick.addEventListener('click', e => { e.stopPropagation(); openMenu && openMenu.parentElement === row ? closeIconMenu() : showIconMenu(row); });
    const file = el('input', 'icon-file');
    Object.assign(file, { type: 'file', accept: 'image/*', hidden: true });
    file.setAttribute('aria-label', 'Upload a custom icon for this link');
    file.addEventListener('change', () => {
      const f = file.files[0];
      if (!f || !f.type.startsWith('image/')) return;
      if (f.size > MAX_ICON) { toast(t('toast.icon')); return; }
      row.dataset.icon = 'custom';
      setIcon(row.dataset.id, f);
      update();
    });
    const label = el('input', 'link-label');
    Object.assign(label, { type: 'text', maxLength: 40, value: link.label || '', placeholder: t('b.label_ph') });
    label.setAttribute('aria-label', t('b.label_ph'));
    label.dataset.i18nPh = 'b.label_ph';
    const url = el('input', 'link-url');
    Object.assign(url, { type: 'text', value: link.url || '', placeholder: t('b.url_ph') });
    url.dataset.i18nPh = 'b.url_ph';
    url.setAttribute('aria-label', 'URL');
    url.spellcheck = false;
    const remove = el('button', 'link-remove', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', t('b.remove'));
    remove.addEventListener('click', () => { setIcon(row.dataset.id, null); row.remove(); update(); });
    const note = el('p', 'row-note');
    row.append(pick, label, url, remove, note, file);
    return row;
  }
  function addLink(link) {
    if (linksBox.children.length >= MAX_LINKS) return null;
    const row = linkRow(link);
    linksBox.appendChild(row);
    return row;
  }
  function rowLink(row) {
    return {
      id: row.dataset.id,
      icon: row.dataset.icon || 'auto',
      label: row.querySelector('.link-label').value.trim(),
      url: row.querySelector('.link-url').value.trim(),
    };
  }
  const readLinks = () => [...linksBox.children].map(rowLink).filter(l => l.url);

  function paintRows() {
    [...linksBox.children].forEach(row => {
      const link = rowLink(row);
      const note = row.querySelector('.row-note');
      const r = link.url ? resolveLink(link) : null;
      row.classList.toggle('invalid', !!link.url && !r);
      if (link.url && !r) {
        note.textContent = t('b.link_bad');
      } else if (r && r.href.replace(/^https:\/\//, '').replace(/\/$/, '') !== link.url.replace(/^https?:\/\//, '').replace(/\/$/, '')) {
        note.textContent = '→ ' + r.href.replace(/^https:\/\//, '').replace(/^mailto:/, '');
      } else {
        note.textContent = '';
      }
      note.hidden = !note.textContent;
      paintIconButton(row);
    });
    const full = linksBox.children.length >= MAX_LINKS;
    const addBtn = $('pb-add-link');
    addBtn.disabled = full;
    addBtn.textContent = full ? t('b.links_max') : t('b.addlink');
  }

  function currentData() {
    const username = cleanUser(fUser.value);
    const existing = myPageCache && myPageCache.username === username ? myPageCache : null;
    return {
      username,
      name: fName.value.trim(),
      bio: fBio.value.trim(),
      dim: Number(fDim.value),
      blur: Number(fBlur.value),
      layout: segValue(segLayout),
      sound: segValue(segSound),
      volume: Number(fVolume.value),
      spotify: fSpotify.value.trim(),
      discordId: fDiscord.value.trim(),
      nowPlaying: fNowPlaying.checked,
      links: readLinks(),
      views: existing ? existing.views : 0,
      cursor: segValue(segCursor),
      cursorHotspot: segValue(segCursorHot),
      hadCursor: !!(myPageCache && myPageCache.cursor && myPageCache.cursor !== 'default'),
      hadDeco: !!(myPageCache && myPageCache.decoPath),
    };
  }

  function usernameNote() {
    const note = $('pb-username-note');
    const u = cleanUser(fUser.value);
    note.className = 'field-note';
    if (!u) { note.textContent = ''; return false; }
    if (!USER_RE.test(u)) { note.textContent = t('b.invalid'); note.classList.add('bad'); return false; }
    const mine = !!(myPageCache && myPageCache.username === u);
    if (!mine && takenCache[u] && takenCache[u] !== (me() && me().id)) {
      note.textContent = `${siteHost()}/${u} · ${t('b.taken')}`;
      note.classList.add('bad');
      return false;
    }
    note.textContent = `${siteHost()}/${u} · ${mine ? t('b.yours') : (u in takenCache ? t('b.available') : t('b.checking'))}`;
    note.classList.add('good');
    if (!mine && !(u in takenCache)) checkUsername(u);
    return true;
  }
  // Ask the database whether someone else already has this name (debounced)
  let checkTimer = null;
  function checkUsername(u) {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(async () => {
      if (!window.DB) return;
      takenCache[u] = await DB.usernameOwner(u).catch(() => null);
      if (cleanUser(fUser.value) === u) usernameNote();
    }, 350);
  }

  function update() {
    const cleaned = cleanUser(fUser.value);
    if (fUser.value !== cleaned) fUser.value = cleaned;
    usernameNote();

    $('pb-bg-name').textContent = draft.bgName;
    $('pb-tpl-strip').querySelectorAll('.tpl-tile').forEach(x => x.classList.remove('on'));
    drop.classList.toggle('has-file', !!draft.bgUrl);
    $('pb-bg-remove').hidden = !draft.bgUrl;
    $('pb-bg-note').hidden = !!draft.bgUrl;

    const av = $('pb-avatar-preview');
    av.style.backgroundImage = draft.avatarUrl ? `url("${draft.avatarUrl}")` : '';
    av.textContent = draft.avatarUrl ? '' : '+';

    // Sound
    const sound = segValue(segSound);
    $('pb-audio-drop').hidden = sound !== 'file';
    $('pb-audio-name').textContent = draft.audioName;
    $('pb-audio-drop').classList.toggle('has-file', !!draft.audioUrl);
    $('pb-volume-row').hidden = sound === 'none';
    const sNote = $('pb-sound-note');
    if (sound === 'video' && draft.bgType !== 'video') sNote.textContent = t('b.sound_needvideo');
    else if (sound === 'file' && !draft.audioUrl) sNote.textContent = t('b.sound_needfile');
    else if (sound !== 'none') sNote.textContent = t('b.sound_note');
    else sNote.textContent = '';

    // Integrations
    const sp = fSpotify.value.trim();
    $('pb-spotify-note').textContent = sp && !spotifyEmbed(sp) ? t('b.spotify_bad') : '';
    const dc = fDiscord.value.trim();
    $('pb-discord-note-bad').textContent = dc && !/^\d{17,20}$/.test(dc) ? t('b.discord_bad') : '';
    if (!/^\d{17,20}$/.test(dc)) $('pb-discord-hint').textContent = '';

    // Spotify connection
    const spOn = !!spLoad();
    const blocker = spBlocker();
    $('pb-sp-connect-label').textContent = t(spOn ? 'b.sp_disconnect' : 'b.sp_connect');
    $('pb-sp-status').textContent = spOn ? t('b.sp_connected') : '';
    $('pb-sp-help').textContent = spOn ? (fNowPlaying.checked ? t('b.sp_onlyyou') : '')
      : (blocker === 'noid' ? t('b.sp_noid') : blocker === 'file' ? t('b.sp_file') : (fNowPlaying.checked ? t('b.sp_needconnect') : ''));

    // Cursor
    const cur = segValue(segCursor);
    $('pb-cursor-custom').hidden = cur !== 'custom';
    $('pb-cursor-drop').classList.toggle('has-file', !!draft.cursorUrl);
    $('pb-cursor-swatch').style.backgroundImage = draft.cursorUrl ? `url("${draft.cursorUrl}")` : '';
    $('pb-cursor-note').textContent = cur === 'custom' && !draft.cursorUrl ? t('b.cursor_need') : cur !== 'default' ? t('b.cursor_try') : '';

    paintRows();
    renderProfile(phone, currentData(), { ...draft, icons: iconUrls() }, {
      preview: true,
      onDiscord: d => {
        $('pb-discord-hint').textContent = d && d !== 'error' && d.discord_status === 'offline' ? t('b.discord_offline') : '';
      },
    });
  }

  function acceptFile(file, kind) {
    if (!file) return;
    const ok = {
      avatar: file.type.startsWith('image/'),
      bg: file.type.startsWith('image/') || file.type === 'video/mp4' || file.type === 'video/webm',
      audio: file.type.startsWith('audio/'),
    }[kind];
    const mb = n => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
    if (!ok) {
      toast(kind === 'audio' ? 'That file type isn’t supported. Use MP3, OGG, WAV or M4A audio.'
        : kind === 'avatar' ? 'Use a JPG, PNG, GIF or WebP image for your avatar.'
        : 'That file type isn’t supported. Use JPG, PNG, GIF, WebP, MP4 or WebM (iPhone .mov videos need converting to MP4).');
      return;
    }
    const max = kind === 'audio' ? MAX_AUDIO : MAX_MEDIA;
    if (file.size > max) {
      toast(`That file is ${mb(file.size)}. The limit is ${mb(max)} for ${kind === 'audio' ? 'audio' : kind === 'avatar' ? 'avatars' : 'backgrounds'}.`);
      return;
    }
    setBlob(kind, file, file.name);
    if (kind === 'bg' && draft.bgType === 'video' && segValue(segSound) === 'none') seg(segSound, 'video');
    update();
  }

  fAvatar.addEventListener('change', () => acceptFile(fAvatar.files[0], 'avatar'));
  fBg.addEventListener('change', () => acceptFile(fBg.files[0], 'bg'));
  fAudio.addEventListener('change', () => acceptFile(fAudio.files[0], 'audio'));
  [[drop, 'bg'], [$('pb-audio-drop'), 'audio']].forEach(([zone, kind]) => {
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', e => acceptFile(e.dataTransfer.files[0], kind));
  });
  $('pb-bg-remove').addEventListener('click', () => { setBlob('bg', null); fBg.value = ''; update(); });

  // ---------- background templates ----------
  // Built in (site files) + shared by people (bg_templates). Picking one just points the page at that file.
  const BUILTIN_TEMPLATES = [
    ['void-walker', 'Void Walker'], ['snowfall-ronin', 'Snowfall ronin'], ['two-swords', 'Two swords'],
    ['halftone-city', 'Halftone city'], ['forest-sight', 'Forest sight'],
  ].map(([id, title]) => ({ id: 'site-' + id, path: `site:assets/templates/${id}.webp`, thumb: `assets/templates/${id}-thumb.webp`, kind: 'image', title, builtin: true }));
  let communityTemplates;   // undefined = not loaded, null = database not upgraded
  const tplUrl = t => (window.DB ? DB.publicUrl(t.path) : t.path.replace(/^site:/, ''));
  function tplTile(tp, opts = {}) {
    const b = el('button', 'tpl-tile' + (draft.bgPath === tp.path ? ' on' : ''));
    b.type = 'button';
    b.setAttribute('role', 'listitem');
    b.title = tp.title || t('b.tpl');
    if (tp.kind === 'video') {
      const v = el('video');
      Object.assign(v, { src: tplUrl(tp) + '#t=0.5', muted: true, preload: 'metadata', playsInline: true });
      b.appendChild(v);
    } else b.style.backgroundImage = `url("${tp.thumb || tplUrl(tp)}")`;
    b.appendChild(el('span', '', tp.title || (tp.builtin ? '' : t('b.tpl_shared'))));
    b.addEventListener('click', e => {
      if (e.target.closest('.tpl-x')) return;
      setBlob('bg', null, tp.title || t('b.tpl'), { url: tplUrl(tp), path: tp.path, type: tp.kind });
      fBg.value = '';
      if (tp.kind === 'video' && segValue(segSound) === 'none') seg(segSound, 'video');
      update();
      paintTemplates();
      if (opts.close) closeModal('tpl-modal');
      toast(t('b.tpl_picked'));
    });
    const mine = !tp.builtin && me() && tp.uploader === me().id;
    if (mine) {
      const x = el('button', 'tpl-x', '✕');
      x.type = 'button';
      x.setAttribute('aria-label', t('b.tpl_remove'));
      x.title = t('b.tpl_remove');
      x.addEventListener('click', async () => {
        if (!confirm(t('b.tpl_remove_q'))) return;
        try { await DB.removeTemplate(tp); communityTemplates = communityTemplates.filter(x2 => x2.id !== tp.id); paintTemplates(); toast(t('b.tpl_removed')); }
        catch (e2) { toast(e2.message || 'Something went wrong. Try again.'); }
      });
      b.appendChild(x);
    }
    return b;
  }
  async function loadTemplates(force) {
    if (!window.DB || (communityTemplates !== undefined && !force)) return;
    try { communityTemplates = await DB.templates(); } catch (_) { communityTemplates = []; }
    paintTemplates();
  }
  function paintTemplates() {
    const strip = $('pb-tpl-strip');
    const all = BUILTIN_TEMPLATES.concat(communityTemplates || []);
    strip.textContent = '';
    all.slice(0, 5).forEach(tp => strip.appendChild(tplTile(tp)));
    const modal = $('tpl-modal');
    if (!modal.classList.contains('active')) return;
    const bi = $('tpl-builtin'), cm = $('tpl-community');
    bi.textContent = ''; cm.textContent = '';
    BUILTIN_TEMPLATES.forEach(tp => bi.appendChild(tplTile(tp, { close: true })));
    if (communityTemplates === undefined) cm.appendChild(el('p', 'tpl-note', '…'));
    else if (communityTemplates === null) cm.appendChild(el('p', 'tpl-note', t('b.tpl_upgrade')));
    else if (!communityTemplates.length) cm.appendChild(el('p', 'tpl-note', t('b.tpl_none')));
    else communityTemplates.forEach(tp => cm.appendChild(tplTile(tp, { close: true })));
    // Sharing: needs your own background (an upload, not a template) and the upgrade
    const own = draft.bgUrl && (draft.bgBlob || (draft.bgPath && !draft.bgPath.startsWith('site:') && !/\/template-/.test(draft.bgPath)));
    const form = $('tpl-share');
    form.hidden = communityTemplates === null;
    $('tpl-share-btn').disabled = !own || !me();
    $('tpl-share-note').textContent = !me() ? t('b.tpl_need_login') : own ? t('b.tpl_share_ready') : t('b.tpl_share_need');
  }
  $('pb-tpl-more').addEventListener('click', () => {
    $('tpl-modal').classList.add('active');
    setOverlay(true);
    paintTemplates();
    loadTemplates(true);
  });
  $('tpl-share').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('tpl-share-btn');
    btn.disabled = true;
    try {
      const made = await DB.shareTemplate({ blob: draft.bgBlob, url: draft.bgUrl, kind: draft.bgType, title: $('tpl-share-title').value.trim() });
      communityTemplates = [made].concat(communityTemplates || []);
      $('tpl-share-title').value = '';
      toast(t('b.tpl_shared_ok'));
    } catch (e2) { toast(e2.message || 'Something went wrong. Try again.'); }
    paintTemplates();
  });
  paintTemplates();
  loadTemplates();
  fCursor.addEventListener('change', async () => {
    const file = fCursor.files[0];
    fCursor.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > MAX_ICON * 5) { toast(t('toast.full')); return; }
    try {
      const png = await makeCursor(file);
      setBlob('cursor', png, file.name);
      seg(segCursor, 'custom');
      update();
    } catch (_) { toast(t('b.cursor_bad')); }
  });
  [segSound, segLayout, segCursor, segCursorHot].forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    seg(s, b.dataset.v);
    update();
  }));
  $('pb-add-link').addEventListener('click', () => {
    const row = addLink();
    if (row) row.querySelector('.link-label').focus();
    update();
  });
  form.addEventListener('input', update);

  function resetBuilder() {
    form.reset();
    setBlob('bg', null);
    setBlob('avatar', null);
    setBlob('audio', null);
    setBlob('cursor', null);
    seg(segCursor, 'default');
    seg(segCursorHot, 'tip');
    Object.keys(draft.icons).forEach(id => setIcon(id, null));
    linksBox.textContent = '';
    addLink({ label: 'GitHub', icon: 'github' });
    addLink();
    seg(segSound, 'none');
    seg(segLayout, 'buttons');
    $('pb-result').hidden = true;
    update();
  }
  $('pb-reset').addEventListener('click', resetBuilder);

  $('pb-sp-connect').addEventListener('click', () => {
    if (spLoad()) {
      spSave(null);
      npCache = { at: 0, data: null };
      toast(t('toast.sp_off'));
      update();
      return;
    }
    const blocker = spBlocker();
    if (blocker) { toast(t(blocker === 'noid' ? 'b.sp_noid' : 'b.sp_file')); return; }
    spConnect();
  });

  // Photos are re-encoded to a sensible size before upload (GIFs, video and audio are left alone)
  const SHRINK = { avatar: 512, background: 2560 };
  async function shrink(blob, name) {
    const max = name.startsWith('icon-') ? 160 : SHRINK[name];
    if (!max || !/^image\/(png|jpeg|webp)$/.test(blob.type)) return blob;
    try {
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (scale === 1 && blob.size < 1.5 * 1024 * 1024) { bmp.close && bmp.close(); return blob; }
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close && bmp.close();
      const keepAlpha = blob.type === 'image/png' && name.startsWith('icon-');
      const out = await new Promise(r => c.toBlob(r, keepAlpha ? 'image/png' : 'image/webp', 0.86));
      return out && out.size < blob.size ? out : blob;
    } catch (_) { return blob; }
  }

  function editorSnap() {
    const d = currentData();
    delete d.views;
    return JSON.stringify([d, draft.avatarUrl, draft.bgUrl, draft.audioUrl, draft.cursorUrl, iconUrls()]);
  }
  function markSaved() { savedSnap = editorSnap(); }
  function isDirty() { return !!(me() && savedSnap && editorSnap() !== savedSnap); }
  // Warn before closing or reloading the tab with unsaved edits
  window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  // "Publish page" the first time; "Save changes" once the page is live
  function syncPublishBtn() {
    const btn = form && form.querySelector('button[type="submit"]');
    if (!btn || btn.disabled) return;
    btn.dataset.i18n = myPageCache ? 'b.save' : 'b.publish';
    btn.textContent = t(btn.dataset.i18n);
  }
  async function publish() {
    if (!usernameNote()) { fUser.focus(); return; }
    if (!window.DB) { toast(t('toast.offline')); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    let ok = false;
    const wasLive = !!myPageCache;
    const working = () => t(myPageCache ? 'b.saving' : 'b.publishing');
    btn.textContent = working();
    try {
      const data = currentData();
      // Only ask the server about the name if it changed
      const sameName = myPageCache && myPageCache.username === data.username;
      const owner = sameName ? null : await DB.usernameOwner(data.username);
      if (owner && owner !== me().id) {
        takenCache[data.username] = owner;
        usernameNote();
        fUser.focus();
        return;
      }
      // Upload every new file at the same time (images are shrunk first); keep stored ones
      const jobs = [];
      const queue = (name, blob) => { const job = shrink(blob, name).then(small => DB.upload(name, small)).then(r => r.path); jobs.push(job); return job; };
      const slot = (kind, name) => {
        if (draft[kind + 'Blob']) return queue(name, draft[kind + 'Blob']);
        return Promise.resolve(draft[kind + 'Url'] ? draft[kind + 'Path'] : null);
      };
      const avatarP = slot('avatar', 'avatar');
      const bgP = slot('bg', 'background');
      const audioP = data.sound === 'file' ? slot('audio', 'audio') : Promise.resolve(draft.audioUrl ? draft.audioPath : null);
      const cursorP = data.cursor === 'custom' ? slot('cursor', 'cursor') : Promise.resolve(null);
      const posterP = draft.bgType !== 'video' || !draft.bgUrl ? Promise.resolve(null)
        : draft.bgPosterBlob ? queue('background-poster', draft.bgPosterBlob)
        : Promise.resolve(draft.bgPosterUrl ? draft.bgPosterPath : null);
      const iconJobs = data.links.map(l => {
        const ic = l.icon === 'custom' ? draft.icons[l.id] : null;
        if (!ic) return Promise.resolve(null);
        return ic.blob ? queue('icon-' + l.id, ic.blob) : Promise.resolve(ic.path);
      });
      if (jobs.length) {
        let done = 0;
        btn.textContent = `${t(wasLive ? 'b.updating' : 'b.uploading')} 0/${jobs.length}`;
        jobs.forEach(j => j.then(() => { btn.textContent = `${t(wasLive ? 'b.updating' : 'b.uploading')} ${++done}/${jobs.length}`; }, () => {}));
      }
      const [avatarPath, bgPath, audioPath, cursorPath, bgPosterPath, ...iconPaths] = await Promise.all([avatarP, bgP, audioP, cursorP, posterP, ...iconJobs]);
      btn.textContent = working();
      const links = data.links.map((l, i) => ({ ...l, iconPath: iconPaths[i] }));
      const saved = await DB.savePage({ ...data, links, avatarPath, bgPath, bgType: draft.bgType, audioPath, cursorPath, bgPosterPath, hadPoster: !!(myPageCache && myPageCache.bgPosterPath) }, myPageCache);
      if (draft.bgPosterBlob) { draft.bgPosterBlob = null; draft.bgPosterPath = bgPosterPath; }
      myPageCache = saved;
      takenCache[saved.username] = me().id;
      // Keep showing the local copies (no re-download), but remember where they're stored now
      const paths = { avatar: avatarPath, bg: bgPath, audio: audioPath, cursor: cursorPath };
      Object.keys(paths).forEach(kind => { if (draft[kind + 'Blob']) { draft[kind + 'Blob'] = null; draft[kind + 'Path'] = paths[kind]; } });
      data.links.forEach((l, i) => { const ic = draft.icons[l.id]; if (ic && ic.blob) { ic.blob = null; ic.path = iconPaths[i]; } });
      $('pb-result-url').textContent = siteHost() + '/' + saved.username;
      $('pb-result').hidden = false;
      update();
      toast(t(wasLive ? 'toast.saved' : 'toast.published'));
      markSaved();
      ok = true;
      document.dispatchEvent(new CustomEvent('pagepublished', { detail: saved.username }));
    } catch (e) {
      const msg = (e && (e.message || '')) + ' ' + (e && e.code || '');
      toast(/cursor/i.test(msg) ? t('b.cursor_upgrade') : /23505|duplicate/.test(msg) ? t('b.taken_full') : /payload|size|large/i.test(msg) ? t('toast.full') : t('toast.save_fail'));
    } finally {
      btn.disabled = false;
      syncPublishBtn();
    }
    return ok;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (typeof requireAuth === 'function') requireAuth(publish, t('auth.publish'));
    else publish();
  });

  $('pb-copy').addEventListener('click', () => copyLink(cleanUser(fUser.value)));
  $('pb-open').addEventListener('click', () => {
    const go = () => { const u = cleanUser(fUser.value); if (u) location.hash = '@' + u; };
    if (isDirty() && typeof askUnsaved === 'function') askUnsaved(go); else go();
  });

  function copyLink(user) {
    if (!user) return;
    navigator.clipboard.writeText(pageUrl(user)).then(() => toast(t('toast.copied'))).catch(() => {});
  }

  // Load a saved page (from the database) into the builder
  function loadIntoBuilder(page) {
    if (!page) return false;
    fUser.value = page.username;
    fName.value = page.name || '';
    fBio.value = page.bio || '';
    fDim.value = page.dim ?? 35;
    fBlur.value = page.blur ?? 0;
    fNowPlaying.checked = !!page.nowPlaying;
    fVolume.value = page.volume ?? 60;
    fSpotify.value = page.spotify || '';
    fDiscord.value = page.discordId || '';
    seg(segSound, page.sound || 'none');
    seg(segLayout, page.layout || 'buttons');
    Object.keys(draft.icons).forEach(id => setIcon(id, null));
    linksBox.textContent = '';
    const links = (page.links || []).map(l => ({ ...l, id: l.id || uid(), icon: l.icon || 'auto' }));
    links.forEach(l => {
      addLink(l);
      if (l.icon === 'custom' && l.iconUrl) setIcon(l.id, null, { url: l.iconUrl, path: l.iconPath });
    });
    if (!links.length) addLink();
    setBlob('avatar', null, '', page.avatarUrl ? { url: page.avatarUrl, path: page.avatarPath } : null);
    setBlob('bg', null, page.bgType, page.bgUrl ? { url: page.bgUrl, path: page.bgPath, type: page.bgType, posterUrl: page.bgPosterUrl, posterPath: page.bgPosterPath } : null);
    setBlob('audio', null, 'audio', page.audioUrl ? { url: page.audioUrl, path: page.audioPath } : null);
    setBlob('cursor', null, '', page.cursorUrl ? { url: page.cursorUrl, path: page.cursorPath } : null);
    seg(segCursor, (page.cursor === 'custom' && !page.cursorUrl) || page.cursor === 'dot' ? 'default' : (page.cursor || 'default'));
    seg(segCursorHot, page.cursorHotspot || 'tip');
    $('pb-result-url').textContent = siteHost() + '/' + page.username;
    $('pb-result').hidden = false;
    update();
    return true;
  }

  // ---------- full-screen profile view ----------
  const view = $('profile-view');
  const splash = $('pv-enter');
  const soundBtn = $('pv-sound');
  let viewAudio = null;
  let viewPage = null;
  let discordTimer = null;

  const isMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { return false; } };
  const hasSound = page => page && ((page.sound === 'video' && page.bgType === 'video') || (page.sound === 'file' && !!page.audioUrl));

  function applySound(playing) {
    const muted = isMuted();
    const vol = Math.max(0, Math.min(1, (viewPage?.volume ?? 60) / 100));
    const video = view.querySelector('.profile-bg video');
    if (video) {
      video.muted = !(playing && !muted && viewPage.sound === 'video');
      video.volume = vol;
    }
    if (viewAudio) {
      viewAudio.volume = vol;
      if (playing && !muted) viewAudio.play().catch(() => {});
      else viewAudio.pause();
    }
    soundBtn.classList.toggle('muted', muted);
    soundBtn.setAttribute('aria-label', muted ? t('p.unmute') : t('p.mute'));
    soundBtn.title = muted ? t('p.unmute') : t('p.mute');
  }

  async function openProfile(user) {
    closeMedia();
    view.dataset.user = user;
    let page = null;
    const pre = window.__VL_PAGE;   // sent along with the HTML on voids.wtf/name
    if (pre && pre.username === user && window.DB && DB.pageFromRow) {
      window.__VL_PAGE = null;
      page = DB.pageFromRow(pre);
    } else {
      try { page = window.DB ? await DB.getPage(user) : null; } catch (_) { page = null; }
    }
    if (routeUser() !== user) return;   // visitor moved on while it loaded
    viewPage = page;
    if (!page) {
      renderProfile(view, { username: user, name: t(window.DB ? 'p.missing' : 'toast.offline'), links: [] }, {});
    } else {
      const media = {
        avatarUrl: page.avatarUrl, bgUrl: page.bgUrl, bgType: page.bgType, bgPosterUrl: page.bgPosterUrl, cursorUrl: page.cursorUrl,
        icons: Object.fromEntries((page.links || []).filter(l => l.iconUrl).map(l => [l.id, l.iconUrl])),
      };
      if (page.audioUrl && page.sound === 'file') {
        viewAudio = new Audio(page.audioUrl);
        viewAudio.loop = true;
      }
      renderProfile(view, page, media);
      // Count the visit once a day per visitor (not refreshes, and not the owner's own looks).
      // This waits for the sign-in check so we know whether it's the owner; the page doesn't.
      ready.then(() => {
        if (viewPage !== page) return;
        const own = (myPageCache && myPageCache.username === user) || (me() && page.owner && me().id === page.owner);
        const seenKey = 'vl_seen_' + user;
        let fresh = !own;
        try {
          if (fresh && Date.now() - Number(localStorage.getItem(seenKey) || 0) < 864e5) fresh = false;
          if (fresh) localStorage.setItem(seenKey, String(Date.now()));
        } catch (_) {}
        if (!fresh) return;
        page.views += 1;
        renderProfile(view, page, media);
        DB.countView(user).then(v => { if (v != null && viewPage === page) { page.views = v; renderProfile(view, page, media); } });
      });
      if (/^\d{17,20}$/.test(page.discordId || '') || page.nowPlaying) {
        discordTimer = setInterval(() => renderProfile(view, page, media), 15000);
      }
    }
    const sound = hasSound(page);
    $('pv-close').hidden = !openedInApp;
    soundBtn.hidden = !sound;
    splash.hidden = !sound;
    view.classList.add('active');
    document.documentElement.classList.remove('vl-profile-boot');
    setOverlay(true);
    applySound(false);
    if (sound) splash.focus({ preventScroll: true });
    else if (openedInApp) $('pv-close').focus({ preventScroll: true });
  }

  function closeMedia() {
    clearInterval(discordTimer);
    if (viewAudio) { viewAudio.pause(); viewAudio = null; }
    const v = view.querySelector('.profile-bg video');
    if (v) v.pause();
    const bg = view.querySelector('.profile-bg');
    bg.textContent = '';
    bg.dataset.src = '';
  }

  function closeProfile() {
    document.documentElement.classList.remove('vl-profile-boot');
    if (!view.classList.contains('active')) return;
    view.classList.remove('active');
    reportPanel.hidden = true;
    closeMedia();
    setOverlay(false);
    if (location.hash.startsWith('#@')) history.replaceState(null, '', location.pathname + location.search);
    else if (pathUser()) history.replaceState(null, '', '/');
    // Back on the dashboard? Put its address back, so a refresh returns there
    if (typeof syncDashHash === 'function') syncDashHash();
  }

  splash.addEventListener('click', () => { splash.hidden = true; applySound(true); });
  soundBtn.addEventListener('click', () => {
    try { localStorage.setItem(MUTE_KEY, isMuted() ? '0' : '1'); } catch (_) {}
    applySound(splash.hidden);
  });

  // A profile is shown for #@name (inside the app) or a clean address like /name (live site)
  function pathUser() {
    const m = location.pathname.match(/^\/([a-z0-9_.-]{2,20})\/?$/i);
    return m && !/\.(html?|js|css|png|jpe?g|svg|ico|txt|xml|json)$/i.test(m[1]) ? m[1].toLowerCase() : null;
  }
  function routeUser() {
    const m = location.hash.match(/^#@([a-z0-9_.-]{2,20})$/i);
    return m ? m[1].toLowerCase() : (!location.hash ? pathUser() : null);
  }
  function route() {
    const u = routeUser();
    if (u) openProfile(u);
    else closeProfile();
  }

  $('pv-close').addEventListener('click', closeProfile);

  // Report this page (goes to the staff portal)
  const reportPanel = $('pv-report-panel');
  $('pv-report').addEventListener('click', () => {
    reportPanel.hidden = !reportPanel.hidden;
    if (!reportPanel.hidden) reportPanel.querySelector('input').focus();
  });
  $('pv-report-cancel').addEventListener('click', () => { reportPanel.hidden = true; });
  reportPanel.addEventListener('submit', async e => {
    e.preventDefault();
    if (!window.DB || !viewPage) { toast(t('toast.offline')); return; }
    const f = new FormData(reportPanel);
    try {
      await DB.reportPage(view.dataset.user, f.get('reason'), String(f.get('details') || '').trim());
      reportPanel.reset();
      reportPanel.hidden = true;
      toast('Thanks. Our team will review this page.');
    } catch (e) { toast(/too many/i.test((e && e.message) || '') ? 'Too many reports from you. Please wait a bit.' : "Couldn't send the report. Try again."); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeIconMenu(); if (openedInApp) closeProfile(); } });
  // Pages opened by clicking around the site get a way back; a visitor arriving on a link doesn't need one
  let openedInApp = false;
  window.addEventListener('hashchange', () => { openedInApp = true; route(); });

  // ---------- landing showcase (static demo profile) ----------
  const demoPhone = $('demo-phone');
  const demoData = {
    username: 'voidwalker', name: 'Void Walker', bio: t('sc.demo_bio'), dim: 18, layout: 'icons',
    links: [
      { id: 'd1', icon: 'github', label: 'GitHub', url: 'github.com' },
      { id: 'd2', icon: 'discord', label: 'Discord', url: 'discord.com' },
      { id: 'd3', icon: 'spotify', label: 'Spotify', url: 'open.spotify.com' },
      { id: 'd4', icon: 'instagram', label: 'Instagram', url: 'instagram.com' },
      { id: 'd5', icon: 'youtube', label: 'YouTube', url: 'youtube.com' },
    ],
  };
  const demoDiscord = {
    discord_status: 'online', discord_user: { username: 'voidwalker' }, listening_to_spotify: true,
    spotify: { song: 'Cornfield Chase', artist: 'Hans Zimmer', album_art_url: '' },
  };
  const DEMO_MEDIA = { avatarUrl: 'assets/demo/voidwalker-avatar.webp', bgUrl: 'assets/demo/voidwalker-bg.webp', bgType: 'image' };
  function renderDemo() {
    if (!demoPhone) return;
    demoData.bio = t('sc.demo_bio');
    renderProfile(demoPhone, demoData, DEMO_MEDIA, { discord: demoDiscord });
  }
  const demoSeg = $('demo-layout');
  if (demoSeg) {
    demoSeg.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      seg(demoSeg, b.dataset.v);
      demoData.layout = b.dataset.v;
      renderDemo();
    });
  }

  // ---------- claiming a username (hero, showcase, CTA) ----------
  function claimUsername(raw) {
    const u = cleanUser(raw);
    if (!USER_RE.test(u)) { toast(t('b.invalid')); return false; }
    const go = () => {
      openDashboard();
      showDashTab('page');
      setUsername(u);
    };
    if (typeof requireAuth === 'function') requireAuth(go, t('auth.claim').replace('{u}', u));
    else go();
    return true;
  }
  document.querySelectorAll('form.claim-box').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    claimUsername(f.querySelector('input').value);
  }));

  // ---------- builder placement (lives in the dashboard's "My page" tab) ----------
  function mountBuilder(slot) {
    if (slot && builder.parentElement !== slot) slot.appendChild(builder);
    update();
    syncPublishBtn();
  }
  function unmountBuilder() {
    closeIconMenu();
    if (builder.parentElement !== home) home.appendChild(builder);
  }
  async function setUsername(u) {
    await ready;     // let the saved page finish loading first so it can't overwrite this
    await syncing;
    if (myPageCache) {
      // One page per account: claiming a new name renames your existing page
      loadIntoBuilder(myPageCache);
      fUser.value = u;
      $('pb-result').hidden = true;
      update();
      return;
    }
    resetBuilder();   // a newly claimed name starts from a clean page
    fUser.value = u;
    if (me()) fName.value = me().name;
    $('pb-result').hidden = true;
    update();
    fName.focus({ preventScroll: true });
  }
  function myPage() {
    return myPageCache;
  }
  async function deletePage() {
    if (!myPageCache) return;
    await DB.deletePage(myPageCache);
    delete takenCache[myPageCache.username];
    myPageCache = null;
    resetBuilder();
    markSaved();
    syncPublishBtn();
  }
  // Called whenever someone signs in or out: load (or clear) their page
  function onAuthChange() {
    syncing = (async () => {
      try { myPageCache = me() && window.DB ? await DB.getMyPage() : null; } catch (_) { myPageCache = null; }
      if (myPageCache) loadIntoBuilder(myPageCache);
      else resetBuilder();
      markSaved();
      syncPublishBtn();
      if (typeof updateAuthUI === 'function') updateAuthUI();
    })();
    return syncing;
  }

  async function useAvatar(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    setBlob('avatar', blob);
    update();
  }

  // Unsaved-changes dialog actions (index.html)
  const saveEdits = () => (me() && window.DB ? publish() : Promise.resolve(false));
  function discardEdits() {
    if (myPageCache) loadIntoBuilder(myPageCache); else resetBuilder();
    markSaved();
  }
  // Lyrics for any song card (used by the dashboard preview on the home page)
  function showLyricsFor(card, np) { card._np = np; openLyrics(card); }
  window.LP = { showLyrics: showLyricsFor, isDirty, saveEdits, discardEdits, onAuthChange, useAvatar, mountBuilder, unmountBuilder, setUsername, myPage, deletePage, pageUrl, copyLink, claimUsername, resolveLink, iconSvg };

  document.addEventListener('langchange', () => {
    builder.querySelectorAll('[data-i18n-ph]').forEach(i => { i.placeholder = t(i.dataset.i18nPh); });
    update();
    renderDemo();
  });

  // ---------- start ----------
  const ready = (async () => {
    const sp = await spHandleRedirect();
    if (sp === 'popup') return;   // the Spotify window: nothing else to load
    if (sp) {
      let back = false;
      try { back = sessionStorage.getItem('lp-sp-return') === '1'; sessionStorage.removeItem('lp-sp-return'); } catch (_) {}
      if (back && me()) setTimeout(() => openDashboard('page'), 300);
    }
    resetBuilder();
    // Wait for Supabase to restore the session before loading "my page"
    if (window.DB) {
      const session = await DB.session();
      if (session && typeof loadCurrentUser === 'function' && !me()) { await loadCurrentUser(session); updateAuthUI(); }
      await onAuthChange();
    }
  })();
  renderDemo();
  // Profile links open straight away; everything else routes once sign-in is known
  if (routeUser()) route();
  else ready.then(route);
})();
