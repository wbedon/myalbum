CREATE TABLE sticker_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sticker_id UUID        NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  album_id   UUID        NOT NULL REFERENCES albums(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sticker_comments ENABLE ROW LEVEL SECURITY;

-- Members of the album can read comments
CREATE POLICY "members_read_comments" ON sticker_comments
  FOR SELECT USING (
    album_id IN (
      SELECT album_id FROM album_members WHERE user_id = auth.uid()
    )
  );

-- Members can post comments in their albums
CREATE POLICY "members_insert_comments" ON sticker_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    album_id IN (
      SELECT album_id FROM album_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own comments
CREATE POLICY "owners_delete_comments" ON sticker_comments
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX sticker_comments_sticker_idx ON sticker_comments(sticker_id);
CREATE INDEX sticker_comments_album_idx   ON sticker_comments(album_id);
