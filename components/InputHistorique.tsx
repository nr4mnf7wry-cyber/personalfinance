"use client";

import { useEffect, useState } from "react";
import HistoryTable from "@/components/HistoryTable";
import { Group } from "@/lib/categories";

export default function InputHistorique() {
  const [categories, setCategories] = useState<any[]>([]);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function refetchCategories() {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }
  function refetchAllEntries() {
    fetch("/api/entries").then((r) => r.json()).then((data) => { setAllEntries(data); setLoading(false); });
  }

  useEffect(() => {
    refetchCategories();
    refetchAllEntries();
  }, []);

  async function handleHistoryEdit(y: number, m: number, group: string, category: string, amount: number) {
    setAllEntries((prev) => {
      const idx = prev.findIndex((e) => e.year === y && e.month === m && e.group === group && e.category === category && !e.subCategory);
      if (idx === -1) return [...prev, { year: y, month: m, group, category, subCategory: "", amount }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], amount };
      return copy;
    });
    await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: y, month: m, lines: [{ group, category, subCategory: null, amount }] }),
    });
  }

  async function handleGroupChange(categoryId: string, newGroup: Group) {
    await fetch(`/api/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: newGroup }),
    });
    refetchCategories();
    refetchAllEntries();
  }

  async function handleDeleteRow(group: string, category: string) {
    await fetch(`/api/entries?group=${encodeURIComponent(group)}&category=${encodeURIComponent(category)}`, {
      method: "DELETE",
    });
    refetchAllEntries();
  }

  async function handleDeleteAllHistory() {
    await fetch("/api/entries", { method: "DELETE" });
    refetchAllEntries();
  }

  async function handleReorder(categoryId: string, direction: "up" | "down") {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const sameGroup = categories.filter((c: any) => c.group === cat.group).sort((a: any, b: any) => a.order - b.order);
    const idx = sameGroup.findIndex((c: any) => c.id === categoryId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameGroup.length) return;
    const other = sameGroup[swapIdx];
    await Promise.all([
      fetch(`/api/categories/${cat.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: other.order }),
      }),
      fetch(`/api/categories/${other.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: cat.order }),
      }),
    ]);
    refetchCategories();
  }

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <HistoryTable
      entries={allEntries}
      categories={categories}
      onEdit={handleHistoryEdit}
      onGroupChange={handleGroupChange}
      onDeleteRow={handleDeleteRow}
      onReorder={handleReorder}
      onDeleteAll={handleDeleteAllHistory}
    />
  );
}
