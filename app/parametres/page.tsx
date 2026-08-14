import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import HouseholdSettings from "@/components/HouseholdSettings";

export default function ParametresPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Paramètres</h1>
          <BlurToggleButton />
        </div>
        <HouseholdSettings />
      </main>
    </BlurProvider>
  );
}
