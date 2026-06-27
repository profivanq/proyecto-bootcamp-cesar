"use client";

import {
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  useEffect,
  type CSSProperties,
} from "react";
import {
  MONTHS,
  ROLES,
  MODALIDADES,
  saturdaysForMonth,
  quincenaKeys,
  shiftStyle,
  nextShift,
  roleMeta,
  buildPlan,
  type Colaborador,
  type Asignacion,
  type Rol,
  type Modalidad,
  type Turno,
} from "@/lib/planner";
import * as actions from "@/app/actions";
import { logoutAction } from "@/app/auth-actions";

// ---- Paletas de color (5 tonos de verde) ----
const PALETTES = [
  { name: "Bosque",    accent: "#15803d", hover: "#166534" },
  { name: "Esmeralda", accent: "#059669", hover: "#047857" },
  { name: "Lima",      accent: "#65a30d", hover: "#4d7c0f" },
  { name: "Salvia",    accent: "#4d7c5e", hover: "#3d6b4e" },
  { name: "Teal",      accent: "#0f766e", hover: "#0d6059" },
];

type Schedule = Record<string, Record<number, Turno>>;

function buildSchedule(asigs: Asignacion[]): Schedule {
  const s: Schedule = {};
  for (const a of asigs) {
    (s[a.fecha] ??= {})[a.colaboradorId] = a.turno;
  }
  return s;
}

type AppState = { colabs: Colaborador[]; schedule: Schedule };

type OptAction =
  | { type: "setShift"; id: number; fecha: string; turno: Turno }
  | { type: "addColab"; colab: Colaborador }
  | { type: "updateColab"; id: number; patch: Partial<Pick<Colaborador, "nombre" | "rol" | "modalidad">> }
  | { type: "deleteColab"; id: number }
  | { type: "autoPlan"; fechas: string[]; plan: Asignacion[] }
  | { type: "clearMonth"; fechas: string[] };

