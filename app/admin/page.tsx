import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import AdminDashboard from "@/components/AdminDashboard";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    redirect("/dashboard");
  }

  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-semibold">Superuser</h1>
        <AdminDashboard />
      </main>
    </BlurProvider>
  );
}
