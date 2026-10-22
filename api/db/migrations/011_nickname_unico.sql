-- 011_nickname_unico.sql — nickname (columna "nombre") unico, sin distinguir
-- mayusculas/minusculas. Parcial (WHERE nombre <> '') porque las cuentas
-- viejas tienen nombre = '' por default y no eligieron nickname todavia; un
-- indice no-parcial rompería con la primera colision entre dos "".

CREATE UNIQUE INDEX users_nombre_unico_idx ON users (lower(nombre)) WHERE nombre <> '';
