import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function decodeJWT(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const payload = parts[1];
    const paddedPayload = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decodedPayload = atob(paddedPayload);
    return JSON.parse(decodedPayload);
  } catch (error) {
    console.error("JWT decoding error:", error);
    throw new Error("Invalid token");
  }
}

const publicPaths = [
  "/login",
  "/signup",
  "/verification",
  "/change-password",
  "/forget-password",
  "/reset-password",
  "/products",
  "/articles",
  "/about",
  "/search",
  "/contact",
  "/documentation",
  "/license-agreement",
  "/privacy-policy",
  "/refund-policy",
  "/terms-of-service",
];

const AUTH_COOKIE_NAME = "da_auth_token";

export default function proxy(request: NextRequest) {
  // Baca JWT dari cookie baru yang dipakai backend.
  // Tetap fallback ke "token" jika masih ada cookie lama.
  const token =
    request.cookies.get(AUTH_COOKIE_NAME)?.value ||
    request.cookies.get("token")?.value;

  const { pathname } = request.nextUrl;
  const method = request.method;

  if (pathname.startsWith("/api/") || pathname === "/api") {
    if (process.env.NODE_ENV === "development") {
      console.log(`[PROXY] Allowing API route: ${method} ${pathname}`);
    }
    return NextResponse.next();
  }

  if (method !== "GET") {
    return NextResponse.next();
  }

  const isPublicPath =
    pathname === "/" || publicPaths.some((path) => pathname.startsWith(path));

  let isAuthenticated = false;

  if (token) {
    try {
      const decoded = decodeJWT(token);

      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        throw new Error("Token expired");
      }

      isAuthenticated = true;
    } catch (error) {
      console.error("Token decoding error:", error);
      const response = NextResponse.next();
      response.cookies.delete(AUTH_COOKIE_NAME);
      response.cookies.delete("token");
      return response;
    }
  }

  // Jika sudah login dan buka halaman auth, arahkan ke dashboard
  if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
    const fromLogout = request.nextUrl.searchParams.get("logout");

    if (fromLogout) {
      return NextResponse.next();
    } else {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Jika sudah login dan buka root "/", arahkan ke dashboard
  if (pathname === "/" && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Proteksi /dashboard: kalau belum login, balikkan ke "/"
  if (pathname.startsWith("/dashboard")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/products/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/articles")) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/license-agreement") ||
    pathname.startsWith("/privacy-policy") ||
    pathname.startsWith("/refund-policy") ||
    pathname.startsWith("/terms-of-service")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/checkout")) {
    if (!isAuthenticated) {
      const redirectUrl = pathname + (request.nextUrl.search || "");
      return NextResponse.redirect(
        new URL(
          `/login?redirect=${encodeURIComponent(redirectUrl)}`,
          request.url,
        ),
      );
    }
    return NextResponse.next();
  }

  const isExplicitlyPublicContent =
    pathname.startsWith("/products/") ||
    pathname.startsWith("/articles") ||
    pathname.match(/^\/[a-f0-9]{24}$/) ||
    pathname.startsWith("/license-agreement") ||
    pathname.startsWith("/privacy-policy") ||
    pathname.startsWith("/refund-policy") ||
    pathname.startsWith("/terms-of-service");

  if (!isPublicPath && !isAuthenticated && !isExplicitlyPublicContent) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon\\.ico).*)"],
};
