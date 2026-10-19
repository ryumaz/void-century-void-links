# Void Links

**Shorter links. Longer reach.** Short links you can lock, schedule and track, plus one profile page for everything you share.

Made by **Team Void Century**.

> **This code is shown for viewing and judging only.** It is not licensed for reuse: see [LICENSE](LICENSE).

**Live site:** https://voids.wtf
**Short links:** https://go.voids.wtf/&lt;name&gt; · **Profile pages:** https://voids.wtf/&lt;username&gt;

![Void Links home page](docs/screenshots/hero.jpg)

---

## Problem statement

People share links everywhere: bios, Discord servers, posters, client emails. The tools for it are split up and limited:

- Link shorteners give you a short address but little control. You can't easily lock a link with a password, open it on launch day, close it when a sale ends or cap how many times it's used.
- Click stats are often delayed, hidden behind a paywall or missing the basics: where people came from, which country and which device.
- Link-in-bio pages are a separate product with their own account, and most look the same.
- Sharing results with a client or teammate usually means screenshots.

## Our solution

Void Links puts all of this in one free place with one account:

1. **Short links with rules.** Every link can have a password, a start and end time, a use limit and campaign tags. Rules are checked inside the database, so they can't be skipped.
2. **Live click analytics.** Every click is counted the moment it happens, with country, device, source and time of day.
3. **A profile page that feels like yours.** A page at voids.wtf/yourname with a moving background, music, your own icons and cursor, and live Spotify and Discord status.
4. **Reports you can share.** One click turns any link's stats into a read-only page for a client or team. It needs no account and never shows single visitors.

---

## Features

### Short links
- Shorten any URL with a random or custom name, served at `go.voids.wtf/<name>`
- **Password-protected links:** passwords are hashed with bcrypt in the database, never stored in plain text
- **Scheduled links:** an opening time and an end time
- **Use limits:** a link stops after a set number of uses
- **Pause, resume or revoke** a link at any time
- **UTM builder:** add source, medium, campaign, term and content tags, with a live preview of the final link
- **Edit the destination later:** printed QR codes keep working
- **QR codes:** download or share a QR code for every link and page
- **CSV import:** create up to 200 links at once
- **Audit log:** every change to a link is recorded by database triggers

### Analytics
- Clicks per day over 7, 30 or 90 days
- Countries, devices, referring sites and busiest hours
- Top links and comparison with the previous period
- **Shareable reports:** a public, read-only stats page per link (`voids.wtf/report#…`) that can be turned off any time

### Profile pages
- Your own address: `voids.wtf/yourname`
- Background image, GIF or video (thin black bars in a video are trimmed automatically), with a dim and blur control
- Background music or the video's own sound, with a mute button for visitors
- Link icons for GitHub, Discord, Spotify, Instagram, YouTube and more, or upload your own icon
- Custom cursors: a crosshair or your own image
- **Live Spotify:** what you're playing, with a spinning disc and synced karaoke-style lyrics (LRCLIB)
- **Live Discord status** through Lanyard
- View counter: each visitor counts once a day, and your own visits don't count
- Visitors can report a page to the staff team

### Developer API
- REST API at `/api/v1/links` to list, create, read, update and delete links
- Personal API keys (`vl_…`); only a SHA-256 fingerprint is stored, never the key itself

### Help and safety
- **Vortex**, an on-page helper bot, answers questions and can open a support ticket with a real person
- A staff portal at `/admin` for page reports, support tickets and staff accounts
- Row Level Security on every table, rate limits against spam (200 new links per hour), and a Content Security Policy that only allows our own scripts and a few trusted sources
- Seven languages: English, Spanish, Portuguese, French, German, Turkish and Hindi
- A warning before you leave the page editor with unsaved changes

---

## Screenshots

| | |
|---|---|
| ![Tilted preview of the dashboard and profile pages](docs/screenshots/dashboard-preview.jpg) | ![Profile pages section](docs/screenshots/profile-pages.jpg) |
| Dashboard and page preview | Profile pages |
| ![Analytics dashboard](docs/screenshots/analytics.jpg) | ![Creating a link with UTM tags](docs/screenshots/links-utm.jpg) |
| Analytics (sample data) | Creating a link with UTM tags |
| ![Shared link report](docs/screenshots/shared-report.jpg) | ![FAQ](docs/screenshots/faq.jpg) |
| Shared report (sample data) | FAQ |

How the parts fit together:

![Architecture diagram](docs/architecture.png)

---

## Tech stack

| Part | What we used |
|---|---|
| Front end | Plain HTML, CSS and JavaScript (no framework, no build step) |
| 3D black hole | WebGL shader (`blackhole.js`) |
| Database, sign-in, file storage | [Supabase](https://supabase.com): PostgreSQL with Row Level Security, Auth (email, GitHub, Google, Discord), Storage, one Edge Function |
| Hosting | Cloudflare Pages |
| Server code | Cloudflare Pages Functions: short-link redirects, profile addresses, the public API |
| Live music and status | Spotify Web API (PKCE sign-in, no secret in the browser), Lanyard for Discord, LRCLIB for lyrics |
| Fonts | Geist, Geist Mono, Michroma (Google Fonts) |

### Project layout

```
index.html            Landing page, dashboard and page editor
pages.js              Profile pages: editor, renderer, Spotify, lyrics
backend.js            All database calls (window.DB)
i18n.js               Translations (7 languages)
helpbot.js/.css       Vortex helper bot and support tickets
blackhole.js          WebGL black hole background
go.html               Password, countdown and "not found" screens for links
report.html           Public shared report page
admin.html/.js        Staff portal
functions/            Cloudflare Pages Functions (redirects, routing, API)
supabase/             Database schema, upgrades, email templates, Edge Function
supabase-config.js    Public settings: Supabase URL, publishable key, Spotify Client ID
```

---

## Setup

How voids.wtf is built and deployed is described in **[SETUP.md](SETUP.md)**. The short version:

### Run it on your computer

The site has no build step. To look at the pages:

```bash
python -m http.server 8790
```

Then open http://localhost:8790. Short-link redirects, clean profile addresses and the API run as Cloudflare Pages Functions. To run those too:

```bash
npx wrangler pages dev . --port 8788
```

### How voids.wtf is deployed

1. **Supabase:** the database is set up by running these files in **SQL Editor**, in this order: `schema.sql`, `admin.sql`, `upgrade-links-cursors.sql`, `run-this-once.sql` (replace the admin email placeholder first), `upgrade-go-links.sql`, `upgrade-api.sql`, `upgrade-views.sql`, `upgrade-reports.sql`, `upgrade-moderation.sql`, `upgrade-hardening.sql`.
2. **Settings:** `supabase-config.js` holds the Supabase URL and the **publishable** key. The secret (service_role) key is never in any website file.
3. **Cloudflare Pages:** deploys from this repo on every push to `main`, with no build command. `voids.wtf` serves the site and pages; `go.voids.wtf` serves short links.
4. **Sign-in:** Supabase → Authentication → URL Configuration points at `https://voids.wtf`.

### Security notes

- `supabase-config.js` only holds values that are meant to be public. The publishable key can do nothing that Row Level Security doesn't allow.
- OAuth client secrets and the Supabase secret key live only in the Supabase dashboard, never in this repository.
- `.env` files are ignored by `.gitignore`.

---

## Team

**Void Century**

## License

Copyright (c) 2026 Void Century. All rights reserved. The code is public only so it can be viewed and judged; copying, reusing or hosting it needs our written permission. See [LICENSE](LICENSE).
