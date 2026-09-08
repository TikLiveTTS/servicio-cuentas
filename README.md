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

Build pack `dockercompose` sobre `docker-compose.yml`. El contenedor `api` corre
`db/migrate.js` antes de escuchar: las tablas se crean solas en el primer
arranque, en el schema `DB_SCHEMA` (default `cuentas`).

1. **Recurso nuevo** → Docker Compose, repo `TikLiveTTS/servicio-cuentas`, branch
   `main`, compose `/docker-compose.yml`.
2. **Environment variables**:
   - `POSTGRES_URL` = `postgresql://postgres:<POSTGRES_PASSWORD de Supabase>@supabase-db:5432/postgres`
   - `SESSION_SECRET` = `openssl rand -hex 32`
   - Polar: vacías por ahora.
3. **Red**: activar *Connect To Predefined Network* en este recurso **y** en el
   servicio `supabase` (así ambos quedan en la red `coolify` y `supabase-db`
   resuelve por nombre). Redeploya Supabase (~30s).
4. **FQDN**: `cuentas.tiklivetts.es` → puerto `4000`. DNS: A record `cuentas` →
   IP del VPS.
5. Deploy. Logs esperados: `[migrate] 2 migracion(es) aplicadas` +
   `[servicio-cuentas] escuchando en :4000`.
6. Verificar: `curl https://cuentas.tiklivetts.es/api/health` → `{"ok":true}`.
