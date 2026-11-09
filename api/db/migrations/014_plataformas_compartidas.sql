-- 014_plataformas_compartidas.sql — varias cuentas nuestras pueden vincular el
-- MISMO canal de Twitch/Kick.
--
-- Antes UNIQUE (plataforma, plataforma_user_id) impedia que un canal externo
-- estuviera vinculado a mas de un user_id: si la cuenta A ya tenia el canal,
-- la cuenta B recibia 409. Se saca esa restriccion. Se mantiene
-- UNIQUE (user_id, plataforma): cada cuenta nuestra sigue teniendo como
-- maximo UNA cuenta de cada plataforma.
--
-- El indice no-unico reemplaza al que creaba el UNIQUE para el lookup de los
-- webhooks (plataforma + plataforma_user_id -> todos los user_id).

ALTER TABLE plataformas_vinculadas
  DROP CONSTRAINT IF EXISTS plataformas_vinculadas_plataforma_plataforma_user_id_key;

CREATE INDEX IF NOT EXISTS plataformas_vinculadas_canal_idx
  ON plataformas_vinculadas (plataforma, plataforma_user_id);
