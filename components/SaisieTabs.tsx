"use client";

import TabDropdown from "@/components/TabDropdown";

const tabs = [
  { href: "/input", label: "Ce mois-ci" },
  { href: "/input/historique", label: "Historique" },
];

export default function SaisieTabs() {
  return (
    <div className="mb-8">
      <TabDropdown tabs={tabs} />
    </div>
  );
}
