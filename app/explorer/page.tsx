import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import DashboardAnalyse from "@/components/DashboardAnalyse";

export default function ExplorerPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Explorer</h1>
          <BlurToggleButton />
        </div>
        <DashboardAnalyse />
      </main>
    </BlurProvider>
  );
}
