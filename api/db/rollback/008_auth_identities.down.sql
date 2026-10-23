-- Revierte 008_auth_identities.sql.
-- OJO: si para este momento ya existen usuarios sin password_hash (creados
-- via Google), el ADD de la restriccion NOT NULL de abajo va a fallar hasta
-- que esas filas tengan un hash valido.
DROP TABLE auth_identities;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
