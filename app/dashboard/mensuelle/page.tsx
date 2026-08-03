import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import DashboardTabs from "@/components/DashboardTabs";
import DashboardMonthly from "@/components/DashboardMonthly";

export default function DashboardMonthlyPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <BlurToggleButton />
        </div>
        <DashboardTabs />
        <DashboardMonthly />
      </main>
    </BlurProvider>
  );
}
