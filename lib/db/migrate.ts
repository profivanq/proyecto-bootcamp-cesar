import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL / DATABASE_URL_UNPOOLED");

  const db = drizzle(neon(url));
  console.log("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migraciones aplicadas.");
}

main().catch((err) => {
  console.error("Error en migraciones:", err);
  process.exit(1);
});
