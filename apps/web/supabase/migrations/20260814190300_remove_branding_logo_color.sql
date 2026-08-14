-- The custom bill logo / brand colour feature is removed entirely - no tier
-- offers it. Workspace name and theme preference stay (not part of this
-- feature).
ALTER TABLE public.settings
  DROP COLUMN IF EXISTS brand_logo_url,
  DROP COLUMN IF EXISTS brand_primary_color;
