import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Carga variables desde .env.local (no versionado) y .env si existen.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Para migraciones se prefiere la conexión directa (no pooled) si está disponible.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
