import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import SaisieTabs from "@/components/SaisieTabs";
import InputHistorique from "@/components/InputHistorique";

export default function InputHistoriquePage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">Saisie</h1>
          <BlurToggleButton />
        </div>
        <SaisieTabs />
        <InputHistorique />
      </main>
    </BlurProvider>
  );
}
