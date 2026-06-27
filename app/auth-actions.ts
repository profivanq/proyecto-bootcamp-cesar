"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { hashPassword, encodeSession, SESSION_COOKIE } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const username = ((formData.get("username") as string) ?? "").trim().toLowerCase();
  const password = (formData.get("password") as string) ?? "";

  if (!username || !password) {
    redirect("/login?error=credenciales");
  }

  const [user] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.username, username))
    .limit(1);

  if (!user || user.passwordHash !== hashPassword(password)) {
    redirect("/login?error=credenciales");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(user.id), {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
    sameSite: "lax",
  });

  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
