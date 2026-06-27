CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"nombre_display" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "colaboradores" ADD COLUMN "usuario_id" integer;
--> statement-breakpoint
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;
