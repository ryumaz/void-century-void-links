// Site settings. Everything here is safe to be public.
// The publishable key is meant to ship in the website: the Row Level Security
// rules in supabase/schema.sql decide what it can touch.
// Never put the secret (service_role) key, or any OAuth client SECRET, in this file.
window.SUPABASE_CONFIG = {
  url: 'https://agbsbbkrinewplajdwax.supabase.co',
  key: 'sb_publishable_eKJmkapRV3BNWNehHcRVMw_Go_JQkdg',

  // Social logins switched on in Supabase → Authentication → Sign In / Providers.
  // Add each one after you set it up, e.g. ['github', 'google', 'discord'].
  oauth: ['github', 'discord', 'google'],

  // The live address. Short links, page links and QR codes use it.
  // On the live domain or a host's preview address (Cloudflare *.pages.dev, the old
  // *.netlify.app) the site uses the address it was opened on, so every copy works.
  siteUrl: /^(voids\.wtf|[\w-]+\.pages\.dev|[\w-]+\.netlify\.app)$/.test(location.host) ? location.origin : 'https://voids.wtf',

  // Short links live on their own subdomain (go.voids.wtf/abc), so a short link and
  // a profile page (voids.wtf/abc) can share a name. Preview addresses have no
  // subdomain, so there links use the same address as the site.
  linkUrl: /^[\w-]+\.(pages\.dev|netlify\.app)$/.test(location.host) ? location.origin : 'https://go.voids.wtf',

  // Spotify app Client ID (developer.spotify.com/dashboard) for "Connect Spotify".
  // The Client ID is public; the Client Secret is NOT needed and must not go here.
  spotifyClientId: 'c1b1bea7907f4afb87adcb1ea48b5652',
};
