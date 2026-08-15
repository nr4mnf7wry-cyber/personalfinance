"use client";

import { useWealthSnapshot } from "@/lib/useWealthSnapshot";
import GoalsSection from "@/components/GoalsSection";

export default function ProjeterObjectifs() {
  const { loading, grossAssets, avgMonthlySavings } = useWealthSnapshot();
  if (loading) return <p className="text-gray-500">Chargement...</p>;
  return <GoalsSection currentWealth={grossAssets} avgMonthlySavings={avgMonthlySavings} />;
}
