-- Admins del álbum pueden eliminar cualquier comentario en su álbum
CREATE POLICY "admins_delete_any_comment" ON sticker_comments
  FOR DELETE USING (
    album_id IN (
      SELECT album_id FROM album_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
