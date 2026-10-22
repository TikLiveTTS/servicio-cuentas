-- 012_beta_tester.sql — flag por usuario para habilitar el canal de
-- actualizaciones experimentales (beta) en el cliente Electron. Default
-- false: por defecto nadie ve versiones prerelease como "ultima version".

ALTER TABLE users ADD COLUMN beta_tester boolean NOT NULL DEFAULT false;
