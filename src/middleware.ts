export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except the login page, NextAuth's own API routes,
  // and Next.js static/internal assets.
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
