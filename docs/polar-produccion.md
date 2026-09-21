# Polar producción — puesta en marcha y test de pago real

Org `tiklivetts` (`088bfba1-e79f-43d1-82d5-683efa007ccd`). API: `https://api.polar.sh/v1`.

| Plan | Producto Polar | Precio original | Precio de test |
|---|---|---|---|
| pro | `11e9dfe6-6b0a-4682-b4de-b2606d66fef0` | 85 USD/año (8500) | 1 USD/año |
| sin-promos | `e1d5cdce-7f7e-4681-b161-3f409807d85c` | 25 USD/año (2500) | 1 USD/año |

## Checklist Coolify (sin valores secretos)
1. Variables del recurso `api`:
   - `POLAR_API_KEY` = organization access token (solo Coolify, nunca git)
   - `POLAR_WEBHOOK_SECRET` = `polar_whs_` + 32+ chars aleatorios (el mismo valor se usa al crear el webhook)
   - `POLAR_PRODUCT_ID_PRO_ANUAL` = id Pro de la tabla
   - `POLAR_PRODUCT_ID_SIN_PROMOS` = id Sin Promos de la tabla
   - Borrar `POLAR_ENV` si existe.
2. Redeploy: al arrancar corre solo la migración `006_product_ids_produccion.sql` (log `[migrate] aplicada 006_...`).
3. Webhook (una vez, con `POLAR_API_KEY` y `POLAR_WEBHOOK_SECRET` en el entorno local):
   `node scripts/polar-precios.js webhook` (dry-run) y luego `... webhook --apply`.
   - URL: `https://cuentas.tiklivetts.es/api/webhooks/polar`, formato raw
   - Eventos: `subscription.created|updated|active|canceled|revoked|uncanceled|past_due`
4. Verificar: `curl https://cuentas.tiklivetts.es/api/health` → `{"ok":true}`.

## Sesión de checkout de prueba (no cobra)
`POLAR_PRODUCT_ID_PRO_ANUAL=... POLAR_PRODUCT_ID_SIN_PROMOS=... node scripts/polar-precios.js checkout-test --apply`

## Test con dinero real (usuario)
1. En la app, con una cuenta de prueba, elegir Pro → completar el pago de 1 USD en el checkout de Polar.
2. Comprobar: el evento llega (Polar → Webhooks → deliveries 200), y en la DB `subscriptions` hay fila `active` con `plan_id='pro'`; `/api/entitlements` de esa cuenta incluye los 8 de Pro.
3. Repetir con otra cuenta para Sin Promos: `plan_id='sin-promos'`, solo entitlement `sin-promos`.
4. Avisar; luego se restauran precios: `POLAR_PRODUCT_ID_PRO_ANUAL=... POLAR_PRODUCT_ID_SIN_PROMOS=... node scripts/polar-precios.js restaurar --apply` (dry-run sin `--apply`; verifica por API 8500 y 2500).
