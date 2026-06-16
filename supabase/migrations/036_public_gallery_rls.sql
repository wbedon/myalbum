-- Allow anon to read public albums
CREATE POLICY "public_albums_anon_select" ON albums
  FOR SELECT USING (is_public = true);

-- Allow anon to read approved stickers in public albums
CREATE POLICY "public_album_stickers_anon_select" ON stickers
  FOR SELECT USING (
    status = 'approved'
    AND album_id IN (SELECT id FROM albums WHERE is_public = true)
  );
