import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import DashboardTabs from "@/components/DashboardTabs";
import DashboardAnalyse from "@/components/DashboardAnalyse";

export default function DashboardAnalysePage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <BlurToggleButton />
        </div>
        <DashboardTabs />
        <DashboardAnalyse />
      </main>
    </BlurProvider>
  );
}
