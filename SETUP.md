# Void Links: setup guide

How to run your own copy of Void Links: database, hosting, social login and Spotify.
Do the parts in order. Each step says where to click.

Replace `voids.wtf` with your own domain everywhere below.

**Rules for secrets**
- `supabase-config.js` only holds public values: the Supabase URL, the **publishable** key and the Spotify **Client ID**.
- Never put the Supabase **secret (service_role) key** or any OAuth **Client Secret** in a website file. They only go into the Supabase dashboard.
- `.env` files are ignored by `.gitignore`.

**Your Supabase callback URL** (used for social login):

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

---

## Part A: Database (Supabase)

1. Create a free project at **supabase.com**.
2. Open **SQL Editor → New query**. For each file below, paste the whole file, press **Run**, and check it says *Success*. Go in this order:

   | # | File | What it adds |
   |---|---|---|
   | 1 | `supabase/schema.sql` | Tables, Row Level Security, storage bucket |
   | 2 | `supabase/admin.sql` | Staff portal, page reports |
   | 3 | `supabase/upgrade-links-cursors.sql` | Passwords, schedules, use limits, audit log, page cursors |
   | 4 | `supabase/run-this-once.sql` | Clean addresses, reserved names, rate limits, first admin |
   | 5 | `supabase/upgrade-go-links.sql` | Short links and pages can share a name |
   | 6 | `supabase/upgrade-api.sql` | Public API keys |
   | 7 | `supabase/upgrade-views.sql` | Page views count once a day per visitor |
   | 8 | `supabase/upgrade-reports.sql` | Shareable link reports |

   Before running file 4, replace `YOUR-ADMIN-EMAIL@example.com` near the end with the email you'll sign up with. That account becomes the first admin. Every file is safe to run again.
3. **Project Settings → API**: copy the **Project URL** and the **publishable** key into `supabase-config.js` (`url` and `key`).
4. Optional, for adding staff from the portal: **Edge Functions → Create a function** named `admin-staff`, paste `supabase/functions/admin-staff/index.ts`, and **Deploy**. It reads the secret key from Supabase's own settings, never from this repo.

---

## Part B: Hosting (Cloudflare Pages)

1. Push this folder to a GitHub repository.
2. **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git**, then pick the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** leave empty
   - **Build output directory:** `/`
4. **Save and Deploy.** Each push to `main` redeploys the site by itself.
5. **Custom domains** (in the Pages project): add your domain (for example `voids.wtf`) and a `go.` subdomain (`go.voids.wtf`). Short links live on `go.`; profile pages live on the main domain.
6. If you use different domains, update `siteUrl` and `linkUrl` in `supabase-config.js`.

What runs where:
- `functions/_middleware.js` sends short links (`go.voids.wtf/abc`) to their destination, opens profile pages (`voids.wtf/name`) and serves the staff portal at `/admin` (the portal itself checks that you are staff).
- `functions/api/v1/` is the public REST API.
- `_routes.json` makes plain files (scripts, images, pages) skip the functions, so they load fast.
- `_headers` sets the security headers, including the Content Security Policy.

### Run it on your computer

```bash
npx wrangler pages dev . --port 8788
```

Then open http://localhost:8788. To look at the pages without the redirect functions, `python -m http.server 8790` also works.

---

## Part C: Sign-in settings

**Supabase → Authentication → URL Configuration**
- **Site URL:** `https://voids.wtf`
- **Redirect URLs:** add `https://voids.wtf/**` (and `http://localhost:8788/**` for testing).

**Emails:** set up an SMTP sender in **Authentication → Emails → SMTP**, otherwise Supabase sends only a few sign-up emails per hour. Paste the templates from `supabase/email-templates/`.

---

## Part D: Google, GitHub and Discord login

Each provider gives you a **Client ID** and a **Client Secret**. Both go into **Supabase → Authentication → Sign In / Providers**, never into the website files. Once a provider works, add its name to `oauth` in `supabase-config.js`, for example `oauth: ['github', 'google', 'discord']`.

### GitHub
1. github.com → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Homepage URL:** `https://voids.wtf`. **Authorization callback URL:** your Supabase callback URL.
3. Copy the **Client ID**, generate a **client secret**, and paste both into Supabase → **GitHub**.

### Google
1. **console.cloud.google.com** → new project → **OAuth consent screen** (External).
2. **Authorized domains:** `supabase.co` and your domain.
3. **Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `https://voids.wtf`
   - **Authorized redirect URIs:** your Supabase callback URL
4. Paste the Client ID and secret into Supabase → **Google**. Publish the app (or add test users) so others can sign in.

### Discord
1. **discord.com/developers/applications → New Application**.
2. **OAuth2 → Redirects:** add your Supabase callback URL.
3. Paste the Client ID and secret into Supabase → **Discord**.

---

## Part E: Spotify ("Connect Spotify" on profile pages)

1. **developer.spotify.com/dashboard → Create app**, and tick **Web API**.
2. **Redirect URIs:** add `https://voids.wtf/`. For local testing, add `http://127.0.0.1:8788/` (Spotify doesn't allow the word "localhost").
3. Copy the **Client ID** into `spotifyClientId` in `supabase-config.js`. The Client Secret is **not** needed: sign-in uses PKCE.
4. New Spotify apps are in *Development mode*: add each Spotify account that should connect under **User Management**.

The song shows to everyone who visits once the owner adds their **Discord ID** in the page editor (after joining the Lanyard Discord server). Without it, it shows only on the owner's own device.

---

## Part F: Checklist before a demo

- [ ] All eight SQL files from Part A have been run, with your email in `run-this-once.sql`.
- [ ] Sign-in URLs and redirect URLs point at your domain (Part C).
- [ ] An email sender is set up, or "Confirm email" is off for the demo.
- [ ] Open the Supabase project in the days before: free projects pause after 7 days without activity.
- [ ] Test everything once on the live site in a private window: sign up, publish a page, shorten a link and open it, share a report, use the help bot, check the staff portal at `/admin`.
