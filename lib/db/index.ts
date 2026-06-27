import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type DB = NeonHttpDatabase<typeof schema>;

let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Conecta Neon en Vercel (Storage → Neon) o define la variable en .env.local",
    );
  }
  // Driver HTTP de Neon: ideal para serverless (una conexión por petición).
  _db = drizzle(neon(connectionString), { schema });
  return _db;
}

// Proxy de inicialización perezosa: la conexión solo se crea cuando se ejecuta
// la primera consulta, no al importar el módulo (así `next build` no requiere
// DATABASE_URL para compilar las rutas dinámicas).
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
