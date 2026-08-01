import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { BlurProvider } from "@/components/BlurProvider";
import Nav from "@/components/ui/Nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <SessionProviderWrapper>
      <BlurProvider>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </BlurProvider>
    </SessionProviderWrapper>
  );
}
