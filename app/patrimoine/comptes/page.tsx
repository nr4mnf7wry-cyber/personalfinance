import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import AccountsClient from "@/components/AccountsClient";

export default function PatrimoineComptesPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <AccountsClient />
      </main>
    </BlurProvider>
  );
}
