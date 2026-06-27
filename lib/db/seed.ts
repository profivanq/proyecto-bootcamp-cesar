import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { colaboradores } from "./schema";
import { COLABORADORES_DEMO } from "../planner";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL / DATABASE_URL_UNPOOLED");

  const db = drizzle(neon(url));

  const existentes = await db.select().from(colaboradores);
  if (existentes.length > 0) {
    console.log(
      `Ya existen ${existentes.length} colaboradores; no se vuelve a sembrar.`,
    );
    return;
  }

  await db.insert(colaboradores).values(COLABORADORES_DEMO);
  console.log(`✓ Seed completado: ${COLABORADORES_DEMO.length} colaboradores.`);
}

main().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
