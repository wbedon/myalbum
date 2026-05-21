-- Agrega columna name_band a templates para soporte de nombre dinámico en sticker.
-- Ejecutar en SQL Editor de Supabase.

ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS name_band JSONB;

-- Actualizar la plantilla Ecuador con las coordenadas reales de su banda de nombre.
-- Coordenadas normalizadas (0–1) sobre una imagen de 848×1251 px.
UPDATE public.templates
SET name_band = '{
  "x": 0.03,
  "y": 0.837,
  "width": 0.72,
  "height": 0.065,
  "color": "#FFFFFF",
  "font_size": 0.055,
  "uppercase": true
}'::jsonb
WHERE name ILIKE '%ecuador%';
