import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import ProjeterTabs from "@/components/ProjeterTabs";
import ProjeterObjectifs from "@/components/ProjeterObjectifs";

export default function ProjeterPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">Projeter</h1>
          <BlurToggleButton />
        </div>
        <ProjeterTabs />
        <ProjeterObjectifs />
      </main>
    </BlurProvider>
  );
}
