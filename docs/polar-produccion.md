# Polar producción — puesta en marcha y test de pago real

Org `tiklivetts` (`088bfba1-e79f-43d1-82d5-683efa007ccd`). API: `https://api.polar.sh/v1`.

| Plan | Producto Polar | Precio original | Precio de test |
|---|---|---|---|
| pro (año) | `11e9dfe6-6b0a-4682-b4de-b2606d66fef0` | 85 USD/año (8500) | 1 USD/año |
| sin-promos (año) | `e1d5cdce-7f7e-4681-b161-3f409807d85c` | 25 USD/año (2500) | 1 USD/año |
| pro (mes) | `bc669875-1d54-4f87-b14e-565f67b498a2` | 8 USD/mes (800) | 1 USD/mes |
| sin-promos (mes) | `5d3fd9f1-b6fb-4df8-a2ba-16727c2e2d20` | 3 USD/mes (300) | 1 USD/mes |

El plan local es siempre `pro` | `sin-promos`; mensual y anual solo cambian el producto de Polar
(la columna `subscriptions.intervalo` guarda cuál, migración 007). Un product_id que no esté en las 4 env vars
se resuelve como `pro`: **cargar los 2 ids mensuales antes de vender**, o Sin Promos mensual escalaría a Pro.

Cambio de intervalo (`POST /api/subscription/change-interval`): `PATCH /v1/subscriptions/{id}` con
`product_id` nuevo y `proration_behavior: "next_period"` (valor de la doc oficial de Polar; el cambio queda en
`pending_update` y aplica en la próxima renovación, sin reembolso ni cobro inmediato). Si faltan las env vars
mensuales responde 501 `errors.notImplemented` y la app cae al flujo cancelar + recontratar.

## Checklist Coolify (sin valores secretos)
1. Variables del recurso `api`:
   - `POLAR_API_KEY` = organization access token (solo Coolify, nunca git)
   - `POLAR_WEBHOOK_SECRET` = `polar_whs_` + 32+ chars aleatorios (el mismo valor se usa al crear el webhook)
   - `POLAR_PRODUCT_ID_PRO_ANUAL` = id Pro de la tabla
   - `POLAR_PRODUCT_ID_SIN_PROMOS` = id Sin Promos de la tabla
   - `POLAR_PRODUCT_ID_PRO_MENSUAL` y `POLAR_PRODUCT_ID_SIN_PROMOS_MENSUAL` = ids mensuales (tras crear los productos)
   - Borrar `POLAR_ENV` si existe.
2. Redeploy: al arrancar corren solas las migraciones pendientes (`006_...`, `007_intervalo_suscripcion.sql`; log `[migrate] aplicada 00X_...`).
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
