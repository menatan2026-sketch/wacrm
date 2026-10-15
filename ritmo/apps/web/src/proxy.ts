import { NextResponse, type NextRequest } from 'next/server';

// Cheap gate: no session cookie → sign-in page. The session itself is
// validated on the server for every request that reads data.
const PUBLIC = ['/login', '/signup', '/invite', '/states', '/api/health', '/brand', '/fonts', '/favicon'];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.has('ritmo_session')) return NextResponse.next();
  const url = new URL('/login', request.url);
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|ico|woff2|webmanifest)$).*)'],
};