function reducer(state: AppState, action: OptAction): AppState {
  switch (action.type) {
    case "setShift":
      return {
        ...state,
        schedule: {
          ...state.schedule,
          [action.fecha]: { ...(state.schedule[action.fecha] ?? {}), [action.id]: action.turno },
        },
      };
    case "addColab":
      return { ...state, colabs: [...state.colabs, action.colab] };
    case "updateColab":
      return {
        ...state,
        colabs: state.colabs.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case "deleteColab": {
      const schedule: Schedule = {};
      for (const f in state.schedule) {
        const { [action.id]: _omit, ...rest } = state.schedule[f];
        schedule[f] = rest;
      }
      return { colabs: state.colabs.filter((c) => c.id !== action.id), schedule };
    }
    case "autoPlan": {
      const schedule: Schedule = { ...state.schedule };
      for (const k of action.fechas) schedule[k] = {};
      for (const a of action.plan) {
        schedule[a.fecha] = { ...(schedule[a.fecha] ?? {}), [a.colaboradorId]: a.turno };
      }
      return { ...state, schedule };
    }
    case "clearMonth": {
      const schedule = { ...state.schedule };
      for (const k of action.fechas) delete schedule[k];
      return { ...state, schedule };
    }
  }
}

export default function Planner({
  colaboradoresIniciales,
  asignacionesIniciales,
  userDisplay,
}: {
  colaboradoresIniciales: Colaborador[];
  asignacionesIniciales: Asignacion[];
  userDisplay: string;
}) {
  const base = useMemo<AppState>(
    () => ({
      colabs: colaboradoresIniciales,
      schedule: buildSchedule(asignacionesIniciales),
    }),
    [colaboradoresIniciales, asignacionesIniciales],
  );
  const [state, addOptimistic] = useOptimistic(base, reducer);
  const { colabs, schedule } = state;

  const [view, setView] = useState<"plan" | "team">("plan");
  const [monthIndex, setMonthIndex] = useState(0);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Rol>("Ventas");
  const [newMod, setNewMod] = useState<Modalidad>("Presencial");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const ACCENT = PALETTES[paletteIndex].accent;

  // Cerrar dropdown de impresión al hacer clic afuera
  useEffect(() => {
    if (!showPrintMenu) return;
    const handler = (e: MouseEvent) => {
      if (!printMenuRef.current?.contains(e.target as Node)) setShowPrintMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPrintMenu]);

  const run = (optimistic: OptAction, fn: () => Promise<unknown>) =>
    startTransition(async () => {
      addOptimistic(optimistic);
      try { await fn(); } catch (err) { console.error("Error guardando:", err); }
    });

  function cycleCell(fecha: string, id: number) {
    const next = nextShift(schedule[fecha]?.[id] ?? null);
    run({ type: "setShift", id, fecha, turno: next }, () => actions.setShift(id, fecha, next));
  }

  function handleAutoPlan() {
    const plan = buildPlan(monthIndex, colabs);
    const fechas = saturdaysForMonth(monthIndex).map((s) => s.key);
    run({ type: "autoPlan", fechas, plan }, () => actions.autoPlan(monthIndex));
  }

  function handleClearMonth() {
    const fechas = saturdaysForMonth(monthIndex).map((s) => s.key);
    run({ type: "clearMonth", fechas }, () => actions.clearMonth(monthIndex));
  }

  function handleAdd() {
    const nombre = newName.trim();
    if (!nombre) return;
    const rol = newRole;
    const modalidad = newMod;
    setNewName("");
    run(
      { type: "addColab", colab: { id: -Date.now(), nombre, rol, modalidad } },
      () => actions.addCollaborator({ nombre, rol, modalidad }),
    );
  }

  function handleUpdate(id: number, patch: Partial<Pick<Colaborador, "nombre" | "rol" | "modalidad">>) {
    run({ type: "updateColab", id, patch }, () => actions.updateCollaborator(id, patch));
  }

  function handleDelete(id: number) {
    run({ type: "deleteColab", id }, () => actions.deleteCollaborator(id));
  }

  async function handleExportJPG() {
    setShowPrintMenu(false);
    try {
      const h2c = (await import("html2canvas")).default;
      const el = document.getElementById("planner-root");
      if (!el) return;
      const canvas = await h2c(el, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#f1f5f9",
        scrollX: 0,
        scrollY: 0,
      });
      const link = document.createElement("a");
      link.download = `planificacion-${MONTHS[monthIndex].name.toLowerCase()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
    } catch (e) {
      console.error("Error exportando JPG:", e);
    }
  }

  function handleExportPDF() {
    setShowPrintMenu(false);
    window.print();
  }

  // ---- Cálculos de la vista ----
  const cm = MONTHS[monthIndex];
  const sats = saturdaysForMonth(monthIndex);
  const qset = quincenaKeys(cm.year, cm.month);
  const getShift = (k: string, id: number): Turno | null => schedule[k]?.[id] ?? null;

  let monthWarn = 0;

  // Conteo de COMPLETO por colaborador en el mes actual
  const completoCountPerCollab: Record<number, number> = {};
  colabs.forEach((c) => {
    completoCountPerCollab[c.id] = sats.filter(
      (s) => getShift(s.key, c.id) === "COMPLETO"
    ).length;
  });

  const saturdays = sats.map((s) => {
    const isQ = qset.has(s.key);
    let amV = 0, pmV = 0, cont = 0, assigned = 0, presAm = 0, presPm = 0;
    let amTotal = 0, pmTotal = 0;
    const counts = { AM: 0, PM: 0, COMPLETO: 0, LIBRE: 0 };

    colabs.forEach((c) => {
      const sh = getShift(s.key, c.id);
      if (sh != null) { assigned++; counts[sh]++; }
      if (c.rol === "Ventas") {
        if (sh === "AM" || sh === "COMPLETO") amV++;
        if (sh === "PM" || sh === "COMPLETO") pmV++;
      }
      if (c.rol === "Contabilidad" && sh != null && sh !== "LIBRE") cont++;
      if (c.modalidad === "Presencial") {
        if (sh === "AM" || sh === "COMPLETO") presAm++;
        if (sh === "PM" || sh === "COMPLETO") presPm++;
      }
      if (sh === "AM" || sh === "COMPLETO") amTotal++;
      if (sh === "PM" || sh === "COMPLETO") pmTotal++;
    });

    const warnAM     = assigned > 0 && amV === 0;
    const warnPM     = assigned > 0 && pmV === 0;
    const warnAcc    = isQ && assigned > 0 && cont === 0;
    const warnPresAM = assigned > 0 && presAm === 0;
    const warnPresPM = assigned > 0 && presPm === 0;
    const warnQMinAM = isQ && assigned > 0 && amTotal < 2;
    const warnQMinPM = isQ && assigned > 0 && pmTotal < 2;

    const hasWarn = warnAM || warnPM || warnAcc || warnPresAM || warnPresPM || warnQMinAM || warnQMinPM;
    if (hasWarn) monthWarn++;

    let statusText: string, statusColor: string;
    if (assigned === 0) {
      statusText = "Sin planificar";
      statusColor = "#94a3b8";
    } else if (hasWarn) {
      const p: string[] = [];
      if (warnAM) p.push("Falta vendedor AM");
      if (warnPM) p.push("Falta vendedor PM");
      if (warnAcc) p.push("Falta contabilidad");
      if (warnPresAM) p.push("Falta presencial AM");
      if (warnPresPM) p.push("Falta presencial PM");
      if (warnQMinAM) p.push("Quincena: AM < 2");
      if (warnQMinPM) p.push("Quincena: PM < 2");
      statusText = p.join(" · ");
      statusColor = "#dc2626";
    } else {
      statusText = "Cobertura OK";
      statusColor = "#16a34a";
    }

    return {
      key: s.key,
      label: s.label,
      isQ,
      headDot: assigned === 0 ? "#cbd5e1" : hasWarn ? "#dc2626" : "#16a34a",
      countsText: `AM ${counts.AM} · PM ${counts.PM} · Comp ${counts.COMPLETO} · Lib ${counts.LIBRE}`,
      statusText,
      statusColor,
    };
  });

  const rows = colabs.map((c) => {
    let libre = 0;
    let completo = 0;
    const cells = saturdays.map((s) => {
      const sh = getShift(s.key, c.id);
      if (sh === "LIBRE") libre++;
      if (sh === "COMPLETO") completo++;
      const st = shiftStyle(sh);
      return { ...st, full: `${st.full} — ${c.nombre} · ${s.label}`, fecha: s.key };
    });
    const rm = roleMeta(c.rol);
    const libreColor = libre === 1 ? "#16a34a" : libre === 0 ? "#94a3b8" : "#dc2626";
    const completoColor = completo > 1 ? "#dc2626" : completo === 1 ? "#16a34a" : "#94a3b8";
    if (libre > 1) monthWarn++;
    if (completo > 1) monthWarn++;
    return {
      id: c.id, nombre: c.nombre, roleDot: rm.dot, rol: c.rol,
      cells, libre, libreColor, completo, completoColor,
      isVirtual: c.modalidad === "Virtual",
    };
  });

  const anyAssigned = saturdays.some((s) => !s.statusText.startsWith("Sin"));
  let bannerText: string, bannerColor: string, bannerBg: string, bannerBorder: string;
  if (!anyAssigned) {
    bannerText = 'Mes sin planificar — usa "Sugerir planificación" para una propuesta automática que puedes editar.';
    bannerColor = "#475569"; bannerBg = "#f1f5f9"; bannerBorder = "#e2e8f0";
  } else if (monthWarn === 0) {
    bannerText = "Planificación válida — todos los turnos cumplen las reglas.";
    bannerColor = "#16a34a"; bannerBg = "#f0fdf4"; bannerBorder = "#bbf7d0";
  } else {
    bannerText = `${monthWarn} advertencia(s) por resolver en este mes.`;
    bannerColor = "#dc2626"; bannerBg = "#fef2f2"; bannerBorder = "#fecaca";
  }

  const roleCounts = ROLES.map((r) => ({
    role: r,
    count: colabs.filter((c) => c.rol === r).length,
    dot: roleMeta(r).dot,
  }));

  const navBtn = (active: boolean) =>
    active
      ? { background: "#fff", color: ACCENT }
      : { background: "rgba(255,255,255,.16)", color: "#fff" };

  return (
    <div id="planner-root" style={{ "--accent": ACCENT } as CSSProperties}>
      {/* Cabecera */}
      <div
        className="no-print"
        style={{
          background: ACCENT,
          color: "#fff",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em" }}>
            Planificador de turnos sabatinos
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            Asignación de turnos para los sábados · Enero – Junio 2026
          </div>
        </div>

        {/* Navegación central */}
        <div style={{ display: "flex", gap: 7 }}>
          <button type="button" onClick={() => setView("plan")}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", font: "600 13px/1 inherit", cursor: "pointer", ...navBtn(view === "plan") }}>
            Planificación
          </button>
          <button type="button" onClick={() => setView("team")}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", font: "600 13px/1 inherit", cursor: "pointer", ...navBtn(view === "team") }}>
            Colaboradores
          </button>
        </div>

        {/* Selector de paleta + usuario + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Paletas de color */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {PALETTES.map((p, i) => (
              <button
                key={p.name}
                type="button"
                title={p.name}
                onClick={() => setPaletteIndex(i)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: p.accent,
                  border: i === paletteIndex
                    ? "3px solid #fff"
                    : "2px solid rgba(255,255,255,.4)",
                  cursor: "pointer",
                  padding: 0,
                  outline: "none",
                  boxShadow: i === paletteIndex ? "0 0 0 2px rgba(0,0,0,.25)" : "none",
                  transition: "transform .1s",
                }}
              />
            ))}
            <span style={{ fontSize: 11.5, opacity: .8, marginLeft: 3 }}>
              {PALETTES[paletteIndex].name}
            </span>
          </div>

          {/* Usuario actual */}
          <div style={{ fontSize: 12.5, opacity: 0.9, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ opacity: 0.7 }}>👤</span>
            <span>{userDisplay}</span>
          </div>

          {/* Cerrar sesión */}
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,.4)",
                background: "rgba(255,255,255,.12)",
                color: "#fff",
                font: "600 12px/1 inherit",
                cursor: "pointer",
              }}
            >
              Salir
            </button>
          </form>
        </div>
      </div>

      {view === "plan" && (
        <div style={{ padding: "22px 24px 40px" }}>
          {/* Meses + acciones */}
          <div className="no-print"
            style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
            {MONTHS.map((m, i) => {
              const active = i === monthIndex;
              return (
                <button key={m.name} type="button" onClick={() => setMonthIndex(i)}
                  style={{
                    padding: "7px 14px", borderRadius: 999, font: "600 12.5px/1 inherit", cursor: "pointer",
                    ...(active
                      ? { background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}` }
                      : { background: "#fff", color: "#334155", border: "1px solid #e2e8f0" }),
                  }}>
                  {m.name}
                </button>
              );
            })}
            <div style={{ flex: 1, minWidth: 12 }} />

            {/* Sugerir planificación */}
            <button type="button" onClick={handleAutoPlan}
              style={{
                padding: "9px 16px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff",
                font: "600 13px/1 inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
              }}>
              <span style={{ fontSize: 14 }}>✦</span>Sugerir planificación
            </button>

            {/* Limpiar mes */}
            <button type="button" onClick={handleClearMonth}
              style={{
                padding: "9px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
                background: "#fff", color: "#334155", font: "600 13px/1 inherit", cursor: "pointer",
              }}>
              Limpiar mes
            </button>

            {/* Botón imprimir/exportar — dropdown */}
            <div ref={printMenuRef} style={{ position: "relative" }}>
              <button type="button" onClick={() => setShowPrintMenu((v) => !v)}
                style={{
                  padding: "9px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
                  background: "#fff", color: "#334155", font: "600 13px/1 inherit", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                Exportar
                <span style={{ fontSize: 10, opacity: .7 }}>{showPrintMenu ? "▲" : "▼"}</span>
              </button>

              {showPrintMenu && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 999,
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(15,23,42,.12)", minWidth: 160, overflow: "hidden",
                }}>
                  <button type="button" onClick={handleExportPDF}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "11px 16px", border: "none",
                      background: "transparent", cursor: "pointer", font: "500 13.5px/1 inherit",
                      color: "#1e293b", textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 16 }}>📄</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Descargar PDF</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Diálogo de impresión</div>
                    </div>
                  </button>
                  <div style={{ height: 1, background: "#f1f5f9" }} />
                  <button type="button" onClick={handleExportJPG}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "11px 16px", border: "none",
                      background: "transparent", cursor: "pointer", font: "500 13.5px/1 inherit",
                      color: "#1e293b", textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 16 }}>🖼️</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Descargar JPG</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Imagen de la planificación</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Banner de estado */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: bannerBg, color: bannerColor,
            border: `1px solid ${bannerBorder}`, borderRadius: 9,
            padding: "10px 14px", fontSize: 13, fontWeight: 500, marginBottom: 14,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: bannerColor, flex: "none" }} />
            <span>{bannerText}</span>
          </div>

          {/* Leyenda */}
          <div className="no-print"
            style={{ display: "flex", flexWrap: "wrap", gap: "16px 18px", alignItems: "center", marginBottom: 14, fontSize: 12, color: "#475569" }}>
            <LegendItem bg="#fef3c7" border="#fcd34d" text="AM · 8:00–13:00" />
            <LegendItem bg="#dbeafe" border="#93c5fd" text="PM · 12:00–17:00" />
            <LegendItem bg="#ede9fe" border="#c4b5fd" text="Completo · 8:00–17:00" />
            <LegendItem bg="#f1f5f9" border="#e2e8f0" text="Libre" />
            <span style={{ width: 1, height: 16, background: "#e2e8f0" }} />
            <span style={{ color: "#94a3b8" }}>Clic en una celda para cambiar el turno</span>
          </div>

          {/* Tabla */}
          <div id="plan-table-wrap" className="table-wrap"
            style={{ overflow: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 11, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thLeft}>Colaborador</th>
                  <th style={thLeft}>Rol</th>
                  {saturdays.map((s) => (
                    <th key={s.key} style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #eef2f7", minWidth: 74 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <span style={{ fontWeight: 700, color: "#334155", fontSize: 12.5 }}>{s.label}</span>
                        {s.isQ && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", padding: "1px 5px", borderRadius: 999 }}>
                            Quincena
                          </span>
                        )}
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.headDot }} />
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: "11px 10px", textAlign: "center", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #eef2f7" }}>
                    Libre
                  </th>
                  <th style={{ padding: "11px 10px", textAlign: "center", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #eef2f7" }}>
                    Comp.
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 14px", whiteSpace: "nowrap", fontWeight: 600, color: "#1e293b" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {row.nombre}
                        {row.isVirtual && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "1px 5px", borderRadius: 999 }}>
                            Virtual
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "#475569" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.roleDot, flex: "none" }} />
                        {row.rol}
                      </span>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.fecha} style={{ padding: 4, textAlign: "center", borderLeft: "1px solid #f1f5f9" }}>
                        <button type="button" title={cell.full} onClick={() => cycleCell(cell.fecha, row.id)}
                          style={{
                            width: "100%", minWidth: 58, height: 36, borderRadius: 7,
                            border: `1px solid ${cell.border}`, background: cell.bg, color: cell.fg,
                            font: "600 12px/1 inherit", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                          {cell.label}
                        </button>
                      </td>
                    ))}
                    <td style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, borderLeft: "1px solid #f1f5f9", color: row.libreColor }}>
                      {row.libre}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, borderLeft: "1px solid #f1f5f9", color: row.completoColor }}>
                      {row.completo}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                  <td style={{ padding: "9px 14px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>
                    Cobertura
                  </td>
                  <td />
                  {saturdays.map((s) => (
                    <td key={s.key} style={{ padding: "7px 6px", borderLeft: "1px solid #f1f5f9", textAlign: "center", verticalAlign: "top" }}>
                      <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>{s.countsText}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 3, lineHeight: 1.35, color: s.statusColor }}>{s.statusText}</div>
                    </td>
                  ))}
                  <td /><td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ marginTop: 12, fontSize: 11.5, color: "#94a3b8", lineHeight: 1.6 }}>
            Reglas: cada turno debe tener al menos un vendedor y un colaborador presencial ·
            cada colaborador tiene máximo 1 sábado libre y 1 turno completo al mes ·
            en sábados de quincena: contabilidad activa y mínimo 2 colaboradores por turno AM y PM.
          </div>
        </div>
      )}

      {view === "team" && (
        <div style={{ padding: "22px 24px 40px", maxWidth: 840 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {roleCounts.map((rc) => (
              <div key={rc.role}
                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: "9px 15px", display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#475569" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: rc.dot }} />
                {rc.role}
                <strong style={{ color: "#1e293b", fontSize: 15 }}>{rc.count}</strong>
              </div>
            ))}
          </div>

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92620a", borderRadius: 9, padding: "10px 14px", fontSize: 12.5, marginBottom: 16 }}>
            En cada turno debe haber al menos un vendedor y al menos un colaborador{" "}
            <strong>presencial</strong> — mantén suficiente personal de{" "}
            <strong>Ventas</strong> y en sitio para cubrir mañana y tarde.
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 11, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={teamTh}>Nombre</th>
                  <th style={teamTh}>Rol</th>
                  <th style={teamTh}>Modalidad</th>
                  <th style={{ width: 90, borderBottom: "1px solid #e2e8f0" }} />
                </tr>
              </thead>
              <tbody>
                {colabs.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "7px 16px" }}>
                      <input type="text" value={c.nombre}
                        onChange={(e) => handleUpdate(c.id, { nombre: e.target.value })}
                        style={teamInput} />
                    </td>
                    <td style={{ padding: "7px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: roleMeta(c.rol).dot, flex: "none" }} />
                        <select value={c.rol}
                          onChange={(e) => handleUpdate(c.id, { rol: e.target.value as Rol })}
                          style={teamSelect}>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </span>
                    </td>
                    <td style={{ padding: "7px 16px" }}>
                      <select value={c.modalidad}
                        onChange={(e) => handleUpdate(c.id, { modalidad: e.target.value as Modalidad })}
                        style={teamSelect}>
                        {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "7px 16px", textAlign: "right" }}>
                      <button type="button" title="Eliminar colaborador" onClick={() => handleDelete(c.id)}
                        style={{ padding: "7px 12px", border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 7, font: "600 12.5px/1 inherit", cursor: "pointer" }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Alta de colaborador */}
          <div style={{ marginTop: 16, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 10, padding: "13px 15px" }}>
            <input type="text" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Nombre del colaborador"
              style={{ ...teamInput, flex: 1, minWidth: 180, maxWidth: "none" }} />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as Rol)} style={teamSelect}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={newMod} onChange={(e) => setNewMod(e.target.value as Modalidad)} style={teamSelect}>
              {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button type="button" onClick={handleAdd}
              style={{ padding: "9px 18px", border: "none", background: ACCENT, color: "#fff", borderRadius: 7, font: "600 13.5px/1 inherit", cursor: "pointer" }}>
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ bg, border, text }: { bg: string; border: string; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 18, height: 14, borderRadius: 4, background: bg, border: `1px solid ${border}` }} />
      {text}
    </span>
  );
}

const thLeft: CSSProperties = {
  textAlign: "left", padding: "11px 14px", color: "#64748b", fontWeight: 600,
  fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em",
  borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap",
};

const teamTh: CSSProperties = {
  textAlign: "left", padding: "11px 16px", color: "#64748b", fontWeight: 600,
  fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em",
  borderBottom: "1px solid #e2e8f0",
};

const teamInput: CSSProperties = {
  width: "100%", maxWidth: 280, padding: "8px 10px",
  border: "1px solid #e2e8f0", borderRadius: 7,
  font: "500 13.5px/1 inherit", color: "#1e293b", background: "#fff",
};

const teamSelect: CSSProperties = {
  padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7,
  font: "500 13.5px/1 inherit", color: "#1e293b", background: "#fff", cursor: "pointer",
};
