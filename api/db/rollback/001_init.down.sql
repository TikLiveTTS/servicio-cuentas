-- Revierte 001_init.sql. Aplicar a mano con psql si hay que hacer rollback.
DROP TABLE IF EXISTS webhook_events;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS entitlements;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS users;
-- schema_migrations se deja; borrar la fila si se re-migra:
--   DELETE FROM schema_migrations WHERE filename IN ('001_init.sql','002_seed_planes.sql');
