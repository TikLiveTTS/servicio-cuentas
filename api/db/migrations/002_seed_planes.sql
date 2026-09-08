-- 002_seed_planes.sql — catálogo de planes. 'pro' arranca sin polar_product_id
-- (lo completa el agente 03 tras crear el producto en Polar).
-- Decisión de producto: solo suscripción ANUAL al lanzamiento.

INSERT INTO plans (id, nombre, precio_anual_centavos, polar_product_id) VALUES
  ('free', 'Free', 0, NULL),
  ('pro',  'Pro',  0, NULL)
ON CONFLICT (id) DO NOTHING;

-- entitlements: qué feature desbloquea qué plan. Placeholder — la lista real la
-- define el agente 04 (04-features-pro.md) y se agrega en 003_seed_entitlements.sql.
-- 'free' no tiene filas: todo lo no listado queda disponible para todos cuando
-- subscriptionsEnabled=false, y la app decide qué gatear.
