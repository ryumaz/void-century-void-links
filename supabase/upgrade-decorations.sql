-- =====================================================================
-- Void Links upgrade: page decorations (a figure or sticker on your page)
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
--
-- One column holds the whole setting, for example:
--   { "type": "cat", "pos": "left", "size": 34 }
--   { "type": "custom", "path": "<user id>/decoration-….webp", "pos": "bottom-right", "size": 40 }
-- type: a built-in template (cat, sparkles, moon, blackhole, butterflies, hearts) or custom.
-- Custom images live in the same "media" bucket as avatars and backgrounds.
-- =====================================================================

alter table public.pages add column if not exists deco jsonb;

alter table public.pages drop constraint if exists pages_deco_shape;
alter table public.pages add constraint pages_deco_shape check (
  deco is null or (
    jsonb_typeof(deco) = 'object'
    and deco->>'type' in ('cat', 'sparkles', 'moon', 'blackhole', 'butterflies', 'hearts', 'custom')
    and coalesce(deco->>'pos', 'left') in ('left', 'right', 'bottom-left', 'bottom-right')
    and coalesce((deco->>'size')::int, 30) between 10 and 70
    and (deco->>'type' <> 'custom' or char_length(coalesce(deco->>'path', '')) between 1 and 300)
  )
);

notify pgrst, 'reload schema';
