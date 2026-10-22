-- 013_password_reset_codes.sql — codigos de 6 digitos para "olvidaste tu
-- contraseña", enviados por email. Solo un codigo vivo por usuario (se borra
-- el anterior al pedir uno nuevo); expiran a los 10 minutos.

CREATE TABLE password_reset_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  intentos   integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_codes_user_id_idx ON password_reset_codes (user_id);
