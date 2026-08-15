import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import DashboardSimulator from "@/components/DashboardSimulator";

export default function ProjeterSimulateurPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <DashboardSimulator />
      </main>
    </BlurProvider>
  );
}
