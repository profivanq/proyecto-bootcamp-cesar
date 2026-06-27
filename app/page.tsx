import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { colaboradores, asignaciones, usuarios } from "@/lib/db/schema";
import Planner from "@/components/Planner";
import type { Colaborador, Asignacion } from "@/lib/planner";
import { getSessionUserId, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const userId = await getSessionUserId();
  if (!userId) {
    // Sesión inválida: limpiar cookie y redirigir
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    redirect("/login");
  }

  const [user] = await db
    .select({ nombreDisplay: usuarios.nombreDisplay })
    .from(usuarios)
    .where(eq(usuarios.id, userId))
    .limit(1);

  const colabs: Colaborador[] = await db
    .select({
      id: colaboradores.id,
      nombre: colaboradores.nombre,
      rol: colaboradores.rol,
      modalidad: colaboradores.modalidad,
    })
    .from(colaboradores)
    .where(eq(colaboradores.usuarioId, userId))
    .orderBy(colaboradores.id);

  const colabIds = colabs.map((c) => c.id);

  const asigs: Asignacion[] =
    colabIds.length > 0
      ? await db
          .select({
            colaboradorId: asignaciones.colaboradorId,
            fecha: asignaciones.fecha,
            turno: asignaciones.turno,
          })
          .from(asignaciones)
          .where(inArray(asignaciones.colaboradorId, colabIds))
      : [];

  return (
    <Planner
      colaboradoresIniciales={colabs}
      asignacionesIniciales={asigs}
      userDisplay={user?.nombreDisplay ?? "Usuario"}
    />
  );
}
