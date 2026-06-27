import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { loginAction } from "@/app/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await getSessionUserId();
  if (userId) redirect("/");

  const params = await searchParams;
  const hasError = Boolean(params.error);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(15,23,42,.10)",
          padding: "40px 36px",
          width: "100%",
          maxWidth: 380,
        }}
      >
        {/* Logo / título */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#15803d",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <span style={{ color: "#fff", fontSize: 26 }}>📅</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>
            Planificador de Turnos
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Inicia sesión para continuar
          </div>
        </div>

        {hasError && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              borderRadius: 9,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            Usuario o contraseña incorrectos
          </div>
        )}

        <form action={loginAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              htmlFor="username"
              style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}
            >
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              placeholder="ej. crodriguez"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 14,
                color: "#1e293b",
                background: "#fff",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 14,
                color: "#1e293b",
                background: "#fff",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              marginTop: 6,
              padding: "11px 0",
              background: "#15803d",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-.01em",
            }}
          >
            Entrar
          </button>
        </form>

        <div style={{ marginTop: 22, padding: "14px 16px", background: "#f8fafc", borderRadius: 9, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Usuarios de prueba
          </div>
          {[
            { u: "crodriguez", n: "C. Rodríguez", c: "Col. 1-4" },
            { u: "mgutierrez", n: "M. Gutiérrez", c: "Col. 5-8" },
            { u: "aalba", n: "A. Alba", c: "Col. 9-12" },
          ].map((row) => (
            <div key={row.u} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569", padding: "3px 0" }}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{row.u}</span>
              <span>{row.c}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
            Contraseña: <strong style={{ color: "#475569" }}>iacademy2026</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
