import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import InvestmentsClient from "@/components/InvestmentsClient";
import PrivateInvestments from "@/components/PrivateInvestments";

export default function PatrimoineInvestissementsPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-12">
          <InvestmentsClient />
          <PrivateInvestments />
        </div>
      </main>
    </BlurProvider>
  );
}
