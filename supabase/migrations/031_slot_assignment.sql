-- Permite al organizador asignar un slot específico a cada participante.
-- El participante crea su sticker únicamente en el slot que le fue asignado.

ALTER TABLE album_slots
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Un usuario solo puede estar asignado a un slot por álbum
CREATE UNIQUE INDEX IF NOT EXISTS idx_album_slots_one_per_user
  ON album_slots(album_id, assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;

-- Los admins del álbum pueden actualizar la asignación de slots
CREATE POLICY "admin can assign slots"
  ON album_slots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM album_members
      WHERE album_members.album_id = album_slots.album_id
        AND album_members.user_id = auth.uid()
        AND album_members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM album_members
      WHERE album_members.album_id = album_slots.album_id
        AND album_members.user_id = auth.uid()
        AND album_members.role = 'admin'
    )
  );
