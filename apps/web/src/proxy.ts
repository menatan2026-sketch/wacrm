import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, negotiateLocale } from "@mfg/i18n";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Runs before every page: locale prefix redirects (explicit choice > Accept-Language > he; only
 * when the URL has no locale, so the language never switches under the user), a per-request CSP
 * nonce, and a request id for log correlation. Authorization is enforced again in every action.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (!isLocale(first)) {
    const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookie)
      ? cookie
      : (negotiateLocale(request.headers.get("accept-language")) ?? defaultLocale);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by React/Motion for transforms; no inline <style> injection is relied on.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-request-id", requestId);
  headers.set("x-locale", first);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|fonts|.*\\.(?:png|svg|jpg|webp|woff2?)$).*)",
  ],
};
