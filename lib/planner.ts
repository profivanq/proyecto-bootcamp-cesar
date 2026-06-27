// Lógica pura del planificador de turnos sabatinos.

export type Rol = "Ventas" | "Soporte" | "Contabilidad" | "Administración";
export type Modalidad = "Presencial" | "Virtual";
export type Turno = "AM" | "PM" | "COMPLETO" | "LIBRE";

export interface Colaborador {
  id: number;
  nombre: string;
  rol: Rol;
  modalidad: Modalidad;
}

export interface Asignacion {
  colaboradorId: number;
  fecha: string; // 'YYYY-MM-DD'
  turno: Turno;
}

export interface Sabado {
  key: string;
  day: number;
  label: string;
}

export const MONTHS = [
  { name: "Enero", year: 2026, month: 0 },
  { name: "Febrero", year: 2026, month: 1 },
  { name: "Marzo", year: 2026, month: 2 },
  { name: "Abril", year: 2026, month: 3 },
  { name: "Mayo", year: 2026, month: 4 },
  { name: "Junio", year: 2026, month: 5 },
] as const;

export const ROLES: Rol[] = [
  "Ventas",
  "Soporte",
  "Contabilidad",
  "Administración",
];
export const MODALIDADES: Modalidad[] = ["Presencial", "Virtual"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function roleMeta(rol: Rol): { dot: string } {
  const m: Record<Rol, { dot: string }> = {
    Ventas: { dot: "#16a34a" },
    Soporte: { dot: "#2563eb" },
    Contabilidad: { dot: "#d97706" },
    Administración: { dot: "#64748b" },
  };
  return m[rol] ?? { dot: "#94a3b8" };
}

export interface ShiftStyle {
  bg: string;
  fg: string;
  border: string;
  label: string;
  full: string;
}

export function shiftStyle(sh: Turno | null): ShiftStyle {
  const C: Record<Turno, ShiftStyle> = {
    AM: { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", label: "AM", full: "Turno AM · 8:00–13:00" },
    PM: { bg: "#dbeafe", fg: "#1e40af", border: "#93c5fd", label: "PM", full: "Turno PM · 12:00–17:00" },
    COMPLETO: { bg: "#ede9fe", fg: "#5b21b6", border: "#c4b5fd", label: "Comp.", full: "Turno Completo · 8:00–17:00" },
    LIBRE: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0", label: "Libre", full: "Turno Libre" },
  };
  if (sh == null)
    return { bg: "#ffffff", fg: "#cbd5e1", border: "#e2e8f0", label: "+", full: "Sin asignar — clic para asignar" };
  return C[sh];
}

export function nextShift(cur: Turno | null): Turno {
  if (cur == null) return "AM";
  if (cur === "AM") return "PM";
  if (cur === "PM") return "COMPLETO";
  if (cur === "COMPLETO") return "LIBRE";
  return "AM";
}

export function getSaturdays(year: number, month: number): Sabado[] {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const out: Sabado[] = [];
  for (let d = 1; d <= last; d++) {
    const dt = new Date(Date.UTC(year, month, d));
    if (dt.getUTCDay() === 6) {
      out.push({ key: `${year}-${pad(month + 1)}-${pad(d)}`, day: d, label: `Sáb ${d}` });
    }
  }
  return out;
}

export function saturdaysForMonth(monthIndex: number): Sabado[] {
  const cm = MONTHS[monthIndex];
  return getSaturdays(cm.year, cm.month);
}

export function quincenaKeys(year: number, month: number): Set<string> {
  const sats = getSaturdays(year, month);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const t1 = 15;
  const t2 = Math.min(30, last);
  let s1: string | null = null;
  let s2: string | null = null;
  let b1 = Infinity;
  let b2 = Infinity;
  for (const s of sats) {
    const d1 = Math.abs(s.day - t1);
    const d2 = Math.abs(s.day - t2);
    if (d1 < b1) { b1 = d1; s1 = s.key; }
    if (d2 < b2) { b2 = d2; s2 = s.key; }
  }
  const keys = new Set<string>();
  if (s1) keys.add(s1);
  if (s2) keys.add(s2);
  return keys;
}

type ShiftCounts = { AM: number; PM: number; COMPLETO: number };

function leastShift(counts: ShiftCounts): keyof ShiftCounts {
  let m: keyof ShiftCounts = "AM";
  if (counts.PM < counts[m]) m = "PM";
  if (counts.COMPLETO < counts[m]) m = "COMPLETO";
  return m;
}

// Asigna turnos respetando:
// - Reglas de ventas, contabilidad en quincena y presencial
// - Máximo 1 COMPLETO por colaborador al mes (via completoUsed)
// - En quincena: mínimo 2 colaboradores cubriendo AM (AM+COMPLETO) y 2 cubriendo PM
function assignSat(
  workers: Colaborador[],
  isQ: boolean,
  completoUsed: Set<number>,
): Record<number, Turno> {
  const res: Record<number, Turno> = {};
  const counts: ShiftCounts = { AM: 0, PM: 0, COMPLETO: 0 };

  const canCompleto = (c: Colaborador) => !completoUsed.has(c.id);

  function doAssign(c: Colaborador, preferred: keyof ShiftCounts) {
    let sh: keyof ShiftCounts = preferred;
    if (sh === "COMPLETO" && !canCompleto(c)) {
      sh = counts.AM <= counts.PM ? "AM" : "PM";
    }
    res[c.id] = sh;
    counts[sh]++;
  }

  const ventas = workers.filter((c) => c.rol === "Ventas");
  const rest = workers.filter((c) => c.rol !== "Ventas");

  if (ventas.length === 1) {
    doAssign(ventas[0], "COMPLETO");
  } else if (ventas.length >= 2) {
    res[ventas[0].id] = "AM"; counts.AM++;
    res[ventas[1].id] = "PM"; counts.PM++;
    ventas.slice(2).forEach((v) => doAssign(v, leastShift(counts)));
  }

  if (isQ) {
    const contab = rest.filter((c) => c.rol === "Contabilidad" && !res[c.id]);
    if (contab.length) {
      doAssign(contab[0], canCompleto(contab[0]) ? "COMPLETO" : leastShift(counts));
    }
  }

  rest.forEach((c) => {
    if (!res[c.id]) doAssign(c, leastShift(counts));
  });

  // Presencial: al menos uno en AM y uno en PM
  const pres = workers.filter((c) => c.modalidad === "Presencial");
  if (pres.length) {
    const hasAm = pres.some((c) => res[c.id] === "AM" || res[c.id] === "COMPLETO");
    const hasPm = pres.some((c) => res[c.id] === "PM" || res[c.id] === "COMPLETO");
    if (!hasAm || !hasPm) {
      const cand = pres.find((c) => res[c.id] !== "COMPLETO" && canCompleto(c));
      if (cand) {
        const prev = res[cand.id] as keyof ShiftCounts;
        counts[prev]--;
        res[cand.id] = "COMPLETO";
        counts.COMPLETO++;
      }
    }
  }

  // Quincena: mínimo 2 cubriendo AM (AM+COMPLETO) y 2 cubriendo PM
  if (isQ) {
    const amCov = () =>
      Object.values(res).filter((t) => t === "AM" || t === "COMPLETO").length;
    const pmCov = () =>
      Object.values(res).filter((t) => t === "PM" || t === "COMPLETO").length;

    for (let iter = 0; iter < workers.length; iter++) {
      const needAm = amCov() < 2;
      const needPm = pmCov() < 2;
      if (!needAm && !needPm) break;

      // Promover un trabajador de PM a COMPLETO → cubre también AM
      if (needAm) {
        const c = workers.find((w) => res[w.id] === "PM" && canCompleto(w));
        if (c) { counts.PM--; res[c.id] = "COMPLETO"; counts.COMPLETO++; continue; }
      }
      // Promover un trabajador de AM a COMPLETO → cubre también PM
      if (needPm) {
        const c = workers.find((w) => res[w.id] === "AM" && canCompleto(w));
        if (c) { counts.AM--; res[c.id] = "COMPLETO"; counts.COMPLETO++; continue; }
      }
      break; // No se puede mejorar más
    }
  }

  return res;
}

// Genera planificación completa para un mes.
// Reglas: 1 LIBRE por colaborador · 1 COMPLETO máximo por colaborador ·
// quincena: contabilidad activa + mínimo 2 por turno AM y PM.
export function buildPlan(monthIndex: number, collabs: Colaborador[]): Asignacion[] {
  const cm = MONTHS[monthIndex];
  const sats = getSaturdays(cm.year, cm.month);
  const qset = quincenaKeys(cm.year, cm.month);

  // Asignar un sábado LIBRE por colaborador (sin quincena para contabilidad)
  const libreCount: Record<string, number> = {};
  sats.forEach((s) => (libreCount[s.key] = 0));
  const libreOf: Record<number, string> = {};

  collabs.forEach((c, i) => {
    let elig = sats.filter((s) => !(c.rol === "Contabilidad" && qset.has(s.key)));
    if (elig.length === 0) elig = sats.slice();
    const off = i % elig.length;
    const rot = elig.slice(off).concat(elig.slice(0, off));
    let best = rot[0];
    let bestScore = Infinity;
    rot.forEach((s) => {
      if (libreCount[s.key] < bestScore) { bestScore = libreCount[s.key]; best = s; }
    });
    libreOf[c.id] = best.key;
    libreCount[best.key]++;
  });

  // Registrar qué colaboradores ya usaron su COMPLETO del mes
  const completoUsed = new Set<number>();

  const out: Asignacion[] = [];
  sats.forEach((s) => {
    const workers = collabs.filter((c) => libreOf[c.id] !== s.key);
    const res = assignSat(workers, qset.has(s.key), completoUsed);
    // Actualizar completoUsed para los siguientes sábados
    for (const idStr of Object.keys(res)) {
      if (res[Number(idStr)] === "COMPLETO") completoUsed.add(Number(idStr));
    }
    collabs.forEach((c) => {
      const turno: Turno = libreOf[c.id] === s.key ? "LIBRE" : (res[c.id] ?? "AM");
      out.push({ colaboradorId: c.id, fecha: s.key, turno });
    });
  });
  return out;
}

// Datos de prueba iniciales (los mismos de la demo).
export const COLABORADORES_DEMO: Omit<Colaborador, "id">[] = [
  { nombre: "Ana Morales", rol: "Ventas", modalidad: "Presencial" },
  { nombre: "Carlos Ruiz", rol: "Ventas", modalidad: "Presencial" },
  { nombre: "Diana Vega", rol: "Ventas", modalidad: "Presencial" },
  { nombre: "Eduardo Soto", rol: "Ventas", modalidad: "Virtual" },
  { nombre: "Fernanda Lara", rol: "Ventas", modalidad: "Presencial" },
  { nombre: "Gabriel Ponce", rol: "Soporte", modalidad: "Presencial" },
  { nombre: "Helena Cruz", rol: "Soporte", modalidad: "Virtual" },
  { nombre: "Ignacio Mora", rol: "Soporte", modalidad: "Presencial" },
  { nombre: "Julia Ramos", rol: "Contabilidad", modalidad: "Presencial" },
  { nombre: "Kevin Díaz", rol: "Contabilidad", modalidad: "Virtual" },
  { nombre: "Lucía Fuentes", rol: "Administración", modalidad: "Presencial" },
  { nombre: "Marco Tovar", rol: "Administración", modalidad: "Virtual" },
];
