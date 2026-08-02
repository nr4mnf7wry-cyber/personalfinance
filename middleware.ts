export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/input/:path*", "/investments/:path*"],
};
