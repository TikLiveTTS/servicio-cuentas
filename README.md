# servicio-cuentas

Servicio server-side de **cuentas + suscripciones** para TikLive TTS.
Repo hermano de `telemetria-tts`, mismo patrón (`api/src/` modular, un archivo
por función; migraciones SQL versionadas corridas por `db/migrate.js` al
arrancar). Desplegado como app Coolify en el VPS; el dominio
`cuentas.tiklivetts.es` y el TLS los pone el proxy de Coolify.

Responsabilidades:

1. **Cuentas** — registro / login / logout / perfil, contra el Postgres de la
   Supabase self-hosted (fuente de verdad de usuarios y plan).
2. **Sesión** — token opaco en tabla `sessions`, revocable (logout, cambio de
   plan). Header `Authorization: Bearer <token>`.
3. **Pagos (Polar.sh)** — genera el checkout, recibe y verifica los webhooks,
   refleja el estado de suscripción en la tabla `subscriptions`. Job de
   reconciliación in-proceso.

La app de escritorio **nunca** habla con Supabase ni con Polar directo: todo
pasa por este servicio vía REST.

Contrato HTTP: ver `documentacion/plan-suscripcion/02-contrato-http.md` en el
repo `tiktok-tts`.

## Desarrollo

```bash
cd api
npm install
cp ../.env.example ../.env   # completar valores
node src/index.js
```

## Despliegue (Coolify)

Build pack `dockercompose` sobre `docker-compose.yml`. Variables de entorno
obligatorias en el panel de Coolify (ver `.env.example`). El contenedor `api`
corre `db/migrate.js` antes de escuchar en el puerto: las tablas se crean solas
en el primer arranque.
