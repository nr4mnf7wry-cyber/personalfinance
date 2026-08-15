import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import ProjeterObjectifs from "@/components/ProjeterObjectifs";

export default function ProjeterPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-end mb-4">
          <BlurToggleButton />
        </div>
        <ProjeterObjectifs />
      </main>
    </BlurProvider>
  );
}
