-- 009_avatar_banner.sql — foto de perfil y banner (Cloudinary). No se guarda
-- ninguna URL: el public_id en Cloudinary es siempre "avatares/<user_id>" /
-- "banners/<user_id>" (cada subida nueva pisa la anterior), asi que la URL
-- se reconstruye sola a partir del id del usuario. Estas columnas son solo
-- para cache-busting del lado del cliente (saber que cambio y cuando).

ALTER TABLE users
  ADD COLUMN avatar_actualizado_at timestamptz,
  ADD COLUMN banner_actualizado_at timestamptz;
