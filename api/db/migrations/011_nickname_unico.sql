-- 011_nickname_unico.sql — nickname (columna "nombre") unico, sin distinguir
-- mayusculas/minusculas. Parcial (WHERE nombre <> '') porque las cuentas
-- viejas tienen nombre = '' por default y no eligieron nickname todavia; un
-- indice no-parcial rompería con la primera colision entre dos "".
--
-- Cuentas reales de producción ya eligieron nickname al registrarse (nunca
-- fue único hasta ahora), asi que puede haber colisiones hoy. Antes de crear
-- el índice, se desambiguan con un sufijo numerado por antigüedad
-- (created_at): "fran" + "fran" -> "fran-1" + "fran-2". El down.sql de esta
-- migración solo borra el índice — no revierte este renombrado.

WITH duplicados AS (
  SELECT id, nombre,
         row_number() OVER (PARTITION BY lower(nombre) ORDER BY created_at) AS rn,
         count(*) OVER (PARTITION BY lower(nombre)) AS total
  FROM users
  WHERE nombre <> ''
)
UPDATE users u
SET nombre = d.nombre || '-' || d.rn
FROM duplicados d
WHERE u.id = d.id AND d.total > 1;

CREATE UNIQUE INDEX users_nombre_unico_idx ON users (lower(nombre)) WHERE nombre <> '';
