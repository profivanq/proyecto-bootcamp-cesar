import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { colaboradores, usuarios } from "./schema";
import { COLABORADORES_DEMO } from "../planner";
import { hashPassword } from "../auth";

const USUARIOS_DEMO = [
  { username: "crodriguez", passwordHash: "", nombreDisplay: "C. Rodríguez" },
  { username: "mgutierrez", passwordHash: "", nombreDisplay: "M. Gutiérrez" },
  { username: "aalba", passwordHash: "", nombreDisplay: "A. Alba" },
].map((u) => ({ ...u, passwordHash: hashPassword("iacademy2026") }));

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL / DATABASE_URL_UNPOOLED");

  const db = drizzle(neon(url));

  // 1. Crear usuarios si no existen
  const existingUsers = await db.select().from(usuarios);
  let u1Id: number, u2Id: number, u3Id: number;

  if (existingUsers.length === 0) {
    const inserted = await db
      .insert(usuarios)
      .values(USUARIOS_DEMO)
      .returning({ id: usuarios.id, username: usuarios.username });
    u1Id = inserted.find((u) => u.username === "crodriguez")!.id;
    u2Id = inserted.find((u) => u.username === "mgutierrez")!.id;
    u3Id = inserted.find((u) => u.username === "aalba")!.id;
    console.log("✓ 3 usuarios creados (crodriguez, mgutierrez, aalba)");
  } else {
    const find = (name: string) =>
      existingUsers.find((u) => u.username === name)?.id;
    u1Id = find("crodriguez") ?? existingUsers[0].id;
    u2Id = find("mgutierrez") ?? (existingUsers[1]?.id ?? existingUsers[0].id);
    u3Id = find("aalba") ?? (existingUsers[2]?.id ?? existingUsers[0].id);
    console.log("Usuarios ya existen, omitiendo creación.");
  }

  // 2. Colaboradores
  const existingColabs = await db
    .select()
    .from(colaboradores)
    .orderBy(colaboradores.id);

  if (existingColabs.length === 0) {
    await db.insert(colaboradores).values([
      ...COLABORADORES_DEMO.slice(0, 4).map((c) => ({ ...c, usuarioId: u1Id })),
      ...COLABORADORES_DEMO.slice(4, 8).map((c) => ({ ...c, usuarioId: u2Id })),
      ...COLABORADORES_DEMO.slice(8, 12).map((c) => ({ ...c, usuarioId: u3Id })),
    ]);
    console.log("✓ 12 colaboradores sembrados (4 por usuario).");
  } else {
    // Asignar usuarioId a colaboradores que lo tengan en NULL (migración existente)
    const unassigned = existingColabs.filter((c) => c.usuarioId === null);
    if (unassigned.length > 0) {
      for (let i = 0; i < unassigned.length; i++) {
        const uid = i < 4 ? u1Id : i < 8 ? u2Id : u3Id;
        await db
          .update(colaboradores)
          .set({ usuarioId: uid })
          .where(eq(colaboradores.id, unassigned[i].id));
      }
      console.log(`✓ ${unassigned.length} colaboradores asignados a usuarios.`);
    } else {
      console.log("Colaboradores ya tienen usuario asignado, nada que hacer.");
    }
  }
}

main().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
