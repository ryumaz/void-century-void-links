// ===== VOID LINKS STAFF PORTAL =====
// Tickets (reply as staff), reported pages, all users, and staff management.
// Access is enforced by the database (public.staff + RLS in supabase/admin.sql),
// not by this page: a non-staff account simply gets no data.
(function () {
  const cfg = window.SUPABASE_CONFIG;
  if (!window.supabase || !cfg) {
    document.body.textContent = "Can't load the staff portal (offline?).";
    return;
  }
  // Separate session storage so a staff login never mixes with a customer login on the main site
  const sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { storageKey: 'vortex-staff-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const btn = (label, cls, onClick) => {
    const b = el('button', 'btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const ago = iso => {
    if (!iso) return '—';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString();
  };
  const pageLink = username => {
    const a = el('a', '', '@' + username);
    a.href = 'index.html#@' + username;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  };
  const segValue = id => $(id).querySelector('[aria-pressed="true"]').dataset.v;
  function wireSeg(id, onChange) {
    $(id).addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      onChange();
    });
  }

  let me = null;   // { id, email, role }
  let tab = 'tickets';

  // ---------- auth ----------
  async function loadMe(session) {
    if (!session) return null;
    const { data } = await sb.from('staff').select('role, email').eq('user_id', session.user.id).maybeSingle();
    return data ? { id: session.user.id, email: session.user.email, role: data.role } : null;
  }
  function showLogin() {
    $('app').hidden = true;
    $('login-view').hidden = false;
    $('login-email').focus();
  }
  function showApp() {
    $('login-view').hidden = true;
    $('app').hidden = false;
    $('me-email').textContent = me.email;
    $('me-role').textContent = me.role;
    $('tab-staff').hidden = me.role !== 'admin';
    openTab(tab);
    refreshCounts();
  }

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('login-error');
    err.textContent = '';
    const email = $('login-email').value.trim();
    const pass = $('login-pass').value;
    if (!email || !pass) { err.textContent = 'Enter your email and password.'; return; }
    const submit = e.target.querySelector('button[type="submit"]');
    submit.disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    submit.disabled = false;
    if (error) { err.textContent = /invalid/i.test(error.message) ? 'Wrong email or password.' : error.message; return; }
    me = await loadMe(data.session);
    if (!me) {
      await sb.auth.signOut();
      err.textContent = "This account isn't on the staff list. Ask an admin to add you.";
      return;
    }
    e.target.reset();
    showApp();
  });
  $('logout').addEventListener('click', async () => {
    await sb.auth.signOut();
    me = null;
    showLogin();
  });

  // ---------- tabs ----------
  function openTab(name) {
    tab = name;
    document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
    document.querySelectorAll('[data-view]').forEach(v => { v.hidden = v.dataset.view !== name; });
    ({ tickets: loadTickets, reports: loadReports, users: loadUsers, staff: loadStaff })[name]();
  }
  document.querySelector('nav').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (b) openTab(b.dataset.tab);
  });
  async function refreshCounts() {
    const [t, r] = await Promise.all([
      sb.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    [['count-tickets', t.count], ['count-reports', r.count]].forEach(([id, n]) => {
      $(id).hidden = !n;
      $(id).textContent = n || '';
    });
  }

  // ---------- tickets ----------
  let tickets = [];
  let selected = null;
  async function loadTickets() {
    let q = sb.from('support_tickets')
      .select('id, code, name, email, topic, status, created_at, support_messages(sender, body, created_at)')
      .order('created_at', { ascending: false })
      .limit(200);
    const f = segValue('ticket-filter');
    if (f !== 'all') q = q.eq('status', f);
    const { data, error } = await q;
    if (error) { toast("Couldn't load tickets: " + error.message); return; }
    tickets = data.map(t => {
      t.support_messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      t.last = t.support_messages[t.support_messages.length - 1] || null;
      return t;
    });
    renderTicketList();
    if (selected) {
      const fresh = tickets.find(t => t.id === selected);
      if (fresh) renderThread(fresh);
    }
  }
  function renderTicketList() {
    const list = $('ticket-list');
    const q = $('ticket-search').value.trim().toLowerCase();
    const rows = tickets.filter(t => !q || [t.name, t.email, t.code, t.topic].join(' ').toLowerCase().includes(q));
    list.textContent = '';
    if (!rows.length) { list.appendChild(el('p', 'empty', 'No tickets here')); return; }
    rows.forEach(t => {
      const b = el('button', 'item');
      b.type = 'button';
      b.setAttribute('aria-current', t.id === selected);
      const top = el('div', 'item-top');
      top.append(el('strong', '', t.name), el('span', 'pill ' + t.status, t.status));
      const meta = el('div', 'dim', `${t.code} · ${t.topic} · ${ago(t.last ? t.last.created_at : t.created_at)}`);
      const snip = el('div', 'snippet', t.last ? (t.last.sender === 'staff' ? 'You: ' : '') + t.last.body : '');
      b.append(top, meta, snip);
      b.addEventListener('click', () => { selected = t.id; renderTicketList(); renderThread(t); });
      list.appendChild(b);
    });
  }
  function renderThread(t) {
    const box = $('thread');
    box.textContent = '';
    const head = el('div', 'thread-head');
    const info = el('div');
    info.appendChild(el('h2', '', `${t.code} · ${t.topic}`));
    const who = el('p', 'dim');
    who.append(t.name + ' · ');
    const mail = el('a', '', t.email);
    mail.href = 'mailto:' + t.email + '?subject=' + encodeURIComponent(`Re: your Void Links support request ${t.code}`);
    who.append(mail, ' · opened ' + ago(t.created_at));
    info.appendChild(who);
    const actions = el('div', 'thread-actions');
    if (t.status !== 'closed') actions.appendChild(btn('Close ticket', '', () => setTicketStatus(t, 'closed')));
    else actions.appendChild(btn('Reopen', '', () => setTicketStatus(t, 'open')));
    if (t.status === 'open') actions.appendChild(btn('Mark answered', '', () => setTicketStatus(t, 'answered')));
    head.append(info, actions);

    const msgs = el('div', 'msgs');
    t.support_messages.forEach(m => {
      const b = el('div', 'msg ' + (m.sender === 'staff' ? 'staff' : 'user'));
      b.appendChild(el('small', '', `${m.sender === 'staff' ? 'Support team' : t.name} · ${ago(m.created_at)}`));
      b.appendChild(document.createTextNode(m.body));
      msgs.appendChild(b);
    });

    const reply = el('form', 'reply');
    const ta = el('textarea');
    ta.rows = 2;
    ta.maxLength = 2000;
    ta.placeholder = 'Write a reply… (Ctrl+Enter to send)';
    ta.setAttribute('aria-label', 'Reply');
    const send = el('button', 'btn btn-primary', 'Send');
    send.type = 'submit';
    reply.append(ta, send);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) reply.requestSubmit(); });
    reply.addEventListener('submit', async e => {
      e.preventDefault();
      const body = ta.value.trim();
      if (!body) return;
      send.disabled = true;
      const { error } = await sb.from('support_messages').insert({ ticket_id: t.id, sender: 'staff', body });
      send.disabled = false;
      if (error) { toast("Couldn't send: " + error.message); return; }
      ta.value = '';
      if (t.status === 'open') await sb.from('support_tickets').update({ status: 'answered' }).eq('id', t.id);
      toast('Reply sent');
      await loadTickets();
      refreshCounts();
    });

    box.append(head, msgs, reply);
    msgs.scrollTop = msgs.scrollHeight;
  }
  async function setTicketStatus(t, status) {
    const { error } = await sb.from('support_tickets').update({ status }).eq('id', t.id);
    if (error) { toast(error.message); return; }
    toast('Ticket ' + status);
    await loadTickets();
    refreshCounts();
  }
  wireSeg('ticket-filter', () => { selected = null; $('thread').innerHTML = '<p class="thread-empty">Pick a ticket to read it</p>'; loadTickets(); });
  $('ticket-search').addEventListener('input', renderTicketList);
  $('ticket-refresh').addEventListener('click', () => { loadTickets(); refreshCounts(); });

  // ---------- reports ----------
  async function loadReports() {
    let q = sb.from('reports').select('*').order('created_at', { ascending: false }).limit(300);
    const f = segValue('report-filter');
    if (f !== 'all') q = q.eq('status', f);
    const { data, error } = await q;
    const body = $('report-rows');
    body.textContent = '';
    if (error) { toast("Couldn't load reports: " + error.message); return; }
    if (!data.length) {
      const tr = el('tr');
      const td = el('td', 'empty', 'No reports');
      td.colSpan = 6;
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    const reasons = { spam: 'Spam or scam', impersonation: 'Impersonation', harmful: 'Harmful content', other: 'Other' };
    data.forEach(r => {
      const tr = el('tr');
      const page = el('td');
      page.appendChild(pageLink(r.username));
      const actions = el('div', 'actions');
      actions.append(
        btn(r.status === 'open' ? 'Resolve' : 'Reopen', '', () => setReport(r.id, r.status === 'open' ? 'resolved' : 'open')),
        btn('Delete page', 'btn-danger', () => deletePage(r.username)),
      );
      const act = el('td');
      act.appendChild(actions);
      const status = el('td');
      status.appendChild(el('span', 'pill ' + r.status, r.status));
      tr.append(page, el('td', '', reasons[r.reason] || r.reason), el('td', 'muted', r.details || '—'), el('td', 'dim', ago(r.created_at)), status, act);
      body.appendChild(tr);
    });
  }
  async function setReport(id, status) {
    const { error } = await sb.from('reports').update({ status }).eq('id', id);
    if (error) { toast(error.message); return; }
    loadReports();
    refreshCounts();
  }
  wireSeg('report-filter', loadReports);
  $('report-refresh').addEventListener('click', () => { loadReports(); refreshCounts(); });

  async function deletePage(username) {
    if (!confirm(`Delete the page @${username}? The account stays, but the page is removed.`)) return;
    const { error } = await sb.from('pages').delete().eq('username', username);
    if (error) { toast("Couldn't delete: " + error.message); return; }
    await sb.from('reports').update({ status: 'resolved' }).eq('username', username).eq('status', 'open');
    toast('Page deleted');
    if (tab === 'reports') loadReports(); else loadUsers();
    refreshCounts();
  }

  // ---------- users ----------
  let users = [];
  async function loadUsers() {
    const { data, error } = await sb.rpc('admin_list_users');
    if (error) { toast("Couldn't load users: " + error.message); return; }
    users = data;
    renderUsers();
  }
  function renderUsers() {
    const q = $('user-search').value.trim().toLowerCase();
    const rows = users.filter(u => !q || [u.email, u.name, u.username].join(' ').toLowerCase().includes(q));
    $('user-count').textContent = `${rows.length} of ${users.length}`;
    const body = $('user-rows');
    body.textContent = '';
    rows.forEach(u => {
      const tr = el('tr');
      const email = el('td');
      email.append(u.email || '—');
      if (!u.confirmed) email.append(' ', el('span', 'pill', 'unconfirmed'));
      const page = el('td');
      if (u.username) page.appendChild(pageLink(u.username)); else page.append('—');
      const act = el('td');
      const actions = el('div', 'actions');
      if (u.username) actions.appendChild(btn('Delete page', 'btn-danger', () => deletePage(u.username)));
      act.appendChild(actions);
      tr.append(email, el('td', '', u.name || '—'), page, el('td', '', String(u.views || 0)),
        el('td', 'dim', u.provider), el('td', 'dim', ago(u.joined)), el('td', 'dim', ago(u.last_sign_in)), act);
      body.appendChild(tr);
    });
  }
  $('user-search').addEventListener('input', renderUsers);
  $('user-refresh').addEventListener('click', loadUsers);

  // ---------- staff (admins) ----------
  async function loadStaff() {
    const { data, error } = await sb.from('staff').select('*').order('created_at');
    const body = $('staff-rows');
    body.textContent = '';
    if (error) { toast(error.message); return; }
    data.forEach(s => {
      const tr = el('tr');
      const role = el('td');
      if (s.user_id === me.id) {
        role.append(s.role + ' (you)');
      } else {
        const sel = el('select');
        sel.setAttribute('aria-label', 'Role for ' + s.email);
        ['support', 'admin'].forEach(r => { const o = el('option', '', r[0].toUpperCase() + r.slice(1)); o.value = r; sel.appendChild(o); });
        sel.value = s.role;
        sel.addEventListener('change', async () => {
          const { error: e } = await sb.from('staff').update({ role: sel.value }).eq('user_id', s.user_id);
          toast(e ? e.message : 'Role updated');
        });
        role.appendChild(sel);
      }
      const act = el('td');
      if (s.user_id !== me.id) {
        act.appendChild(btn('Remove', 'btn-danger', async () => {
          if (!confirm(`Remove ${s.email} from staff? Their account stays, but they lose portal access.`)) return;
          const { error: e } = await sb.from('staff').delete().eq('user_id', s.user_id);
          toast(e ? e.message : 'Removed');
          loadStaff();
        }));
      }
      tr.append(el('td', '', s.email), role, el('td', 'dim', ago(s.created_at)), act);
      body.appendChild(tr);
    });
  }

  $('staff-create').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const err = f.querySelector('.error');
    err.textContent = '';
    const email = f.email.value.trim();
    const password = f.password.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter a valid email.'; return; }
    if (password.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
    const submit = f.querySelector('button[type="submit"]');
    submit.disabled = true;
    const { data, error } = await sb.functions.invoke('admin-staff', { body: { action: 'create', email, password, role: f.role.value } });
    submit.disabled = false;
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {}
      if (/not found|failed to send|404|fetch/i.test(msg)) {
        msg = 'The admin-staff function isn\'t deployed yet. Deploy it (see setup steps), or create the login in Supabase → Authentication → Add user and use "Make an existing account staff".';
      }
      err.textContent = msg;
      return;
    }
    f.reset();
    toast(`Login created for ${data.email}`);
    loadStaff();
  });

  $('staff-existing').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const err = f.querySelector('.error');
    err.textContent = '';
    const email = f.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter a valid email.'; return; }
    const { error } = await sb.rpc('admin_add_staff', { p_email: email, p_role: f.role.value });
    if (error) { err.textContent = error.message; return; }
    f.reset();
    toast('Added to staff');
    loadStaff();
  });

  // Keep tickets and counts fresh while the portal is open
  setInterval(() => {
    if (!me || document.hidden) return;
    refreshCounts();
    if (tab === 'tickets') loadTickets();
  }, 20000);

  // ---------- start ----------
  (async () => {
    const { data } = await sb.auth.getSession();
    me = await loadMe(data.session);
    if (me) showApp(); else showLogin();
  })();
})();
