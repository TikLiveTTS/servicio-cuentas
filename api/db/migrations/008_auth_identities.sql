-- 008_auth_identities.sql — login/registro con proveedores externos (Google
-- hoy; mismo esquema sirve para otros proveedores de login mas adelante).
-- password_hash deja de ser obligatorio: un usuario puede nacer sin
-- contrasena si se registra via Google.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE auth_identities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         text NOT NULL,            -- 'google'
  provider_user_id text NOT NULL,            -- 'sub' del id_token del proveedor
  email            citext,                   -- email que reporto el proveedor
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id),        -- una cuenta Google = un solo user
  UNIQUE (user_id, provider)                  -- un user no vincula 2 cuentas Google
);
CREATE INDEX auth_identities_user_id_idx ON auth_identities (user_id);
