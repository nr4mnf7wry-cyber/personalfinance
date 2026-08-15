import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import DashboardGeneral from "@/components/DashboardGeneral";

export default function DashboardPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <DashboardGeneral />
      </main>
    </BlurProvider>
  );
}
