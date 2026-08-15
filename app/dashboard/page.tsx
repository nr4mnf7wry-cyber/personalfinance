import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import DashboardGeneral from "@/components/DashboardGeneral";

export default function DashboardPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Vue d'ensemble</h1>
          <BlurToggleButton />
        </div>
        <DashboardGeneral />
      </main>
    </BlurProvider>
  );
}
