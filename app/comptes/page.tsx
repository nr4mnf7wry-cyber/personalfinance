import Nav from "@/components/Nav";
import { BlurProvider, BlurToggleButton } from "@/components/BlurToggle";
import AccountsClient from "@/components/AccountsClient";
import Link from "next/link";

export default function AccountsPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Comptes bancaires</h1>
            <Link href="/dashboard" className="text-sm text-accent">← Retour au dashboard</Link>
          </div>
          <BlurToggleButton />
        </div>
        <AccountsClient />
      </main>
    </BlurProvider>
  );
}
