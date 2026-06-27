// Lógica pura del planificador de turnos sabatinos.
// Portada fielmente desde la demo original (sin dependencias de React ni de BD),
// para poder reutilizarla tanto en el cliente como en el servidor.

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
  key: string; // 'YYYY-MM-DD'
  day: number;
  label: string; // 'Sáb 3'
}

// La planificación cubre enero–junio 2026 (igual que la demo original).
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

// Ciclo de turnos al hacer clic: vacío → AM → PM → COMPLETO → LIBRE → AM …
export function nextShift(cur: Turno | null): Turno {
  if (cur == null) return "AM";
  if (cur === "AM") return "PM";
  if (cur === "PM") return "COMPLETO";
  if (cur === "COMPLETO") return "LIBRE";
  return "AM";
}

export function getSaturdays(year: number, month: number): Sabado[] {
  // Cálculo en UTC para que el día de la semana no dependa de la zona horaria del servidor.
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

// Sábados de quincena: el más cercano al 15 y al 30 (o último día).
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
    if (d1 < b1) {
      b1 = d1;
      s1 = s.key;
    }
    if (d2 < b2) {
      b2 = d2;
      s2 = s.key;
    }
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

// Asigna turnos a los trabajadores de un sábado respetando las reglas:
// - al menos un vendedor en mañana y tarde
// - en quincena se prioriza contabilidad en turno
// - al menos un colaborador presencial cubriendo mañana y tarde
function assignSat(workers: Colaborador[], isQ: boolean): Record<number, Turno> {
  const res: Record<number, Turno> = {};
  const counts: ShiftCounts = { AM: 0, PM: 0, COMPLETO: 0 };
  const ventas = workers.filter((c) => c.rol === "Ventas");
  const rest = workers.filter((c) => c.rol !== "Ventas");

  if (ventas.length === 1) {
    res[ventas[0].id] = "COMPLETO";
    counts.COMPLETO++;
  } else if (ventas.length >= 2) {
    res[ventas[0].id] = "AM";
    counts.AM++;
    res[ventas[1].id] = "PM";
    counts.PM++;
    ventas.slice(2).forEach((v) => {
      const sh = leastShift(counts);
      res[v.id] = sh;
      counts[sh]++;
    });
  }

  if (isQ) {
    const contab = rest.filter((c) => c.rol === "Contabilidad" && !res[c.id]);
    if (contab.length) {
      res[contab[0].id] = "COMPLETO";
      counts.COMPLETO++;
    }
  }

  rest.forEach((c) => {
    if (!res[c.id]) {
      const sh = leastShift(counts);
      res[c.id] = sh;
      counts[sh]++;
    }
  });

  const pres = workers.filter((c) => c.modalidad === "Presencial");
  if (pres.length) {
    const hasAm = pres.some((c) => res[c.id] === "AM" || res[c.id] === "COMPLETO");
    const hasPm = pres.some((c) => res[c.id] === "PM" || res[c.id] === "COMPLETO");
    if (!hasAm || !hasPm) {
      const cand = pres.find((c) => res[c.id] !== "COMPLETO") ?? pres[0];
      res[cand.id] = "COMPLETO";
    }
  }

  return res;
}

// Genera una planificación completa para un mes y la devuelve como lista plana
// de asignaciones (lista para persistir).
export function buildPlan(monthIndex: number, collabs: Colaborador[]): Asignacion[] {
  const cm = MONTHS[monthIndex];
  const sats = getSaturdays(cm.year, cm.month);
  const qset = quincenaKeys(cm.year, cm.month);

  // Un sábado libre al mes por colaborador, balanceando y respetando la
  // quincena para contabilidad.
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
      if (libreCount[s.key] < bestScore) {
        bestScore = libreCount[s.key];
        best = s;
      }
    });
    libreOf[c.id] = best.key;
    libreCount[best.key]++;
  });

  const out: Asignacion[] = [];
  sats.forEach((s) => {
    const workers = collabs.filter((c) => libreOf[c.id] !== s.key);
    const res = assignSat(workers, qset.has(s.key));
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
