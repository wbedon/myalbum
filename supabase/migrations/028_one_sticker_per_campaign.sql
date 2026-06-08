-- Limitar a un sticker por usuario por campaña
ALTER TABLE stickers ADD CONSTRAINT stickers_album_user_unique UNIQUE (album_id, user_id);
