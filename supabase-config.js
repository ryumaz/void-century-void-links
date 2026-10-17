// Site settings. Everything here is safe to be public.
// The publishable key is meant to ship in the website: the Row Level Security
// rules in supabase/schema.sql decide what it can touch.
// Never put the secret (service_role) key, or any OAuth client SECRET, in this file.
window.SUPABASE_CONFIG = {
  url: 'https://agbsbbkrinewplajdwax.supabase.co',
  key: 'sb_publishable_eKJmkapRV3BNWNehHcRVMw_Go_JQkdg',

  // Social logins switched on in Supabase → Authentication → Sign In / Providers.
  // Add each one after you set it up, e.g. ['github', 'google', 'discord'].
  oauth: [],

  // Your live address once deployed, e.g. 'https://voidlinks.netlify.app'.
  // Short links, page links and QR codes use it. Leave '' to use the current address.
  siteUrl: '',

  // Spotify app Client ID (developer.spotify.com/dashboard) for "Connect Spotify".
  // The Client ID is public; the Client Secret is NOT needed and must not go here.
  spotifyClientId: '',
};
