import { createHash, createHmac } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "sid";
const PASS_SALT = "iacademy2026salt";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "iacademy2026sessionsecret";

export function hashPassword(password: string): string {
  return createHash("sha256").update(`${password}:${PASS_SALT}`).digest("hex");
}

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export function encodeSession(userId: number): string {
  const id = String(userId);
  return `${id}.${sign(id)}`;
}

export function decodeSession(token: string): number | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (sign(id) !== sig) return null;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}
