// ===== DATA LAYER (Supabase) =====
// Everything the site saves or loads goes through window.DB:
//   auth (email/password + social), profiles, pages + their media files,
//   page views and support tickets. Tables and rules: supabase/schema.sql.
// The address people see for this site ("voidlinks.netlify.app"): siteUrl from the
// config once deployed, otherwise wherever the site is running right now.
window.siteHost = () => {
  const cfg = window.SUPABASE_CONFIG || {};
  try { if (cfg.siteUrl) return new URL(cfg.siteUrl).host; } catch (_) {}
  return /^https?:$/.test(location.protocol) ? location.host : 'voidlinks';
};

(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.key) {
    console.warn('Supabase is not available (offline or not configured).');
    return;
  }
  // Links from emails land back here with details in the URL; read them before
  // the client tidies the URL up. type: signup | recovery | email_change | …
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(location.search);
  const authReturn = {
    type: hashParams.get('type') || queryParams.get('type') || '',
    error: hashParams.get('error_description') || queryParams.get('error_description') || '',
  };

  const sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const BUCKET = 'media';

  // Where Supabase sends people back after email links / social login (needs http/https)
  const redirectTo = () => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : undefined);
  const userId = async () => {
    const { data } = await sb.auth.getSession();   // reads the local session, no network call
    return data.session ? data.session.user.id : null;
  };
  const publicUrl = path => (path ? sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : '');
  const EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/webm': 'webm',
    'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/webm': 'webm',
  };
  const fail = error => { if (error) throw error; };

  // Database rows use snake_case; the site uses camelCase
  function fromRow(r) {
    if (!r) return null;
    return {
      username: r.username, owner: r.owner,
      name: r.name || '', bio: r.bio || '',
      dim: r.dim, blur: r.blur, layout: r.layout, sound: r.sound, volume: r.volume,
      spotify: r.spotify || '', discordId: r.discord_id || '', nowPlaying: !!r.now_playing,
      views: Number(r.views) || 0, updated: r.updated_at,
      bgType: r.bg_type || '',
      avatarPath: r.avatar_path, bgPath: r.bg_path, audioPath: r.audio_path,
      avatarUrl: publicUrl(r.avatar_path), bgUrl: publicUrl(r.bg_path), audioUrl: publicUrl(r.audio_path),
      links: (r.links || []).map(l => ({ ...l, iconUrl: publicUrl(l.iconPath) })),
      cursor: r.cursor || 'default', cursorHotspot: r.cursor_hotspot || 'tip',
      cursorPath: r.cursor_path || null, cursorUrl: publicUrl(r.cursor_path),
    };
  }
  function toRow(p, owner) {
    const row = {
      username: p.username, owner,
      name: p.name || null, bio: p.bio || null,
      dim: p.dim, blur: p.blur, layout: p.layout, sound: p.sound, volume: p.volume,
      spotify: p.spotify || null,
      discord_id: /^\d{17,20}$/.test(p.discordId || '') ? p.discordId : null,
      now_playing: !!p.nowPlaying,
      links: (p.links || []).map(({ id, icon, label, url, iconPath }) => ({ id, icon, label, url, iconPath: iconPath || null })),
      avatar_path: p.avatarPath || null, bg_path: p.bgPath || null, audio_path: p.audioPath || null,
      bg_type: p.bgPath ? (p.bgType || null) : null,
      updated_at: new Date().toISOString(),
    };
    // Cursor columns come from upgrade-links-cursors.sql; only send them when used,
    // so pages still save on a database that hasn't been upgraded yet
    if (p.cursor && p.cursor !== 'default' || p.hadCursor) {
      const custom = p.cursor === 'custom' && p.cursorPath;
      row.cursor = custom || p.cursor === 'crosshair' || p.cursor === 'dot' ? p.cursor : 'default';
      row.cursor_path = custom ? p.cursorPath : null;
      row.cursor_hotspot = p.cursorHotspot === 'center' ? 'center' : 'tip';
    }
    return row;
  }
  const filesOf = p => (p ? [p.avatarPath, p.bgPath, p.audioPath, p.cursorPath, ...(p.links || []).map(l => l.iconPath)].filter(Boolean) : []);

  // Public address of the site, used for short links and page links.
  // Set `siteUrl` in supabase-config.js once the site is on Netlify.
  const siteBase = () => {
    if (cfg.siteUrl) return cfg.siteUrl.replace(/\/?$/, '/');
    if (/^https?:$/.test(location.protocol)) return location.origin + '/';
    return '';
  };
  const SLUG_RE = /^[A-Za-z0-9_-]{2,40}$/;
  // Paths the site itself uses, so they can't become short links
  const RESERVED = new Set(['admin', 'go', 'index', 'assets', 'api', 'login', 'signup', 'dashboard', 'settings', 'help', 'about', 'terms', 'privacy', 'supabase', 'netlify']);
  // Link columns the browser may read (the password hash stays on the server)
  const LINK_COLS = 'slug, destination, clicks, created_at, starts_at, expires_at, max_clicks, status, has_password, updated_at';
  const MISSING_COLUMN = /42703|PGRST204|column/i;
  const UPGRADE_MSG = 'Advanced link options need a quick database upgrade: run supabase/upgrade-links-cursors.sql in Supabase.';
  // Turns the form's options into table columns. `editing` keeps explicit blanks (to clear a value).
  function linkFields(o, editing) {
    const f = {};
    if (o.password !== undefined && (o.password || editing)) f.password_hash = o.password || null;
    if (o.startsAt !== undefined && (o.startsAt || editing)) f.starts_at = o.startsAt || null;
    if (o.expiresAt !== undefined && (o.expiresAt || editing)) f.expires_at = o.expiresAt || null;
    if (o.maxClicks !== undefined && (o.maxClicks || editing)) f.max_clicks = o.maxClicks || null;
    return f;
  }
  const randomSlug = () => {
    const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, b => abc[b % abc.length]).join('');
  };

  const DB = {
    client: sb,
    authReturn,

    // ---------- auth ----------
    async session() { return (await sb.auth.getSession()).data.session; },
    // Deferred so the callback can safely make other Supabase calls
    onAuth(cb) { sb.auth.onAuthStateChange((event, session) => setTimeout(() => cb(event, session), 0)); },
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
    signUp: (name, email, password) => sb.auth.signUp({
      email, password, options: { data: { full_name: name }, emailRedirectTo: redirectTo() },
    }),
    oauthEnabled: provider => (cfg.oauth || []).includes(provider),
    canRedirect: () => !!redirectTo(),
    oauth: provider => sb.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } }),
    signOut: () => sb.auth.signOut(),
    resetPassword: email => sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() }),
    resendConfirmation: email => sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo() } }),
    async verifyPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return !error;
    },
    updateEmail: email => sb.auth.updateUser({ email }, { emailRedirectTo: redirectTo() }),
    updatePassword: password => sb.auth.updateUser({ password }),
    async currentEmail() {
      const { data } = await sb.auth.getUser();
      return data.user ? data.user.email : '';
    },

    // ---------- profile (account) ----------
    async getProfile() {
      const id = await userId();
      if (!id) return null;
      const { data } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
      return data;
    },
    async updateProfile(fields) {
      const id = await userId();
      fail((await sb.from('profiles').update(fields).eq('id', id)).error);
    },

    // ---------- files ----------
    async upload(name, blob) {
      const id = await userId();
      if (!id) throw new Error('Not signed in');
      const path = `${id}/${name}-${Date.now().toString(36)}.${EXT[blob.type] || 'bin'}`;
      fail((await sb.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || undefined, cacheControl: '31536000', upsert: false,
      })).error);
      return { path, url: publicUrl(path) };
    },
    async removeFiles(paths) {
      paths = paths.filter(Boolean);
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
    },
    publicUrl,

    // ---------- pages ----------
    async getMyPage() {
      const id = await userId();
      if (!id) return null;
      const { data, error } = await sb.from('pages').select('*').eq('owner', id).maybeSingle();
      fail(error);
      return fromRow(data);
    },
    async getPage(username) {
      const { data, error } = await sb.from('pages').select('*').eq('username', username).maybeSingle();
      fail(error);
      return fromRow(data);
    },
    async usernameOwner(username) {
      const { data } = await sb.from('pages').select('owner').eq('username', username).maybeSingle();
      return data ? data.owner : null;
    },
    // `previous` is the page as it was before, so replaced files can be cleaned up
    async savePage(page, previous) {
      const id = await userId();
      if (!id) throw new Error('Not signed in');
      const row = toRow(page, id);
      const res = previous
        ? await sb.from('pages').update(row).eq('owner', id).select().single()
        : await sb.from('pages').insert(row).select().single();
      fail(res.error);
      const saved = fromRow(res.data);
      const keep = new Set(filesOf(saved));
      DB.removeFiles(filesOf(previous).filter(p => !keep.has(p))).catch(() => {});
      return saved;
    },
    async deletePage(previous) {
      const id = await userId();
      fail((await sb.from('pages').delete().eq('owner', id)).error);
      DB.removeFiles(filesOf(previous)).catch(() => {});
    },
    async countView(username) {
      const { data, error } = await sb.rpc('count_page_view', { p_username: username });
      return error || data == null ? null : Number(data);
    },

    async reportPage(username, reason, details) {
      fail((await sb.rpc('report_page', { p_username: username, p_reason: reason, p_details: details || null })).error);
    },

    // ---------- addresses ----------
    siteBase,
    // With siteUrl set (Netlify): clean addresses like site/abc and site/@name.
    // Without it they still work anywhere: site/go.html?s=abc and index.html#@name.
    shortUrl: slug => {
      if (cfg.siteUrl) return siteBase() + slug;
      const base = siteBase();
      if (!base) return slug.startsWith('@') ? location.href.split('#')[0] + '#' + slug : location.href.split('#')[0].replace(/[^/]*$/, '') + 'go.html?s=' + slug;
      return slug.startsWith('@') ? location.href.split('#')[0] + '#' + slug : base + 'go.html?s=' + slug;
    },
    shortHost: () => (cfg.siteUrl ? siteBase() : siteBase() ? siteBase() + 'go.html?s=' : 'go.html?s=').replace(/^https?:\/\//, ''),
    pageUrl: username => (cfg.siteUrl ? siteBase() + '@' + username : location.href.split('#')[0] + '#@' + username),

    // ---------- short links ----------
    slugError(slug) {
      if (!SLUG_RE.test(slug)) return 'Use 2–40 letters, numbers, - or _';
      if (RESERVED.has(slug.toLowerCase())) return 'That name is reserved. Try another.';
      return '';
    },
    // Advanced options (password, schedule, use limit, pause/revoke, audit log) need
    // supabase/upgrade-links-cursors.sql. Until it has run, links still work without them.
    linkOptions: null,
    async myLinks() {
      let res = await sb.from('short_links').select(LINK_COLS).order('created_at', { ascending: false });
      if (res.error && MISSING_COLUMN.test(res.error.code + ' ' + res.error.message)) {
        DB.linkOptions = false;
        res = await sb.from('short_links').select('*').order('created_at', { ascending: false });
      } else if (!res.error) {
        DB.linkOptions = true;
      }
      fail(res.error);
      return res.data;
    },
    // Creates a link with the given slug, or a random one (retrying on the rare clash).
    // opts: { password, startsAt, expiresAt, maxClicks }, all optional.
    async createLink(destination, slug, opts = {}) {
      const owner = await userId();
      if (!owner) throw new Error('Not signed in');
      const extra = linkFields(opts);
      if (Object.keys(extra).length && DB.linkOptions === false) throw new Error(UPGRADE_MSG);
      const cols = DB.linkOptions === false ? '*' : LINK_COLS;
      for (let attempt = 0; attempt < 5; attempt++) {
        const s = slug || randomSlug();
        const { data, error } = await sb.from('short_links').insert({ slug: s, owner, destination, ...extra }).select(cols).single();
        if (!error) return data;
        if (MISSING_COLUMN.test(error.code + ' ' + error.message)) throw new Error(UPGRADE_MSG);
        if (error.code !== '23505') throw error;
        if (slug) { const e = new Error('That short name is taken. Try another.'); e.code = 'taken'; throw e; }
      }
      throw new Error('Could not create a link. Try again.');
    },
    // Change a link's options or status. Pass password: '' to remove it.
    async updateLink(slug, opts = {}) {
      const fields = linkFields(opts, true);
      if (opts.status) fields.status = opts.status;
      if (opts.destination) fields.destination = opts.destination;
      const { data, error } = await sb.from('short_links').update(fields).eq('slug', slug).select(LINK_COLS).single();
      if (error && MISSING_COLUMN.test(error.code + ' ' + error.message)) throw new Error(UPGRADE_MSG);
      fail(error);
      return data;
    },
    async deleteLink(slug) {
      fail((await sb.from('short_links').delete().eq('slug', slug)).error);
    },
    // History of changes to your links, newest first
    async linkAudit(limit = 200) {
      const { data, error } = await sb.from('link_audit').select('id, slug, action, detail, actor, at')
        .order('at', { ascending: false }).limit(limit);
      if (error && /42P01|PGRST205|link_audit/.test(error.code + ' ' + error.message)) return null;
      fail(error);
      return data;
    },
    // Used by go.html: checks every rule on the server, counts the click if allowed
    async openLink(slug, password, device, referrer) {
      const { data, error } = await sb.rpc('open_short_link', { p_slug: slug, p_password: password || null, p_device: device || null, p_referrer: referrer || null });
      fail(error);
      return data;
    },
    // Clicks on your own links (RLS limits it to them), newest first
    async myClicks(days = 30) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await sb.from('clicks').select('slug, at, country, device, referrer')
        .gte('at', since).order('at', { ascending: false }).limit(10000);
      fail(error);
      return data;
    },

    // ---------- support ----------
    async createTicket(name, email, topic, body) {
      const { data, error } = await sb.rpc('create_ticket', { p_name: name, p_email: email, p_topic: topic, p_body: body });
      fail(error);
      return data;   // { id, code, secret }
    },
    async addTicketMessage(id, secret, body) {
      fail((await sb.rpc('add_ticket_message', { p_id: id, p_secret: secret, p_body: body })).error);
    },
    async getTicket(id, secret) {
      const { data, error } = await sb.rpc('get_ticket', { p_id: id, p_secret: secret });
      fail(error);
      return data;   // { code, topic, email, status, messages: [{ sender, body, at }] }
    },
  };

  window.DB = DB;
})();
