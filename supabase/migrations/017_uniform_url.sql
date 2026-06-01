-- Add uniform_url column to templates table
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS uniform_url TEXT;
