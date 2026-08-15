import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import SaisieTabs from "@/components/SaisieTabs";
import InputHistorique from "@/components/InputHistorique";

export default function InputHistoriquePage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <SaisieTabs />
        <InputHistorique />
      </main>
    </BlurProvider>
  );
}
