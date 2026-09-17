-- 005_seed_plan_sin_promos.sql — nuevo plan "Sin Promos" (25 USD/año), solo
-- desbloquea el entitlement 'sin-promos' (a diferencia de 'pro', que lo
-- incluye junto a otros 7). polar_product_id queda documentado acá aunque el
-- código real resuelve el plan por product_id vía env
-- (POLAR_PRODUCT_ID_SIN_PROMOS, ver polar/resolver-plan-id.js) — mismo patrón
-- que 'pro', cuya columna polar_product_id tampoco la lee src/.

INSERT INTO plans (id, nombre, precio_anual_centavos, polar_product_id) VALUES
  ('sin-promos', 'Sin Promos', 2500, '2c9408fe-1199-40d0-9beb-79382b3aab20')
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  precio_anual_centavos = EXCLUDED.precio_anual_centavos,
  polar_product_id = EXCLUDED.polar_product_id;

INSERT INTO entitlements (feature_id, plan_id) VALUES
  ('sin-promos', 'sin-promos')
ON CONFLICT (feature_id, plan_id) DO NOTHING;
