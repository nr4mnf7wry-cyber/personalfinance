import Nav from "@/components/Nav";
import { BlurProvider } from "@/components/BlurToggle";
import SaisieTabs from "@/components/SaisieTabs";
import InputClient from "@/components/InputClient";

export default function InputPage() {
  return (
    <BlurProvider>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <SaisieTabs />
        <InputClient />
      </main>
    </BlurProvider>
  );
}
