// Supabase Edge Function: admin-staff
// Lets an admin create support/admin logins (email + password) and remove staff.
// Runs on Supabase's servers with the secret service-role key, which never
// reaches the browser. Only callers whose account is an admin in public.staff
// can use it.
//
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor,
// name it "admin-staff", paste this file, Deploy.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Who is calling?
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: 'Please log in again.' }, 401);
  const { data: me } = await admin.from('staff').select('role').eq('user_id', caller.user.id).maybeSingle();
  if (me?.role !== 'admin') return json({ error: 'Only admins can manage staff.' }, 403);

  let body: { action?: string; email?: string; password?: string; role?: string; user_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  if (body.action === 'create') {
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const role = body.role === 'admin' ? 'admin' : 'support';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email.' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: email.split('@')[0] },
    });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return json({ error: taken ? 'That email already has an account. Use "Make existing account staff" instead.' : error.message }, 400);
    }
    const { error: staffError } = await admin.from('staff').insert({ user_id: data.user.id, email, role });
    if (staffError) return json({ error: staffError.message }, 400);
    return json({ ok: true, user_id: data.user.id, email, role });
  }

  if (body.action === 'remove') {
    if (!body.user_id) return json({ error: 'Missing user_id' }, 400);
    if (body.user_id === caller.user.id) return json({ error: "You can't remove yourself." }, 400);
    const { error } = await admin.from('staff').delete().eq('user_id', body.user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
