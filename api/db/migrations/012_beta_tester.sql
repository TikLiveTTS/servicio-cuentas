-- 012_beta_tester.sql — rol de canal de actualizaciones por usuario: decide
-- que versiones del cliente Electron le aparecen como "ultima version".
--   'user'  (default) — solo estables
--   'beta'  — estables + beta testers (builds "-beta.N")
--   'admin' — estables + beta + alpha (builds "-alpha.N", solo para probar
--             en produccion sin molestar a nadie mas)
-- Se asigna a mano via psql; no hay ruta admin para esto todavia.

ALTER TABLE users ADD COLUMN rol_canal text NOT NULL DEFAULT 'user'
  CHECK (rol_canal IN ('user', 'beta', 'admin'));
