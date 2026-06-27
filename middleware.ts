import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "sid";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Recursos estáticos y rutas de autenticación no necesitan protección
  if (pathname === "/login") return NextResponse.next();

  const hasCookie = Boolean(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!hasCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
