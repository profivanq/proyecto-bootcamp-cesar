import {
  pgTable,
  serial,
  integer,
  text,
  date,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Catálogos del dominio (coinciden con la lógica del planificador)
export const rolEnum = pgEnum("rol", [
  "Ventas",
  "Soporte",
  "Contabilidad",
  "Administración",
]);

export const modalidadEnum = pgEnum("modalidad", ["Presencial", "Virtual"]);

export const turnoEnum = pgEnum("turno", ["AM", "PM", "COMPLETO", "LIBRE"]);

// Usuarios del sistema (acceso multi-usuario)
export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nombreDisplay: text("nombre_display").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Colaboradores del equipo (cada uno pertenece a un usuario)
export const colaboradores = pgTable("colaboradores", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  nombre: text("nombre").notNull(),
  rol: rolEnum("rol").notNull().default("Ventas"),
  modalidad: modalidadEnum("modalidad").notNull().default("Presencial"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Asignación de un turno a un colaborador en un sábado concreto.
export const asignaciones = pgTable(
  "asignaciones",
  {
    id: serial("id").primaryKey(),
    colaboradorId: integer("colaborador_id")
      .notNull()
      .references(() => colaboradores.id, { onDelete: "cascade" }),
    fecha: date("fecha").notNull(),
    turno: turnoEnum("turno").notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqColabFecha: uniqueIndex("uniq_colaborador_fecha").on(
      t.colaboradorId,
      t.fecha,
    ),
  }),
);

export type Usuario = typeof usuarios.$inferSelect;
export type NuevoUsuario = typeof usuarios.$inferInsert;
export type Colaborador = typeof colaboradores.$inferSelect;
export type NuevoColaborador = typeof colaboradores.$inferInsert;
export type Asignacion = typeof asignaciones.$inferSelect;
