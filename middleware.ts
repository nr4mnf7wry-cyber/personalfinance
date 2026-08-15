export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/input/:path*", "/patrimoine/:path*", "/explorer/:path*", "/projeter/:path*", "/parametres/:path*", "/admin/:path*"],
};
