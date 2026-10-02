-- 007_intervalo_suscripcion.sql — planes mensuales: el plan local sigue siendo
-- 'pro' | 'sin-promos'; el intervalo de cobro vive en la suscripcion.
--   intervalo           = periodo del producto actual ('month' | 'year')
--   siguiente_intervalo = cambio programado en Polar (pending_update), NULL si no hay
-- Filas previas a 007 quedan NULL hasta el proximo webhook/reconciliacion.

ALTER TABLE subscriptions
  ADD COLUMN intervalo text CHECK (intervalo IN ('month', 'year')),
  ADD COLUMN siguiente_intervalo text CHECK (siguiente_intervalo IN ('month', 'year'));
