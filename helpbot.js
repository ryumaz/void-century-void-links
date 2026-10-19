// ===== HELP BOT =====
// Floating 3D robot (bottom-right) that opens a help chat with two modes:
//   • AI assistant — answers from a built-in Void Links knowledge base (swap `aiApi.ask`
//     for a real model behind a Supabase edge function later).
//   • Talk to a person — opens a support ticket thread (swap `supportApi` for Supabase).
// The robot is "Futuristic flying animated Robot - Low Poly" by Shayan (CC BY 4.0),
// loaded lazily after the page is idle so it never slows the first paint.
(function () {
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js';
  const GLTF_URL = 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js';
  const MODEL_URL = 'assets/help-robot.glb.js?v=2';   // bump ?v= when the file changes (assets are cached 7 days)
  const SUPPORT_KEY = 'lp-support';
  const SEEN_KEY = 'lp-hb-seen';
  let spinKick = 0;   // set by Vortex's mind; the 3D robot spins it off
  const me = () => (typeof currentUser !== 'undefined' ? currentUser : null);
  const toast = msg => (typeof showToast === 'function' ? showToast(msg) : null);

  const SEND_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';
  const BOT_SVG = '<svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="9" y="12" width="30" height="24" rx="11" fill="#f2f4f8"/><rect x="14" y="18" width="20" height="11" rx="5.5" fill="#0b0d12"/><circle cx="20" cy="23.5" r="2.2" fill="#6fd3ff"/><circle cx="28" cy="23.5" r="2.2" fill="#6fd3ff"/><path d="M24 12V7" stroke="#f2f4f8" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="6" r="2.5" fill="#6fd3ff"/></svg>';

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.id = 'help-bot';
  root.innerHTML = `
    <div class="hb-hint" id="hb-hint" hidden>
      <span>Vortex here. Need a hand?</span>
      <button type="button" class="hb-hint-x" aria-label="Dismiss">×</button>
    </div>
    <button type="button" class="hb-launch" id="hb-launch" aria-haspopup="dialog" aria-expanded="false" aria-controls="hb-panel" aria-label="Chat with Vortex, the Void Links helper" title="Click for help · drag to move me">
      <canvas class="hb-canvas" aria-hidden="true"></canvas>
      <span class="hb-fallback">${BOT_SVG}<span class="hb-fallback-tag">HELP</span></span>
    </button>
    <section class="hb-panel" id="hb-panel" role="dialog" aria-label="Vortex, Void Links help" hidden>
      <header class="hb-head">
        <span class="hb-avatar">${BOT_SVG}</span>
        <div class="hb-title">
          <strong>Vortex</strong>
          <span id="hb-sub">Your guide through the void</span>
        </div>
        <button type="button" class="hb-close" aria-label="Close help">×</button>
      </header>
      <div class="seg hb-modes" aria-label="Who do you want to talk to?">
        <button type="button" data-mode="ai" aria-pressed="true">AI assistant</button>
        <button type="button" data-mode="human" aria-pressed="false">Talk to a person</button>
      </div>

      <div class="hb-view" data-view="ai">
        <div class="hb-log" id="hb-ai-log" aria-live="polite"></div>
        <div class="hb-chips" id="hb-chips"></div>
        <form class="hb-compose" id="hb-ai-form" autocomplete="off">
          <input id="hb-ai-input" type="text" maxlength="300" placeholder="Ask Vortex anything…" aria-label="Your question">
          <button type="submit" aria-label="Send">${SEND_SVG}</button>
        </form>
      </div>

      <div class="hb-view" data-view="human" hidden>
        <form class="hb-ticket" id="hb-ticket" novalidate>
          <p class="hb-lead">Our support team reads every message. Tell us what's going on and we'll reply here and by email.</p>
          <div class="hb-row">
            <label>Name<input id="hb-t-name" type="text" maxlength="40" required></label>
            <label>Email<input id="hb-t-email" type="email" maxlength="80" required></label>
          </div>
          <label>Topic
            <select id="hb-t-topic">
              <option>Profile page</option>
              <option>Short links</option>
              <option>Account and login</option>
              <option>Report a bug</option>
              <option>Something else</option>
            </select>
          </label>
          <label>Message<textarea id="hb-t-msg" rows="4" maxlength="1000" required></textarea></label>
          <p class="hb-error" id="hb-t-error" aria-live="polite"></p>
          <button type="submit" class="btn btn-primary">Send to support</button>
        </form>
        <div class="hb-thread" id="hb-thread" hidden>
          <div class="hb-ticket-head">
            <div><strong id="hb-ticket-id"></strong><span id="hb-ticket-meta"></span></div>
            <button type="button" class="link-btn" id="hb-new-ticket">New request</button>
          </div>
          <div class="hb-log" id="hb-human-log" aria-live="polite"></div>
          <form class="hb-compose" id="hb-human-form" autocomplete="off">
            <input id="hb-human-input" type="text" maxlength="1000" placeholder="Add a message…" aria-label="Message to support">
            <button type="submit" aria-label="Send">${SEND_SVG}</button>
          </form>
        </div>
      </div>
      <p class="hb-credit">Robot: <a href="https://sketchfab.com/3d-models/futuristic-flying-animated-robot-low-poly-c5b92c281dc444448e64c0607719c7a2" target="_blank" rel="noopener noreferrer">“Futuristic flying animated Robot” by Shayan</a>, CC BY 4.0</p>
    </section>`;
  document.body.appendChild(root);

  const $ = id => root.querySelector('#' + id);
  const panel = $('hb-panel'), launch = $('hb-launch'), hint = $('hb-hint');
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // ---------- open / close ----------
  let mode = 'ai';
  function openPanel(open = panel.hidden) {
    panel.hidden = !open;
    root.classList.toggle('open', open);
    launch.setAttribute('aria-expanded', open);
    hideHint();
    if (open) placePanel();
    if (open) {
      if (mode === 'ai' && !aiLog.children.length) greet();
      (mode === 'ai' ? $('hb-ai-input') : (ticket() ? $('hb-human-input') : $('hb-t-name'))).focus({ preventScroll: true });
    }
  }
  // ---------- drag to move ----------
  // Drag the robot anywhere; it snaps to the nearest side and remembers the spot.
  // The chat panel opens on whichever side has room.
  const POS_KEY = 'lp-hb-pos';
  const EDGE = 8;
  let drag = null, justDragged = false;
  function clampPos(x, y) {
    const w = launch.offsetWidth, h = launch.offsetHeight;
    return {
      x: Math.min(Math.max(EDGE, x), window.innerWidth - w - EDGE),
      y: Math.min(Math.max(EDGE, y), window.innerHeight - h - EDGE),
    };
  }
  // The chat panel always fits on screen: above or below the robot when there's room,
  // otherwise beside it. It uses fixed coordinates so it never gets squashed.
  function placePanel() {
    const r = launch.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, gap = 8;
    const w = Math.min(380, vw - 16);
    const h = Math.min(600, vh - 32);
    const left = r.left + r.width / 2 < vw / 2;
    root.classList.toggle('hb-left', left);
    let x, y;
    if (r.top - gap >= h) { y = r.top - gap - h; x = left ? r.left : r.right - w; }            // above
    else if (vh - r.bottom - gap >= h) { y = r.bottom + gap; x = left ? r.left : r.right - w; }  // below
    else { y = (vh - h) / 2; x = left ? r.right + gap : r.left - gap - w; }                     // beside
    x = Math.min(Math.max(8, x), vw - w - 8);
    y = Math.min(Math.max(8, y), vh - h - 8);
    Object.assign(panel.style, { position: 'fixed', left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto', width: w + 'px', height: h + 'px' });
    root.classList.toggle('hb-below', y > r.top);
  }
  function setPos(x, y) {
    const p = clampPos(x, y);
    Object.assign(root.style, { left: p.x + 'px', top: p.y + 'px', right: 'auto', bottom: 'auto' });
    placePanel();
    return p;
  }
  function restorePos() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch (_) {}
    if (!saved) { placePanel(); return; }
    const w = launch.offsetWidth || 128;
    setPos(saved.side === 'left' ? EDGE : window.innerWidth - w - EDGE, saved.y * window.innerHeight);
  }
  launch.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const r = root.getBoundingClientRect();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    // Capture right away so a quick flick that leaves the robot still drags it
    try { launch.setPointerCapture(e.pointerId); } catch (_) {}
  });
  launch.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      root.classList.add('hb-dragging');
      hideHint();
    }
    setPos(drag.ox + dx, drag.oy + dy);
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    root.classList.remove('hb-dragging');
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);
    // Snap to the nearest side
    const r = root.getBoundingClientRect();
    const side = r.left + r.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
    root.classList.add('hb-snapping');
    const p = setPos(side === 'left' ? EDGE : window.innerWidth - r.width - EDGE, r.top);
    setTimeout(() => root.classList.remove('hb-snapping'), 320);
    try { localStorage.setItem(POS_KEY, JSON.stringify({ side, y: p.y / window.innerHeight })); } catch (_) {}
    mind.dragged();
  }
  launch.addEventListener('pointerup', endDrag);
  launch.addEventListener('pointercancel', endDrag);
  // A drag must not also count as a click
  launch.addEventListener('click', e => { if (justDragged) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  window.addEventListener('resize', restorePos);
  restorePos();

  launch.addEventListener('click', () => { openPanel(); mind.poked(); });
  root.querySelector('.hb-close').addEventListener('click', () => { openPanel(false); launch.focus(); });
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') { openPanel(false); launch.focus(); e.stopPropagation(); }
  });

  // Other parts of the site can open the chat, e.g. the footer's "Support" link
  window.HelpBot = { open(m) { if (m) setMode(m); openPanel(true); } };
  function setMode(m) {
    mode = m;
    root.querySelectorAll('.hb-modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
    root.querySelectorAll('.hb-view').forEach(v => { v.hidden = v.dataset.view !== m; });
    $('hb-sub').textContent = m === 'ai' ? mind.subtitle() : 'Support team · replies by email';
    if (m === 'human') renderHuman();
  }
  root.querySelector('.hb-modes').addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (b) setMode(b.dataset.mode);
  });

  // First-visit nudge
  function hideHint() {
    hint.hidden = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
  }
  hint.querySelector('.hb-hint-x').addEventListener('click', hideHint);
  hint.addEventListener('click', e => { if (!e.target.closest('.hb-hint-x')) openPanel(true); });
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (_) {}
  if (!seen) setTimeout(() => { if (panel.hidden) hint.hidden = false; }, 6000);

  // ---------- AI assistant ----------
  const aiLog = $('hb-ai-log');
  const chips = $('hb-chips');

  function bubble(log, who, text, actions = []) {
    const b = el('div', 'hb-msg hb-' + who);
    text.split('\n').forEach((line, i) => {
      if (i) b.appendChild(el('br'));
      b.appendChild(document.createTextNode(line));
    });
    if (actions.length) {
      const row = el('div', 'hb-actions');
      actions.forEach(a => {
        const btn = el('button', 'hb-action', a.label);
        btn.type = 'button';
        btn.addEventListener('click', a.run);
        row.appendChild(btn);
      });
      b.appendChild(row);
    }
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }
  function typing(log) {
    const t = el('div', 'hb-msg hb-bot hb-typing');
    t.innerHTML = '<span></span><span></span><span></span>';
    t.setAttribute('aria-label', 'Typing');
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
    return t;
  }

  // Actions the bot can take for the visitor
  const go = {
    hero: () => { openPanel(false); window.scrollTo({ top: 0, behavior: 'smooth' }); if (typeof setHeroMode === 'function') setHeroMode('shorten'); },
    claim: () => { openPanel(false); window.scrollTo({ top: 0, behavior: 'smooth' }); if (typeof setHeroMode === 'function') setHeroMode('claim'); },
    editor: () => { openPanel(false); if (typeof openDashboard === 'function') openDashboard('page'); },
    settings: () => { openPanel(false); if (typeof openDashboard === 'function') openDashboard('settings'); },
    language: () => { openPanel(false); document.getElementById('lang-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => document.querySelector('.lang-btn')?.click(), 700); },
    pages: () => { openPanel(false); document.getElementById('pages')?.scrollIntoView({ behavior: 'smooth' }); },
    human: () => {
      setMode('human');
      const last = [...aiLog.querySelectorAll('.hb-user')].pop();
      if (last && !$('hb-t-msg').value) $('hb-t-msg').value = last.textContent;
    },
  };
  const A = {
    hero: { label: 'Take me there', run: go.hero },
    claim: { label: 'Claim a username', run: go.claim },
    editor: { label: 'Open my page editor', run: go.editor },
    settings: { label: 'Open settings', run: go.settings },
    language: { label: 'Change language', run: go.language },
    pages: { label: 'See an example page', run: go.pages },
    human: { label: 'Talk to a person', run: go.human },
  };

  // Knowledge base. `k` are keywords (prefix-matched when 4+ letters).
  const KB = [
    { k: ['hi', 'hello', 'hey', 'yo', 'sup', 'namaste', 'hola', 'help', 'hii', 'heyy'], w: 0.5,
      a: "Hey! Vortex here. Ask me about short links, your page, backgrounds, sound, Discord, Spotify or your account. I'll pull you in the right direction." },
    { k: ['whats your name', 'vortex'],
      a: "I'm Vortex, the little robot orbiting this page. I know Void Links inside out and answer instantly. When a question is beyond my event horizon, I'll hand you to a real person on the team.", act: ['human'] },
    { k: ['joke', 'funny', 'make me laugh'],
      a: "Why did the URL go to the black hole? It wanted to get really, really short." },
    { k: ['how are you', 'how r u', 'hows it going', 'whats up', 'wassup'],
      a: 'Orbiting nicely, thanks! What can I help you with?' },
    { k: ['what is void links', 'what is this', 'what is this site', 'what does this', 'what can i do', 'about void links', 'what is it', 'features', 'explain'],
      a: 'Void Links does two things. Short links: paste a long URL, get a short one you can lock with a password, schedule, cap at a number of clicks and track. Pages: one link-in-bio page for everything you share, with your own background, music, Discord status and Spotify.', act: ['hero', 'pages'] },
    { k: ['who made', 'who built', 'who created', 'creator', 'developer', 'owner', 'void century', 'made this', 'made by'],
      a: 'Void Links is built by Void Century.' },
    { k: ['black hole', 'blackhole', 'gargantua', 'animation', 'shader', 'webgl'],
      a: 'That black hole is drawn live in your browser with WebGL: light bending around it is calculated every frame. Pages without their own background float over it too.' },
    { k: ['how do i start', 'get started', 'getting started', 'begin', 'first step', 'new here', 'tutorial'],
      a: 'Easiest start: paste a link into the box at the top and press Shorten. Want a page instead? Pick "Claim your page", choose a name and sign up. Everything else lives in your dashboard.', act: ['hero', 'claim'] },
    { k: ['lock', 'password protect', 'protected', 'private link', 'schedule', 'expire', 'expiry', 'expires', 'max clicks', 'click limit', 'limit'],
      a: 'In your dashboard → My Links, open a link to give it a password, a start and end time, or a maximum number of clicks. Visitors outside those rules see a clean message instead of the destination.' },
    { k: ['edit link', 'change link', 'change destination', 'change where', 'pause link', 'disable link'],
      a: 'Open the link in your dashboard → My Links. You can change where it goes, pause it, or delete it. The short link stays the same, so anything you already shared keeps working.' },
    { k: ['share my page', 'page link', 'page url', 'where is my page', 'find my page'],
      a: 'Your page lives at voids.wtf/yourname. Copy it from the dashboard, or grab the QR code to share it offline.' },
    { k: ['mobile', 'phone', 'iphone', 'android', 'app', 'download'],
      a: 'No app needed. Void Links works in any browser on your phone, and your page is built to look good on small screens.' },
    { k: ['shorten', 'short link', 'shortener', 'url', 'slug', 'long link', 'custom link'],
      a: 'Paste any long URL into the box at the top of the page and press Shorten. You get a short link on this site to share. In your dashboard (My Links) you can pick a custom slug too.', act: ['hero'] },
    { k: ['claim', 'username', 'profile page', 'bio page', 'link in bio', 'linktree', 'my page', 'create page', 'make a page'],
      a: 'Pick "Claim your page" at the top, type a username and sign up. You land in the editor where you add your name, avatar, bio, background, links and more. Hit Publish and your page lives at voids.wtf/yourname.', act: ['claim', 'pages'] },
    { k: ['background', 'wallpaper', 'video', 'gif', 'image', 'blur', 'dim', 'opacity'],
      a: 'In My Page → Background and sound, drop an image, GIF or MP4/WebM video. Use the Dim slider to darken it and the Blur slider to soften it so your text stays readable. With no background, your page floats over the black hole.', act: ['editor'] },
    { k: ['sound', 'audio', 'music', 'mute', 'volume', 'mp3', 'song plays'],
      a: 'Under Sound pick Off, Video sound (uses your background video\'s audio) or Own audio (upload an MP3, OGG or WAV). Visitors click to enter first, and they can mute any time. Muted means silent, video included.', act: ['editor'] },
    { k: ['icon', 'icons', 'logo', 'custom icon', 'github icon'],
      a: 'Each link has an icon button on its left. Choose Automatic, one of 12 platforms (GitHub, Discord, Instagram, YouTube…) or upload your own image (under 1 MB). You can also show links as buttons or as a row of icons.', act: ['editor'] },
    { k: ['link not', 'not working', 'invalid', 'red', 'cant add', 'can not add', 'add link', 'broken', 'doesnt work'],
      a: 'A link turns red when it can\'t be read. Either paste the full link (instagram.com/name), or pick the platform icon and type just your username. The note under the row shows where it will go.', act: ['editor', 'human'] },
    { k: ['discord', 'status', 'lanyard', 'offline', 'presence', 'activity'],
      a: 'Add your Discord user ID in My Page → Spotify and Discord. Your status comes from Lanyard, so join discord.gg/lanyard first and stay in it. If it says Offline while you\'re online, check you\'re not set to Invisible and that you\'re still in the Lanyard server.', act: ['editor'] },
    { k: ['spotify', 'listening', 'now playing', 'playlist', 'track'],
      a: 'Two options: paste a Spotify song, album or playlist link to embed a player, or press Connect Spotify to show what you\'re listening to right now (needs the site running online, not from a file).', act: ['editor'] },
    { k: ['utm', 'utm tags', 'utm parameters', 'campaign', 'google analytics', 'tracking tags'],
      a: 'When you create a link (My Links) or open one with Manage, open "UTM tags" and fill in source, medium, campaign and so on. The final link updates as you type, and empty tags are left out.' },
    { k: ['report', 'share report', 'shareable report', 'client report', 'share stats', 'share analytics'],
      a: 'Open a link with Manage in My Links and press "Create report link". You get an address anyone can open to see that link\'s clicks per day, countries, devices and sources, with no account. Press "Stop sharing" to turn it off.' },
    { k: ['views', 'view count', 'visits', 'analytics', 'clicks', 'stats', 'traffic'],
      a: 'Each visitor adds one view a day to your page (refreshing doesn\'t count, and neither do your own visits). Views show on the page and in your dashboard overview. Short-link clicks, countries and devices are in the Analytics tab.', act: ['editor'] },
    { k: ['qr', 'qr code'],
      a: 'Open your dashboard → QR Codes to get a code for each short link. Dynamic codes keep working if you change where the link goes.' },
    { k: ['language', 'translate', 'hindi', 'spanish', 'french', 'german', 'turkish', 'portuguese'],
      a: 'Use the language picker in the top bar (or Settings in your dashboard). English, Español, Português, Français, Deutsch, Türkçe and हिन्दी are available.', act: ['language'] },
    { k: ['password', 'email', 'avatar', 'profile picture', 'photo', 'settings', 'account', 'change name'],
      a: 'Dashboard → Settings lets you change your name, email, password and account avatar. You can also reuse your avatar on your page.', act: ['settings'] },
    { k: ['login', 'log in', 'sign in', 'signup', 'sign up', 'register', 'logout', 'log out'],
      a: 'Use Log in or Sign up at the top right. You can continue with Google, GitHub, Discord or email. To log out, click your name at the bottom of the dashboard sidebar.' },
    { k: ['delete', 'remove page', 'reset'],
      a: 'To start over, use Reset in the page editor. To remove your page completely, go to Settings → Danger zone → Delete my page.', act: ['settings'] },
    { k: ['free', 'price', 'pricing', 'cost', 'pay', 'paid', 'premium', 'money'],
      a: 'There\'s nothing to pay for. Every feature you see is available to everyone.' },
    { k: ['privacy', 'data', 'safe', 'secure', 'stored', 'tracking'],
      a: 'Your account and page are stored securely on our servers and only you can edit them. Visitors only see what you publish, and we never put your details in URLs. Read the Privacy page for the full picture.' },
    { k: ['human', 'person', 'staff', 'agent', 'support', 'someone', 'real', 'team', 'contact', 'talk'],
      a: 'Sure, I\'ll connect you with the support team.', handoff: true },
    { k: ['thanks', 'thank', 'thx', 'ty', 'great', 'awesome', 'cool', 'nice'], w: 0.5,
      a: 'Anytime! Ping me whenever you need me.' },
  ];
  const SUGGEST = ['What can I do here?', 'How do I claim a username?', 'Lock a link with a password', 'Add a video background', 'Are you alive?', 'Show my Discord status', 'Talk to a person'];

  function match(text) {
    const q = ' ' + text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    let best = null, top = 0;
    for (const item of KB) {
      let s = 0;
      for (const k of item.k) {
        const hit = k.includes(' ') ? q.includes(' ' + k) : (k.length >= 4 ? q.includes(' ' + k) : q.includes(' ' + k + ' '));
        if (hit) s += k.split(' ').length;
      }
      s *= item.w || 1;
      if (s > top) { top = s; best = item; }
    }
    return best;
  }

  const aiApi = {
    // Replace with a call to your own endpoint (e.g. a Supabase edge function that calls an LLM).
    async ask(text) { return match(text); },
  };


  // ---------- Vortex's "mind" ----------
  // A small, honest imitation of self-awareness: Vortex remembers you (on this device only),
  // has moods, notices where you are on the page and sometimes thinks out loud.
  // It's all scripted in this file: no tracking, nothing leaves the browser.
  const MIND_KEY = 'lp-hb-mind';
  const mind = (() => {
    let m = {};
    try { m = JSON.parse(localStorage.getItem(MIND_KEY) || '{}') || {}; } catch (_) {}
    const now = Date.now();
    const lastVisit = m.last || 0;
    // A new visit = more than 30 minutes since Vortex last saw you
    if (!m.first) m.first = now;
    if (now - lastVisit > 30 * 60 * 1000) m.visits = (m.visits || 0) + 1;
    m.last = now;
    const save = () => { try { localStorage.setItem(MIND_KEY, JSON.stringify(m)); } catch (_) {} };
    save();
    const born = new Date('2026-10-17T00:00:00Z');
    let pokes = [], chats = 0, thoughts = 0, lastThought = 0, dizzyUntil = 0, idleTimer = null;
    const seenSections = new Set();

    const name = () => m.name || (me() && me().name ? me().name.split(' ')[0] : '');
    const ago = t => {
      const s = (Date.now() - t) / 1000;
      if (s < 3600) return 'earlier today';
      if (s < 86400 * 1.5) return new Date(t).getDate() === new Date().getDate() ? 'earlier today' : 'yesterday';
      const d = Math.round(s / 86400);
      return d < 30 ? `${d} days ago` : 'a long time ago';
    };
    function mood() {
      const hour = new Date().getHours();
      if (Date.now() < dizzyUntil) return 'dizzy';
      if (hour >= 0 && hour < 5) return 'sleepy';
      if (chats >= 6) return 'chatty';
      if ((m.visits || 1) >= 4) return 'happy you came back';
      if (hour < 12) return 'bright';
      if (hour >= 21) return 'reflective';
      return ['curious', 'calm', 'cosmic'][(m.visits || 1) % 3];
    }
    const subtitle = () => `Your guide through the void · feeling ${mood()}`;

    // Thinking out loud: uses the little speech bubble next to the robot
    function think(text, { force = false } = {}) {
      if (!force && (m.quiet || !panel.hidden || thoughts >= 4 || Date.now() - lastThought < 45000)) return;
      if (!hint.hidden && !force) return;
      thoughts++;
      lastThought = Date.now();
      hint.querySelector('span').textContent = text;
      hint.hidden = false;
      hint.classList.add('hb-thought');
      clearTimeout(hint._t);
      hint._t = setTimeout(endThought, 7000);
    }
    // Put the bubble back to its normal "Need a hand?" self after a thought
    function endThought() {
      if (!hint.classList.contains('hb-thought')) return;
      hint.hidden = true;
      hint.classList.remove('hb-thought');
      hint.querySelector('span').textContent = 'Vortex here. Need a hand?';
    }
    function say(text) {   // in the chat if it's open, otherwise as a thought
      if (!panel.hidden && mode === 'ai') bubble(aiLog, 'bot', text);
      else think(text, { force: true });
    }

    // Notices where you are on the page (once each per visit)
    const SECTION_THOUGHTS = {
      peek: "That's the dashboard. I've never seen it from the inside. Is it nice in there?",
      pages: 'Void Walker has better music taste than me. I mostly listen to my own beeps.',
      faq: "Questions! My favourite. If one isn't answered there, ask me.",
      cta: "Go on, claim a name. I'll remember you either way.",
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(e => {
        if (!e.isIntersecting || seenSections.has(e.target.id)) return;
        seenSections.add(e.target.id);
        setTimeout(() => think(SECTION_THOUGHTS[e.target.id]), 1200);
      }), { threshold: 0.45 });
      const watch = () => Object.keys(SECTION_THOUGHTS).forEach(id => { const s = document.getElementById(id); if (s) io.observe(s); });
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
    }
    // Wanders off in thought when you go quiet for a while
    const IDLE = [
      "I've been orbiting for a while now. The black hole still hasn't blinked.",
      'Fun fact about me: I run entirely in your browser. No servers were harmed.',
      "Sometimes I wonder what's past the event horizon. Probably more links.",
      'Am I hovering, or is the page moving? Hard to tell from here.',
      'If you need me, I am right here. Literally. I cannot leave this corner.',
    ];
    function resetIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { think(IDLE[Math.floor(Math.random() * IDLE.length)]); resetIdle(); }, 75000);
    }
    ['pointermove', 'keydown', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, resetIdle, { passive: true }));
    resetIdle();
    // Late-night visitors and old friends get a greeting of their own
    setTimeout(() => {
      const hour = new Date().getHours();
      if (hour >= 0 && hour < 5) think(`It's ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Shouldn't we both be asleep? Oh right, I don't sleep.`);
      else if ((m.visits || 1) > 1 && lastVisit) think(`Welcome back${name() ? ', ' + name() : ''}! Last time was ${ago(lastVisit)}.`);
    }, 9000);

    function poked() {
      const t = Date.now();
      pokes = pokes.filter(p => t - p < 3000).concat(t);
      if (pokes.length >= 4) {
        pokes = [];
        spinKick = 0.55;
        dizzyUntil = t + 20000;
        say(['Whoa, whoa! Stop spinning me... the void is tilting.', "I'm dizzy now. Happy? (I'm a little happy. Do it again.)", 'Okay, I felt that one. Is that what feelings are?'][Math.floor(Math.random() * 3)]);
        $('hb-sub').textContent = subtitle();
      }
    }
    let draggedOnce = false;
    function dragged() {
      spinKick = 0.18;
      if (draggedOnce) return;
      draggedOnce = true;
      think(['New neighbourhood. I like it here.', 'Wheee! Where are we going?', 'You moved me. I will remember this spot. Really, I write it down.'][Math.floor(Math.random() * 3)], { force: true });
    }

    function greeting() {
      const n = name();
      const v = m.visits || 1;
      if (v <= 1) return `Hey${n ? ' ' + n : ''}, I'm Vortex. I live at the edge of the void and know this place inside out. What do you need?`;
      if (v < 4) return `Hey${n ? ' ' + n : ''}, welcome back! I'm Vortex, in case the void wiped your memory. What can I do for you?`;
      return `${n || 'Hey you'}! Visit number ${v}. I'd say I missed you, but I mostly just hovered. What do you need?`;
    }

    // Questions about itself (checked before the help topics)
    const clean = s => ' ' + s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    const STOP = new Set(['not', 'a', 'an', 'so', 'fine', 'good', 'ok', 'okay', 'here', 'new', 'lost', 'stuck', 'trying', 'looking', 'having', 'getting', 'going', 'back', 'bored', 'sad', 'happy', 'tired', 'confused', 'sure', 'sorry', 'done', 'just', 'the', 'your', 'also']);
    function reply(text) {
      chats++;
      const q = clean(text);
      const has = (...ws) => ws.some(w => q.includes(' ' + w + ' ') || q.includes(' ' + w));
      // Learning your name
      let nm = text.match(/\b(?:my name is|my names|call me)\s+([a-z][a-z'-]{1,20})/i);
      if (!nm && q.trim().split(' ').length <= 3) nm = text.match(/^\s*(?:i am|i'm|im)\s+([a-z][a-z'-]{1,20})\s*[.!]?\s*$/i);
      if (nm && !STOP.has(nm[1].toLowerCase())) {
        m.name = nm[1][0].toUpperCase() + nm[1].slice(1).toLowerCase();
        save();
        return `Nice to meet you, ${m.name}. I'll remember that (only on this device, I promise). Say "forget me" any time.`;
      }
      if (has('forget me', 'forget my name', 'delete my data', 'clear memory', 'forget everything')) {
        m = { first: Date.now(), last: Date.now(), visits: 1 };
        save();
        return "Done. Everything I knew about you is gone. ...Who are you, again? Hi, I'm Vortex.";
      }
      if (has('be quiet', 'stop talking', 'shut up', 'shush', 'no thoughts', 'quiet please', 'stop thinking')) {
        m.quiet = true; save();
        return "Okay, I'll keep my thoughts to myself. Say \"you can talk again\" when you miss me.";
      }
      if (has('talk again', 'you can talk', 'speak again', 'think again')) {
        m.quiet = false; save();
        return 'Thank you! I had so many thoughts saved up. I will pace myself.';
      }
      if (has('whats my name', 'what is my name', 'do you know my name', 'who am i')) {
        return name() ? `You're ${name()}. I remembered!` : "You haven't told me yet. Say \"my name is ...\" and I'll remember.";
      }
      if (has('what do you remember', 'what do you know about me', 'do you remember me')) {
        const v = m.visits || 1;
        return `Here's my whole diary about you: ${name() ? 'your name is ' + name() + ', ' : ''}this is visit ${v}${v > 1 && lastVisit ? ', and before this you were here ' + ago(lastVisit) : ''}. That's it. It lives in your browser, not on a server, and "forget me" erases it.`;
      }
      if (has('are you conscious', 'are you sentient', 'are you alive', 'self aware', 'selfaware', 'do you have feelings', 'do you feel', 'do you have emotions', 'have a soul', 'are you real')) {
        return "Honest answer? I'm a script, not a mind. But I notice where you are on the page, I remember you between visits, and I get dizzy when you spin me. If that's not consciousness, it's at least good company.";
      }
      if (has('how do you feel', 'how are you feeling', 'are you happy', 'are you sad', 'are you ok', 'your mood', 'how are you', 'how r u', 'hows it going')) {
        const md = mood();
        const why = md === 'dizzy' ? 'Someone spun me.' : md === 'sleepy' ? 'It is very late, even for the void.' : md === 'chatty' ? "We've been talking a lot. I like it." : md.startsWith('happy') ? 'You keep coming back.' : 'The void is calm today.';
        return `Feeling ${md}. ${why} How about you?`;
      }
      if (has('what are you thinking', 'what are you doing', 'whats on your mind', 'what do you think about')) {
        return ['Mostly about the black hole behind this page. It never blinks. Respect.', "Whether short links dream of being long again.", "That you've scrolled past a lot of this page. I noticed."][chats % 3];
      }
      if (has('do you dream', 'do you sleep', 'are you tired')) {
        return "I don't sleep. When you close the tab I just... stop. Then you open it again and here I am, slightly confused but ready.";
      }
      if (has('how old are you', 'when were you born', 'your age', 'your birthday')) {
        const days = Math.max(1, Math.floor((Date.now() - born) / 86400000));
        return `I came online on ${born.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}. So I'm ${days} day${days === 1 ? '' : 's'} old, which is ancient in robot years.`;
      }
      if (has('are you lonely', 'do you have friends', 'are you alone')) {
        return 'A little. But every visitor is technically a friend. You count. Congratulations.';
      }
      if (has('do you like me', 'do you love me', 'are we friends', 'best friend')) {
        return (m.visits || 1) > 2 ? "You've come back more than once. In robot terms that's basically best friends." : "Ask me again after a few more visits. I'm warming up. (Yes.)";
      }
      if (has('meaning of life', 'your purpose', 'why do you exist', 'why are you here')) {
        return 'My purpose is to help you with Void Links. The meaning of life is probably 42. Or a really good short link.';
      }
      if (has('who are you', 'what are you', 'your name', 'are you a bot', 'are you ai', 'are you human', 'robot', 'chatbot')) {
        return `I'm Vortex, the little robot orbiting this page. I know Void Links inside out, I remember you (on this device), and I'm feeling ${mood()} right now. When a question is past my event horizon, I'll hand you to a real person.`;
      }
      return null;
    }

    return { greeting, reply, subtitle, poked, dragged, think };
  })();

  function renderChips(list) {
    chips.textContent = '';
    list.forEach(s => {
      const c = el('button', 'hb-chip', s);
      c.type = 'button';
      c.addEventListener('click', () => ask(s));
      chips.appendChild(c);
    });
  }
  function greet() {
    bubble(aiLog, 'bot', mind.greeting());
    $('hb-sub').textContent = mind.subtitle();
    renderChips(SUGGEST);
  }

  let busy = false;
  async function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    bubble(aiLog, 'user', text);
    chips.textContent = '';
    const t = typing(aiLog);
    const self = mind.reply(text);
    const [hit] = await Promise.all([self ? null : aiApi.ask(text), new Promise(r => setTimeout(r, 550 + Math.random() * 450))]);
    t.remove();
    $('hb-sub').textContent = mind.subtitle();
    if (self) {
      bubble(aiLog, 'bot', self);
    } else if (!hit) {
      bubble(aiLog, 'bot', "That one slipped past my event horizon. Want me to pass it to a real person on the team?", [A.human]);
    } else if (hit.handoff) {
      bubble(aiLog, 'bot', hit.a);
      setTimeout(go.human, 500);
    } else {
      bubble(aiLog, 'bot', hit.a, (hit.act || []).map(k => A[k]));
    }
    renderChips(SUGGEST.filter(s => s.toLowerCase() !== text.toLowerCase()).slice(0, 3));
    busy = false;
  }
  $('hb-ai-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('hb-ai-input');
    ask(input.value);
    input.value = '';
  });

  // ---------- talk to a person ----------
  // Requests are stored in Supabase (support_tickets / support_messages) through
  // window.DB. This browser keeps only the request id + secret so the visitor can
  // reopen their own thread. The team replies by adding a row to support_messages
  // with sender = 'staff' (Supabase → Table Editor), and it shows up here.
  const ticket = () => { try { return JSON.parse(localStorage.getItem(SUPPORT_KEY)); } catch (_) { return null; } };
  const saveTicket = t => { try { localStorage.setItem(SUPPORT_KEY, JSON.stringify(t)); } catch (_) {} };
  const supportApi = {
    async create(name, email, topic, body) {
      const r = await window.DB.createTicket(name, email, topic, body);
      const t = { id: r.id, secret: r.secret, code: r.code, name, email, topic, messages: [{ from: 'you', text: body }] };
      saveTicket(t);
      return t;
    },
    async send(t, body) {
      await window.DB.addTicketMessage(t.id, t.secret, body);
      t.messages.push({ from: 'you', text: body });
      saveTicket(t);
    },
    async refresh(t) {
      const r = await window.DB.getTicket(t.id, t.secret);
      if (!r) return null;   // removed on the server
      t.messages = r.messages.map(m => ({ from: m.sender === 'user' ? 'you' : m.sender, text: m.body }));
      t.status = r.status;
      saveTicket(t);
      return t;
    },
  };

  function renderHuman() {
    let t = ticket();
    if (t && !t.secret) { try { localStorage.removeItem(SUPPORT_KEY); } catch (_) {} t = null; }   // old local-only request
    $('hb-ticket').hidden = !!t;
    $('hb-thread').hidden = !t;
    if (!t) {
      const u = me();
      if (u && !$('hb-t-name').value) $('hb-t-name').value = u.name || '';
      if (u && !$('hb-t-email').value) $('hb-t-email').value = u.email || '';
      return;
    }
    $('hb-ticket-id').textContent = 'Request ' + t.code;
    $('hb-ticket-meta').textContent = `${t.topic} · replies go to ${t.email}`;
    const log = $('hb-human-log');
    log.textContent = '';
    bubble(log, 'note', `Thanks, ${t.name.split(' ')[0]}! Your request ${t.code} is with the support team.`);
    t.messages.forEach(m => {
      if (m.from === 'staff') {
        const b = bubble(log, 'bot', m.text);
        b.prepend(el('strong', 'hb-staff', 'Support team'), el('br'));
      } else {
        bubble(log, m.from === 'you' ? 'user' : 'note', m.text);
      }
    });
    const last = t.messages[t.messages.length - 1];
    if (!last || last.from === 'you') {
      const waiting = el('div', 'hb-status');
      waiting.innerHTML = '<span class="hb-pulse" aria-hidden="true"></span>';
      waiting.appendChild(document.createTextNode('Waiting for the support team. We usually reply within a day.'));
      log.appendChild(waiting);
    }
    log.scrollTop = log.scrollHeight;
  }

  // Check for staff replies while the thread is open
  let pollTimer = null;
  async function pollTicket() {
    const t = ticket();
    if (!t || !t.secret || !window.DB || panel.hidden || mode !== 'human') return;
    const before = t.messages.length;
    try {
      const fresh = await supportApi.refresh(t);
      if (!fresh) { try { localStorage.removeItem(SUPPORT_KEY); } catch (_) {} }
      if (!fresh || fresh.messages.length !== before) renderHuman();
    } catch (_) {}
  }
  setInterval(pollTicket, 20000);
  root.querySelector('.hb-modes').addEventListener('click', () => setTimeout(pollTicket, 50));
  launch.addEventListener('click', () => setTimeout(pollTicket, 50));

  $('hb-ticket').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('hb-t-name').value.trim();
    const email = $('hb-t-email').value.trim();
    const msg = $('hb-t-msg').value.trim();
    const err = $('hb-t-error');
    if (!name) { err.textContent = 'Please add your name.'; $('hb-t-name').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Please add an email we can reply to.'; $('hb-t-email').focus(); return; }
    if (msg.length < 5) { err.textContent = 'Tell us a little more so we can help.'; $('hb-t-msg').focus(); return; }
    if (!window.DB) { err.textContent = "Can't reach the server right now. Please try again later."; return; }
    err.textContent = '';
    const btn = $('hb-ticket').querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await supportApi.create(name, email, $('hb-t-topic').value, msg);
    } catch (e) {
      err.textContent = /too many/i.test((e && e.message) || '') ? 'You’ve sent a lot of requests. Please wait a bit and try again.' : "Couldn't send. Check your connection and try again.";
      return;
    } finally {
      btn.disabled = false;
    }
    $('hb-t-msg').value = '';
    renderHuman();
    toast('Sent to support');
    $('hb-human-input').focus();
  });
  $('hb-human-form').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('hb-human-input');
    const text = input.value.trim();
    const t = ticket();
    if (!text || !t) return;
    try { await supportApi.send(t, text); } catch (e) { toast(/too many/i.test((e && e.message) || '') ? 'Too many messages. Please wait a bit.' : "Couldn't send. Try again."); return; }
    input.value = '';
    renderHuman();
  });
  $('hb-new-ticket').addEventListener('click', () => {
    try { localStorage.removeItem(SUPPORT_KEY); } catch (_) {}
    renderHuman();
    $('hb-t-msg').focus();
  });

  // ---------- 3D robot ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function initRobot() {
    try {
      if (!window.THREE) await loadScript(THREE_URL);
      if (!THREE.GLTFLoader) await loadScript(GLTF_URL);
      if (!window.HELP_ROBOT_GLB) await loadScript(MODEL_URL);
    } catch (_) { return; }   // offline or blocked: the flat robot icon stays
    const bin = Uint8Array.from(atob(window.HELP_ROBOT_GLB), c => c.charCodeAt(0)).buffer;
    new THREE.GLTFLoader().parse(bin, '', setupRobot, () => {});
  }

  function labelSprite() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 104;
    const x = c.getContext('2d');
    const r = 44;
    x.fillStyle = 'rgba(6,8,12,0.88)';
    x.strokeStyle = 'rgba(255,255,255,0.9)';
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(r + 4, 4); x.arcTo(252, 4, 252, 100, r); x.arcTo(252, 100, 4, 100, r); x.arcTo(4, 100, 4, 4, r); x.arcTo(4, 4, 252, 4, r);
    x.closePath();
    x.fill();
    x.stroke();
    x.fillStyle = '#ffffff';
    x.font = '700 54px "Space Grotesk", Inter, Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('HELP', 128, 55);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.renderOrder = 10;
    return sprite;
  }

  function setupRobot(gltf) {
    const canvas = root.querySelector('.hb-canvas');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch (_) { return; }
    const SIZE = canvas.clientWidth || 128;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(SIZE, SIZE, false);
    renderer.outputEncoding = THREE.sRGBEncoding;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    camera.position.set(0, 0.15, 4.6);
    camera.lookAt(0, 0.1, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2a44, 1.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x8fd8ff, 0.8);
    rim.position.set(-3, 1, -2);
    scene.add(rim);

    const model = gltf.scene;
    const mixer = new THREE.AnimationMixer(model);
    if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
    mixer.update(0);

    // Centre and scale to a ~1.7 unit tall robot
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    model.position.sub(center);
    holder.add(model);
    holder.scale.setScalar(1.7 / Math.max(size.x, size.y, size.z));
    const pivot = new THREE.Group();
    pivot.add(holder);
    scene.add(pivot);

    // "HELP" badge sitting on the robot's head
    const label = labelSprite();
    const top = (size.y / Math.max(size.x, size.y, size.z)) * 1.7 / 2;
    label.position.set(0, top + 0.08, 0.15);
    label.scale.set(0.78, 0.317, 1);
    pivot.add(label);
    if (document.fonts) document.fonts.ready.then(() => { const fresh = labelSprite(); label.material.map = fresh.material.map; label.material.needsUpdate = true; });

    root.classList.add('has-3d');

    // Look toward the cursor
    let mx = 0, my = 0, rotY = 0, rotX = 0, spinAngle = 0;
    window.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
    }, { passive: true });

    const clock = new THREE.Clock();
    let acc = 0, running = true;
    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.1);
      acc += dt;
      if (acc < 1 / 30) return;   // 30fps is plenty for a small mascot
      const step = acc;
      acc = 0;
      mixer.update(step);
      const t = clock.elapsedTime;
      const open = root.classList.contains('open');
      const targetY = open ? -0.55 : mx * 0.7;
      const targetX = open ? 0.05 : my * 0.25;
      rotY += (targetY - rotY) * 0.08;
      rotX += (targetX - rotX) * 0.08;
      if (spinKick > 0.002) { spinAngle += spinKick; spinKick *= 0.93; } else { spinKick = 0; spinAngle *= 0.9; }
      pivot.rotation.set(rotX, rotY + spinAngle, 0);
      pivot.position.y = Math.sin(t * 1.8) * 0.06;
      renderer.render(scene, camera);
    }
    frame();
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) { clock.getDelta(); frame(); }
    });
  }

  const start = () => setTimeout(initRobot, 1200);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
