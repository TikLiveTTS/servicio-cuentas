-- 011_nickname_unico.sql — nickname (columna "nombre") unico, sin distinguir
-- mayusculas/minusculas. Parcial (WHERE nombre <> '') porque las cuentas
-- viejas tienen nombre = '' por default y no eligieron nickname todavia; un
-- indice no-parcial rompería con la primera colision entre dos "".
--
-- Cuentas reales de producción ya eligieron nickname al registrarse (nunca
-- fue único hasta ahora), asi que puede haber colisiones hoy. El down.sql de
-- esta migración solo borra el índice — no revierte estos renombrados.

-- Paso 1: a cada cuenta con nickname duplicado se le asigna como nickname
-- temporal la parte local de su propio email (antes de la @, saneada al
-- mismo formato que exige isNickname) — identifica a cada una con algo
-- propio, en vez de un sufijo arbitrario, hasta que elijan uno nuevo en
-- Ajustes.
WITH duplicados AS (
  SELECT id, email,
         count(*) OVER (PARTITION BY lower(nombre)) AS total
  FROM users
  WHERE nombre <> ''
)
UPDATE users u
SET nombre = left(regexp_replace(split_part(d.email, '@', 1), '[^a-zA-Z0-9_.]', '', 'g'), 32)
FROM duplicados d
WHERE u.id = d.id AND d.total > 1;

-- Paso 2: red de seguridad — si despues del paso 1 todavia queda alguna
-- colision (dos emails con la misma parte local en dominios distintos, o
-- coincidencia con el nickname que ya tenia elegido otro usuario), se
-- desambigua con un sufijo numerado por antigüedad de cuenta.
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
