-- Allow anon to read reactions in public albums
CREATE POLICY "public_reactions_anon_select" ON sticker_reactions
  FOR SELECT USING (
    sticker_id IN (
      SELECT s.id FROM stickers s
      JOIN albums a ON a.id = s.album_id
      WHERE a.is_public = true AND s.status = 'approved'
    )
  );
