CREATE TYPE "public"."modalidad" AS ENUM('Presencial', 'Virtual');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('Ventas', 'Soporte', 'Contabilidad', 'Administración');--> statement-breakpoint
CREATE TYPE "public"."turno" AS ENUM('AM', 'PM', 'COMPLETO', 'LIBRE');--> statement-breakpoint
CREATE TABLE "asignaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"colaborador_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"turno" "turno" NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colaboradores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"rol" "rol" DEFAULT 'Ventas' NOT NULL,
	"modalidad" "modalidad" DEFAULT 'Presencial' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_colaborador_fecha" ON "asignaciones" USING btree ("colaborador_id","fecha");