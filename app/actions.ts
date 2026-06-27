"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { colaboradores, asignaciones } from "@/lib/db/schema";
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

// --- Validación de entrada (las Server Actions son endpoints públicos) ---
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

async function colaboradoresActuales(): Promise<Colaborador[]> {
  return db
    .select({
      id: colaboradores.id,
      nombre: colaboradores.nombre,
      rol: colaboradores.rol,
      modalidad: colaboradores.modalidad,
    })
    .from(colaboradores)
    .orderBy(colaboradores.id);
}

export async function addCollaborator(input: {
  nombre: string;
  rol: Rol;
  modalidad: Modalidad;
}) {
  const nombre = (input?.nombre ?? "").trim();
  const rol = asRol(input?.rol);
  const modalidad = asModalidad(input?.modalidad);
  if (!nombre || !rol || !modalidad) return null;

  const [row] = await db
    .insert(colaboradores)
    .values({ nombre, rol, modalidad })
    .returning();
  revalidatePath("/");
  return row;
}

export async function updateCollaborator(
  id: number,
  patch: Partial<{ nombre: string; rol: Rol; modalidad: Modalidad }>,
) {
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

  await db.update(colaboradores).set(data).where(eq(colaboradores.id, cid));
  revalidatePath("/");
}

export async function deleteCollaborator(id: number) {
  const cid = asId(id);
  if (!cid) return;
  // Las asignaciones se borran en cascada (FK onDelete: cascade).
  await db.delete(colaboradores).where(eq(colaboradores.id, cid));
  revalidatePath("/");
}

export async function setShift(
  colaboradorId: number,
  fecha: string,
  turno: Turno,
) {
  const cid = asId(colaboradorId);
  const f = asFecha(fecha);
  const t = asTurno(turno);
  if (!cid || !f || !t) return;

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
  const i = asMonthIndex(monthIndex);
  if (i === null) return;

  const colabs = await colaboradoresActuales();
  const plan = buildPlan(i, colabs);
  const fechas = saturdaysForMonth(i).map((s) => s.key);
  const rows = plan.map((a) => ({
    colaboradorId: a.colaboradorId,
    fecha: a.fecha,
    turno: a.turno,
  }));

  if (rows.length && fechas.length) {
    // Atomicidad: borrar el mes e insertar la nueva propuesta en una sola
    // transacción (db.batch), para no dejar el mes vacío si algo falla.
    await db.batch([
      db.delete(asignaciones).where(inArray(asignaciones.fecha, fechas)),
      db.insert(asignaciones).values(rows),
    ]);
  } else if (fechas.length) {
    await db.delete(asignaciones).where(inArray(asignaciones.fecha, fechas));
  }
  revalidatePath("/");
}

export async function clearMonth(monthIndex: number) {
  const i = asMonthIndex(monthIndex);
  if (i === null) return;
  const fechas = saturdaysForMonth(i).map((s) => s.key);
  if (fechas.length) {
    await db.delete(asignaciones).where(inArray(asignaciones.fecha, fechas));
  }
  revalidatePath("/");
}
