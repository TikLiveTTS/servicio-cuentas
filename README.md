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

## Despliegue (Coolify) — YA DESPLEGADO en `cuentas.tiklivetts.es`

Build pack `dockercompose` sobre `docker-compose.yml`. El contenedor `api` corre
`db/migrate.js` antes de escuchar: las tablas se crean solas en el primer
arranque, en el schema `DB_SCHEMA` (default `cuentas`).

Recurso: proyecto Coolify `servicio-cuentas` / env `production`. Config aplicada:

1. **Fuente**: Public Git Repository, `github.com/TikLiveTTS/servicio-cuentas`,
   branch `main`, build pack Docker Compose, compose `/docker-compose.yml`.
   (El repo debe ser **público** para esta fuente; si se hace privado, cambiar a
   la fuente GitHub App.)
2. **Environment variables** (Coolify → Environment Variables):
   - `POSTGRES_URL` = `postgresql://postgres:<POSTGRES_PASSWORD de Supabase>@supabase-db-0d1y5zwwvajsdrzyride0awa:5432/postgres`
     — el host es el **nombre completo del contenedor** de Postgres de Supabase
     en la red `coolify` (nombre corto + UUID del recurso Supabase), NO `supabase-db`.
     Verificar con: `getent hosts supabase-db-<uuid>` desde el contenedor.
   - `SESSION_SECRET` = 64 hex (`openssl rand -hex 32`).
   - Polar: vacías hasta la Fase 2.
3. **Red**: *Advanced → Docker compose → Predefined network* = **Connect to
   predefined network** en este recurso **y** en el servicio `supabase`
   (*General → Network attachment*). Restart de Supabase (~60s).
4. **Dominio**: *Domains → Add* → service `api`, `https://cuentas.tiklivetts.es`,
   puerto `4000`. DNS: A record `cuentas` → IP del VPS (Hostinger).
5. Deploy. Logs esperados: `[migrate] …` + `[servicio-cuentas] escuchando en :4000`.
6. Verificar: `curl https://cuentas.tiklivetts.es/api/health` → `{"ok":true}`.

### Gotcha: propiedad del schema

El SQL Editor del Studio de Supabase corre como `supabase_admin`. Si el schema
`cuentas` o sus tablas se crean desde ahí, quedan de `supabase_admin` y el rol
`postgres` (con el que se conecta este servicio) da `permission denied for
schema cuentas`. Fix (una vez, desde el SQL Editor):

```sql
ALTER SCHEMA cuentas OWNER TO postgres;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='cuentas' LOOP
    EXECUTE format('ALTER TABLE cuentas.%I OWNER TO postgres', r.tablename);
  END LOOP;
END $$;
GRANT ALL ON SCHEMA cuentas TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA cuentas TO postgres;
```

Si `migrate.js` crea todo (deploy limpio sin tocar el Studio antes), no aplica.
