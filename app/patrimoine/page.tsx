import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import PatrimoineEnsemble from "@/components/PatrimoineEnsemble";

export default function PatrimoinePage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <PatrimoineEnsemble />
      </main>
    </BlurProvider>
  );
}
