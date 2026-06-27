# Planificador de turnos sabatinos

Aplicación **Next.js 15** (App Router + TypeScript) para asignar turnos de los
sábados (enero–junio 2026) a un equipo de colaboradores. Los datos se guardan en
**Postgres (Neon)** mediante **Drizzle ORM**.

## Stack

- Next.js 15 (App Router, React Server Components + Server Actions)
- TypeScript
- Drizzle ORM + `@neondatabase/serverless` (driver HTTP)
- Postgres gestionado por **Neon** (integración de Vercel)

## Estructura

```
app/
  layout.tsx        Layout raíz
  page.tsx          Server Component: carga datos de la BD (render dinámico)
  actions.ts        Server Actions (CRUD + sugerir/limpiar planificación)
  globals.css
components/
  Planner.tsx       UI cliente (vistas Planificación y Colaboradores)
lib/
  planner.ts        Lógica pura del planificador (sin BD ni React)
  db/
    schema.ts       Tablas Drizzle: colaboradores, asignaciones
    index.ts        Cliente Drizzle/Neon (inicialización perezosa)
    migrate.ts      Aplica migraciones de ./drizzle
    seed.ts         Inserta los colaboradores de demostración
drizzle/            Migraciones SQL generadas
```

## Base de datos

| Tabla           | Descripción                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `colaboradores` | Personas del equipo: `nombre`, `rol`, `modalidad`.                          |
| `asignaciones`  | Turno (`AM`/`PM`/`COMPLETO`/`LIBRE`) de un colaborador en un sábado (`fecha`). Único por `(colaborador_id, fecha)`. |

## Configuración local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea `.env.local` (no se sube a git) con la cadena de conexión de Neon
   (Vercel → Storage → Neon). Ver `.env.example`:

   ```
   DATABASE_URL="postgresql://...neon.tech/...?sslmode=require"
   DATABASE_URL_UNPOOLED="postgresql://...neon.tech/...?sslmode=require"
   ```

3. Crea las tablas y siembra los datos de demostración:

   ```bash
   npm run db:migrate   # crea las tablas en Neon
   npm run db:seed      # inserta los 12 colaboradores de ejemplo
   ```

4. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

## Flujo de migraciones

Se usa el flujo **generate → migrate** (no `drizzle-kit push`):

```bash
npm run db:generate   # tras cambiar lib/db/schema.ts, genera el SQL en ./drizzle
npm run db:migrate    # aplica las migraciones pendientes
```

## Despliegue (Vercel)

- El repositorio está conectado a Vercel; cada `git push` a `main` despliega.
- `vercel.json` fija el framework a `nextjs`.
- La base de datos Neon se conecta desde **Vercel → Storage → Neon**, que
  inyecta `DATABASE_URL` en las variables de entorno del proyecto
  automáticamente (Production/Preview/Development).
