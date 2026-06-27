import { db } from "@/lib/db";
import { colaboradores, asignaciones } from "@/lib/db/schema";
import Planner from "@/components/Planner";
import type { Colaborador, Asignacion } from "@/lib/planner";

// Los datos viven en Postgres: renderizamos en cada petición (sin cache estática).
export const dynamic = "force-dynamic";

export default async function Page() {
  const colabs: Colaborador[] = await db
    .select({
      id: colaboradores.id,
      nombre: colaboradores.nombre,
      rol: colaboradores.rol,
      modalidad: colaboradores.modalidad,
    })
    .from(colaboradores)
    .orderBy(colaboradores.id);

  const asigs: Asignacion[] = await db
    .select({
      colaboradorId: asignaciones.colaboradorId,
      fecha: asignaciones.fecha,
      turno: asignaciones.turno,
    })
    .from(asignaciones);

  return <Planner colaboradoresIniciales={colabs} asignacionesIniciales={asigs} />;
}
