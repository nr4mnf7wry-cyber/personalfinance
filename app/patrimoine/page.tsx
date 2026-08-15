import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import PatrimoineTabs from "@/components/PatrimoineTabs";
import PatrimoineEnsemble from "@/components/PatrimoineEnsemble";

export default function PatrimoinePage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">Patrimoine</h1>
          <BlurToggleButton />
        </div>
        <PatrimoineTabs />
        <PatrimoineEnsemble />
      </main>
    </BlurProvider>
  );
}
