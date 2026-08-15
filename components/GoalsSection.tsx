"use client";

import { useEffect, useState } from "react";
import { Money } from "@/components/BlurToggle";

type Goal = { id: string; name: string; targetAmount: number; targetDate: string | null };

const emptyForm = { name: "", targetAmount: "", targetDate: "" };

export default function GoalsSection({ currentWealth, avgMonthlySavings }: { currentWealth: number; avgMonthlySavings: number }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function refetch() {
    return fetch("/api/goals").then((r) => r.json()).then((data) => { setGoals(data); setLoading(false); });
  }
  useEffect(() => { refetch(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.targetAmount) return;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, targetAmount: Number(form.targetAmount), targetDate: form.targetDate || null }),
    });
    setForm(emptyForm);
    setShowForm(false);
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet objectif ?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    refetch();
  }

  // Projection : au rythme d'épargne réel (moyenne de tous les mois), combien de mois pour atteindre l'objectif
  function projection(target: number) {
    const remaining = target - currentWealth;
    if (remaining <= 0) return { reached: true };
    if (avgMonthlySavings <= 0) return { reached: false, months: null };
    const months = Math.ceil(remaining / avgMonthlySavings);
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return { reached: false, months, date };
  }

  if (loading) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Objectifs</h2>
        <button onClick={() => setShowForm((s) => !s)} className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium">
          {showForm ? "Annuler" : "+ Ajouter un objectif"}
        </button>
      </div>


      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom</label>
            <input placeholder="Ex: Indépendance financière, Apport maison..." value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Montant cible</label>
            <input type="number" step="0.01" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Échéance (optionnel)</label>
            <input type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <button type="submit" className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium">Ajouter</button>
        </form>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun objectif défini — ajoute un montant cible pour suivre ta progression.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.min((currentWealth / g.targetAmount) * 100, 100) : 0;
            const proj = projection(g.targetAmount);
            return (
              <div key={g.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-ink">{g.name}</p>
                    <p className="text-sm text-gray-500">
                      <Money value={currentWealth} /> / <Money value={g.targetAmount} />
                    </p>
                  </div>
                  <button onClick={() => handleDelete(g.id)} className="text-gray-300 hover:text-red-500 text-sm">✕</button>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-3">
                  <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {proj.reached
                    ? "🎉 Objectif atteint"
                    : proj.months != null
                    ? `Au rythme actuel (${avgMonthlySavings.toFixed(0)} €/mois), atteint vers ${proj.date!.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
                    : "Rythme d'épargne nul ou négatif — impossible de projeter une date"}
                  {g.targetDate && ` · échéance visée : ${new Date(g.targetDate).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
