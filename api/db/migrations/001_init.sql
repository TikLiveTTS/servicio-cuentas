-- 001_init.sql — esquema base de cuentas + suscripciones.
-- search_path ya apunta al schema del servicio (lo setea migrate.js).

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- email case-insensitive

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  nombre        text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id                    text PRIMARY KEY,            -- 'free' | 'pro'
  nombre                text NOT NULL,
  precio_anual_centavos integer NOT NULL DEFAULT 0,
  polar_product_id      text
);

CREATE TABLE subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id               text NOT NULL REFERENCES plans(id),
  status                text NOT NULL,               -- active|canceled|past_due|revoked|paused
  polar_subscription_id text UNIQUE,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  current_period_end    timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_id_idx ON subscriptions (user_id);
CREATE INDEX subscriptions_status_idx ON subscriptions (status);

CREATE TABLE entitlements (
  feature_id text NOT NULL,
  plan_id    text NOT NULL REFERENCES plans(id),
  PRIMARY KEY (feature_id, plan_id)
);

-- Token opaco de sesión (decisión: revocable en logout / cambio de plan).
CREATE TABLE sessions (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- Idempotencia de webhooks de Polar.
CREATE TABLE webhook_events (
  event_id     text PRIMARY KEY,
  source       text NOT NULL DEFAULT 'polar',
  tipo         text,
  processed_at timestamptz NOT NULL DEFAULT now()
);
