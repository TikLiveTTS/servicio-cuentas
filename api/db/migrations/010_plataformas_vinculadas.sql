-- 010_plataformas_vinculadas.sql — Fase 1 de Twitch/Kick: vincular la cuenta.
-- Los tokens se guardan cifrados (ver api/src/lib/cifrado.js) — esta tabla
-- nunca tiene el valor en texto plano.

CREATE TABLE plataformas_vinculadas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plataforma             text NOT NULL,              -- 'twitch' | 'kick'
  plataforma_user_id     text NOT NULL,              -- user_id del canal en esa plataforma
  plataforma_username    text,                       -- para mostrar en el perfil
  access_token_cifrado   text NOT NULL,
  refresh_token_cifrado  text NOT NULL,
  expires_at             timestamptz NOT NULL,
  scopes                 text[] NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plataforma, plataforma_user_id),
  UNIQUE (user_id, plataforma)
);
CREATE INDEX plataformas_vinculadas_user_id_idx ON plataformas_vinculadas (user_id);
