import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import DashboardAnalyse from "@/components/DashboardAnalyse";

export default function ExplorerPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-end mb-4">
          <BlurToggleButton />
        </div>
        <DashboardAnalyse />
      </main>
    </BlurProvider>
  );
}
