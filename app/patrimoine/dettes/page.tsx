import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import DebtsClient from "@/components/DebtsClient";

export default function PatrimoineDettesPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <DebtsClient />
      </main>
    </BlurProvider>
  );
}
