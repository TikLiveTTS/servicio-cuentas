-- 004_seed_entitlements.sql — lista canónica de entitlements del plan Pro.
-- Los 7 originales se sembraron a mano en el SQL Editor del Studio (Fase 3);
-- esto los deja versionados y agrega 'overlay-decoraciones' (Fase 4: gate del
-- control "Fondo personalizado" de los overlays). Idempotente.
-- Fuente de verdad: documentacion/plan-suscripcion/04-features-pro.md.

INSERT INTO entitlements (feature_id, plan_id) VALUES
  ('bot-musical',          'pro'),
  ('soundpad',             'pro'),
  ('panel-movil',          'pro'),
  ('clips',                'pro'),
  ('mcp-agente',           'pro'),
  ('multi-canal',          'pro'),
  ('sin-promos',           'pro'),
  ('overlay-decoraciones', 'pro')
ON CONFLICT (feature_id, plan_id) DO NOTHING;
