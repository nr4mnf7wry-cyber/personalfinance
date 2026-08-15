import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import HouseholdSettings from "@/components/HouseholdSettings";

export default function ParametresPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <HouseholdSettings />
      </main>
    </BlurProvider>
  );
}
