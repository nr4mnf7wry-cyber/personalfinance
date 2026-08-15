"use client";

import TabDropdown from "@/components/TabDropdown";

const tabs = [
  { href: "/patrimoine", label: "Ensemble" },
  { href: "/patrimoine/comptes", label: "Comptes" },
  { href: "/patrimoine/investissements", label: "Investissements" },
  { href: "/patrimoine/dettes", label: "Dettes" },
];

export default function PatrimoineTabs() {
  return (
    <div className="mb-8">
      <TabDropdown tabs={tabs} />
    </div>
  );
}
