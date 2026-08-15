"use client";

import TabDropdown from "@/components/TabDropdown";

const tabs = [
  { href: "/projeter", label: "Objectifs" },
  { href: "/projeter/simulateur", label: "Simulateur" },
];

export default function ProjeterTabs() {
  return (
    <div className="mb-8">
      <TabDropdown tabs={tabs} />
    </div>
  );
}
