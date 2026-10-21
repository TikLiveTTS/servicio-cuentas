-- Revierte 009_avatar_banner.sql.
ALTER TABLE users DROP COLUMN avatar_actualizado_at, DROP COLUMN banner_actualizado_at;
