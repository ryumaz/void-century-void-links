# Void Links: setup guide

Everything you need to put Void Links online and switch on social login and Spotify.
Do the parts in order. Each step says exactly where to click.

**Your Supabase callback URL** (you'll paste it in several places):

```
https://agbsbbkrinewplajdwax.supabase.co/auth/v1/callback
```

Never paste a **Client Secret** or the Supabase **secret key** into any website file.
Secrets only go into the Supabase dashboard.

---

## Part A: Put the code in a private GitHub repo

You don't need to know Git commands: GitHub Desktop does it with buttons.

1. Go to **desktop.github.com**, download **GitHub Desktop**, install it, and sign in with your
   GitHub account (create one at github.com if you don't have it).
2. In GitHub Desktop: **File → Add local repository… → Choose…** and pick
   `C:\Users\Omen\Desktop\Hackathon`.
3. It says *"This directory does not appear to be a Git repository"*. Click the blue
   **create a repository** link.
   - **Name:** `void-links`
   - **Git ignore:** leave as *None* (the project already has a `.gitignore`)
   - Click **Create repository**.
4. On the left you'll see your files. At the bottom left, type a summary like `First version`
   and click **Commit to main**.
5. Click **Publish repository** at the top.
   - Keep the name `void-links`.
   - Make sure **Keep this code private** is ticked.
   - Click **Publish repository**.

**Every time you change code later:** open GitHub Desktop → type a short summary →
**Commit to main** → **Push origin**. Netlify then updates the live site by itself.

The old copies (`index_before_blackhole.html`, `index_yellow_version.html`, `preview.html`, the
two `.txt` notes) are listed in `.gitignore`, so they stay on your computer and don't go online.

---

## Part B: Host it on Netlify (free)

1. Go to **app.netlify.com** and choose **Sign up with GitHub**.
2. Click **Add new project** (or **Add new site**) → **Import an existing project** → **GitHub**.
3. Netlify asks for access to GitHub. Choose **Only select repositories**, pick **void-links**,
   and click **Install / Save**.
4. Pick the **void-links** repo. On the settings screen:
   - **Branch to deploy:** `main`
   - **Build command:** leave **empty**
   - **Publish directory:** `.` (a single dot; `netlify.toml` already says this)
   - Click **Deploy**.
5. Wait about a minute until it says **Published**.
6. Give it a nicer address: **Project configuration → Change project name** → for example
   `voidlinks`. Your site is now `https://voidlinks.netlify.app`.
7. Tell the code its address: open `supabase-config.js` and set
   ```js
   siteUrl: 'https://voidlinks.netlify.app',
   ```
   Then commit and push in GitHub Desktop (see Part A). Netlify redeploys automatically.
8. Tell Supabase the address: **Supabase → Authentication → URL Configuration**
   - **Site URL:** `https://voidlinks.netlify.app`
   - **Redirect URLs → Add URL:** `https://voidlinks.netlify.app/**`
     (keep `http://localhost:5517/**` for testing on your computer)
   - **Save**.
9. Test: open the site, sign up, publish your page, create a short link, then open the short
   link in a private/incognito window. It should jump to the long URL and count a click.

Because you deploy from GitHub, the fast redirect function in `netlify/edge-functions/` runs
too, so clicks also record the visitor's country.

**Addresses on the live site**

| What | Address |
|---|---|
| Home | `https://voidlinks.netlify.app` |
| A profile page | `https://voidlinks.netlify.app/@jefry` |
| A short link | `https://voidlinks.netlify.app/abc123` |
| Staff portal | `https://voidlinks.netlify.app/admin` |

---

## Part C: Google, GitHub and Discord login

Each provider gives you a **Client ID** and a **Client Secret**. Both go into
**Supabase → Authentication → Sign In / Providers**, never into the website files.
After each one works, add its name to `oauth` in `supabase-config.js`, for example
`oauth: ['github', 'google', 'discord'],` and push.

Social login only works on the live site (or `http://localhost:5517`), not on a page
opened by double-clicking the file.

### GitHub (easiest, about 3 minutes)

1. github.com → your avatar → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Fill in:
   - **Application name:** `Void Links`
   - **Homepage URL:** `https://voidlinks.netlify.app`
   - **Authorization callback URL:** the Supabase callback URL at the top of this guide
3. **Register application**. Copy the **Client ID**.
4. Click **Generate a new client secret** and copy it (it's shown only once).
5. Supabase → **Authentication → Sign In / Providers → GitHub** → turn it on, paste both, **Save**.
6. Add `'github'` to `oauth` in `supabase-config.js`.

### Google

1. Go to **console.cloud.google.com** → top bar project picker → **New project** → name it
   `Void Links` → **Create**, then make sure it's selected.
2. Menu → **APIs & Services → OAuth consent screen** (may be called **Google Auth Platform**)
   → **Get started**:
   - **App name:** `Void Links`, **User support email:** your email
   - **Audience:** **External**
   - **Contact email:** your email → agree → **Create**.
3. **Branding** page → **Authorized domains → Add domain:** `supabase.co` and `netlify.app` → **Save**.
4. **Clients → Create client**:
   - **Application type:** Web application, **Name:** `Void Links web`
   - **Authorized JavaScript origins:** `https://voidlinks.netlify.app` and
     `http://localhost:5517`
   - **Authorized redirect URIs:** the Supabase callback URL
   - **Create**, then copy the **Client ID** and **Client secret**.
5. **Audience** page: while it says **Testing**, only people you add under **Test users** can
   log in. Add your Gmail and any judges' emails, or click **Publish app** so anyone can sign in
   (email and profile access don't need Google's review).
6. Supabase → **Sign In / Providers → Google** → turn on, paste both, **Save**.
7. Add `'google'` to `oauth`.

### Discord

1. Go to **discord.com/developers/applications** → **New Application** → name `Void Links` → **Create**.
2. **OAuth2** in the left menu → **Redirects → Add Redirect** → paste the Supabase callback URL →
   **Save Changes**.
3. Copy the **Client ID**. Click **Reset Secret**, confirm, and copy the secret.
4. Supabase → **Sign In / Providers → Discord** → turn on, paste both, **Save**.
5. Add `'discord'` to `oauth`.

---

## Part D: Spotify ("Connect Spotify" on your page)

1. Go to **developer.spotify.com/dashboard**, log in with your Spotify account, accept the terms,
   and click **Create app**.
2. Fill in:
   - **App name:** `Void Links`, **App description:** `Shows what I'm listening to on my Void Links page`
   - **Website:** `https://voidlinks.netlify.app`
   - **Redirect URIs** (add each one):
     - `https://voidlinks.netlify.app/`
     - `https://voidlinks.netlify.app/index.html`
     - `http://127.0.0.1:5517/index.html` (for testing on your computer: Spotify doesn't allow
       the word "localhost", so open the site as `http://127.0.0.1:5517/index.html`)
   - **Which API/SDKs:** tick **Web API**.
   - Agree to the terms → **Save**.
3. Open the app → **Settings** → copy the **Client ID**. You do **not** need the Client Secret.
4. Put it in `supabase-config.js`:
   ```js
   spotifyClientId: 'paste-the-client-id-here',
   ```
   and push.
5. **User Management** (in the app's settings): new Spotify apps are in *Development mode*,
   so only the accounts listed here can connect. Add your own Spotify email (and anyone else
   who should be able to connect).
6. On the site: **Dashboard → My Page → Connect Spotify**, approve, then tick
   **Show what I'm listening to**.

Right now the live song shows to you on your device. Showing it to every visitor needs one
more small Supabase function that keeps your Spotify login on the server.

---

## Part F: Turn on advanced links, the audit log and page cursors (2 minutes)

Password-protected links, start/end times, use limits, pausing/revoking, the **Audit log** tab
and custom cursors on profile pages all need one extra database file. Until you run it, links
keep working as before and those options show a short "needs an upgrade" note.

1. Open your project on **supabase.com** → **SQL Editor** → **New query**.
2. Open `supabase/upgrade-links-cursors.sql` from this folder in Notepad, copy everything, paste it in.
3. Click **Run**. It should say *Success. No rows returned*. Running it again later is safe.
4. Reload the site.

How it works, in case a judge asks:
- A link password is hashed with bcrypt inside the database; the plain password is never stored
  and the browser can only see *whether* a link has one.
- Every rule (password, schedule, number of uses, paused, revoked) is checked by the database
  function `open_short_link`, so nobody can skip it by editing the page.
- The audit log is written by database triggers, so every change is recorded and can't be
  edited or deleted from the website.

---

## Part E: Before the judges see it

- [ ] `supabase/admin.sql` has been run, with your email on the last line (staff portal + reports).
- [ ] `supabase/upgrade-links-cursors.sql` has been run (advanced link options, audit log, page cursors).
- [ ] Email sender set up (Supabase → Authentication → Emails → SMTP), otherwise only a few
      sign-up emails per hour get sent. Or turn off "Confirm email" for the demo.
- [ ] Email templates pasted from `supabase/email-templates/`.
- [ ] Open the Supabase project in the days before judging: free projects pause after 7 days
      with no activity.
- [ ] Try everything once on the live site in a private window: sign up, publish a page,
      shorten a link, open it, use the help bot, report a page, check the staff portal.
