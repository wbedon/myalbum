-- Metadatos de edición del sticker para restaurar el estado del editor
ALTER TABLE stickers
  ADD COLUMN IF NOT EXISTS cutout_url        TEXT,
  ADD COLUMN IF NOT EXISTS template_id       UUID REFERENCES templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS player_name       TEXT,
  ADD COLUMN IF NOT EXISTS club_name         TEXT,
  ADD COLUMN IF NOT EXISTS with_uniform      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sticker_transform JSONB,
  ADD COLUMN IF NOT EXISTS sticker_crop      JSONB,
  ADD COLUMN IF NOT EXISTS uniform_transform JSONB,
  ADD COLUMN IF NOT EXISTS uniform_crop      JSONB;
