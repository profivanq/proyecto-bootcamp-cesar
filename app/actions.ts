"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { colaboradores, asignaciones } from "@/lib/db/schema";
import { getSessionUserId } from "@/lib/auth";
import {
  buildPlan,
  saturdaysForMonth,
  MONTHS,
  ROLES,
  MODALIDADES,
  type Rol,
  type Modalidad,
  type Turno,
  type Colaborador,
} from "@/lib/planner";

const TURNOS: Turno[] = ["AM", "PM", "COMPLETO", "LIBRE"];

const asRol = (v: unknown): Rol | null =>
  typeof v === "string" && (ROLES as string[]).includes(v) ? (v as Rol) : null;
const asModalidad = (v: unknown): Modalidad | null =>
  typeof v === "string" && (MODALIDADES as string[]).includes(v)
    ? (v as Modalidad)
    : null;
const asTurno = (v: unknown): Turno | null =>
  typeof v === "string" && (TURNOS as string[]).includes(v) ? (v as Turno) : null;
const asId = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const asMonthIndex = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < MONTHS.length ? n : null;
};
const asFecha = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

async function requireSession(): Promise<number> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("No autenticado");
  return userId;
}

async function colaboradoresActuales(userId: number): Promise<Colaborador[]> {
  return db
    .select({
      id: colaboradores.id,
      nombre: colaboradores.nombre,
      rol: colaboradores.rol,
      modalidad: colaboradores.modalidad,
    })
    .from(colaboradores)
    .where(eq(colaboradores.usuarioId, userId))
    .orderBy(colaboradores.id);
}

export async function addCollaborator(input: {
  nombre: string;
  rol: Rol;
  modalidad: Modalidad;
}) {
  const userId = await requireSession();
  const nombre = (input?.nombre ?? "").trim();
  const rol = asRol(input?.rol);
  const modalidad = asModalidad(input?.modalidad);
  if (!nombre || !rol || !modalidad) return null;

  const [row] = await db
    .insert(colaboradores)
    .values({ nombre, rol, modalidad, usuarioId: userId })
    .returning();
  revalidatePath("/");
  return row;
}

export async function updateCollaborator(
  id: number,
  patch: Partial<{ nombre: string; rol: Rol; modalidad: Modalidad }>,
) {
  const userId = await requireSession();
  const cid = asId(id);
  if (!cid) return;

  const data: Partial<{ nombre: string; rol: Rol; modalidad: Modalidad }> = {};
  if (typeof patch?.nombre === "string") {
    const n = patch.nombre.trim();
    if (n) data.nombre = n;
  }
  const rol = asRol(patch?.rol);
  if (rol) data.rol = rol;
  const modalidad = asModalidad(patch?.modalidad);
  if (modalidad) data.modalidad = modalidad;
  if (Object.keys(data).length === 0) return;

  await db
    .update(colaboradores)
    .set(data)
    .where(and(eq(colaboradores.id, cid), eq(colaboradores.usuarioId, userId)));
  revalidatePath("/");
}

export async function deleteCollaborator(id: number) {
  const userId = await requireSession();
  const cid = asId(id);
  if (!cid) return;
  await db
    .delete(colaboradores)
    .where(and(eq(colaboradores.id, cid), eq(colaboradores.usuarioId, userId)));
  revalidatePath("/");
}

export async function setShift(
  colaboradorId: number,
  fecha: string,
  turno: Turno,
) {
  const userId = await requireSession();
  const cid = asId(colaboradorId);
  const f = asFecha(fecha);
  const t = asTurno(turno);
  if (!cid || !f || !t) return;

  // Verificar que el colaborador pertenece al usuario
  const [colab] = await db
    .select({ id: colaboradores.id })
    .from(colaboradores)
    .where(and(eq(colaboradores.id, cid), eq(colaboradores.usuarioId, userId)))
    .limit(1);
  if (!colab) return;

  await db
    .insert(asignaciones)
    .values({ colaboradorId: cid, fecha: f, turno: t })
    .onConflictDoUpdate({
      target: [asignaciones.colaboradorId, asignaciones.fecha],
      set: { turno: t, actualizadoEn: new Date() },
    });
  revalidatePath("/");
}

export async function autoPlan(monthIndex: number) {
  const userId = await requireSession();
  const i = asMonthIndex(monthIndex);
  if (i === null) return;

  const colabs = await colaboradoresActuales(userId);
  const plan = buildPlan(i, colabs);
  const fechas = saturdaysForMonth(i).map((s) => s.key);
  const colabIds = colabs.map((c) => c.id);
  const rows = plan.map((a) => ({
    colaboradorId: a.colaboradorId,
    fecha: a.fecha,
    turno: a.turno,
  }));

  if (rows.length && fechas.length && colabIds.length) {
    await db.batch([
      db
        .delete(asignaciones)
        .where(
          and(
            inArray(asignaciones.fecha, fechas),
            inArray(asignaciones.colaboradorId, colabIds),
          ),
        ),
      db.insert(asignaciones).values(rows),
    ]);
  } else if (fechas.length && colabIds.length) {
    await db
      .delete(asignaciones)
      .where(
        and(
          inArray(asignaciones.fecha, fechas),
          inArray(asignaciones.colaboradorId, colabIds),
        ),
      );
  }
  revalidatePath("/");
}

export async function clearMonth(monthIndex: number) {
  const userId = await requireSession();
  const i = asMonthIndex(monthIndex);
  if (i === null) return;

  const colabs = await colaboradoresActuales(userId);
  const colabIds = colabs.map((c) => c.id);
  const fechas = saturdaysForMonth(i).map((s) => s.key);

  if (fechas.length && colabIds.length) {
    await db
      .delete(asignaciones)
      .where(
        and(
          inArray(asignaciones.fecha, fechas),
          inArray(asignaciones.colaboradorId, colabIds),
        ),
      );
  }
  revalidatePath("/");
}
