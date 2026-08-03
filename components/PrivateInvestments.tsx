"use client";

import { useEffect, useState, Fragment } from "react";
import { Money } from "@/components/BlurToggle";

type Valuation = { id: string; date: string; estimatedValue: number; note?: string };
type PrivateInvestment = {
  id: string;
  name: string;
  amountInvested: number;
  currency: string;
  startDate: string;
  expectedReturnPct: number | null;
  notes?: string;
  valuations: Valuation[];
};

const emptyForm = { name: "", amountInvested: "", currency: "EUR", startDate: new Date().toISOString().slice(0, 10), expectedReturnPct: "", notes: "" };

export default function PrivateInvestments() {
  const [items, setItems] = useState<PrivateInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [revaluing, setRevaluing] = useState<string | null>(null);
  const [revalForm, setRevalForm] = useState({ estimatedValue: "", note: "" });

  function refetch() {
    return fetch("/api/private-investments").then((r) => r.json()).then((data) => { setItems(data); setLoading(false); });
  }

  useEffect(() => { refetch(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amountInvested) return;
    await fetch("/api/private-investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        amountInvested: Number(form.amountInvested),
        currency: form.currency,
        startDate: new Date(form.startDate).toISOString(),
        expectedReturnPct: form.expectedReturnPct ? Number(form.expectedReturnPct) : null,
        notes: form.notes || undefined,
      }),
    });
    setForm(emptyForm);
    setShowForm(false);
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet investissement et tout son historique de valorisation ?")) return;
    await fetch(`/api/private-investments/${id}`, { method: "DELETE" });
    refetch();
  }

  async function handleRevalue(id: string) {
    if (!revalForm.estimatedValue) return;
    await fetch(`/api/private-investments/${id}/valuations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimatedValue: Number(revalForm.estimatedValue), note: revalForm.note || undefined }),
    });
    setRevaluing(null);
    setRevalForm({ estimatedValue: "", note: "" });
    refetch();
  }

  function latestValuation(inv: PrivateInvestment) {
    return [...inv.valuations].sort((a, b) => a.date.localeCompare(b.date)).pop();
  }

  // Valeur théorique attendue aujourd'hui selon le rendement annuel visé (intérêts composés)
  function expectedValueToday(inv: PrivateInvestment) {
    if (!inv.expectedReturnPct) return null;
    const years = (Date.now() - new Date(inv.startDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    return inv.amountInvested * Math.pow(1 + inv.expectedReturnPct / 100, years);
  }

  if (loading) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Investissements non cotés</h2>
          <p className="text-xs text-gray-400">Immobilier, prêts privés, parts d'entreprise... — sans cours en direct, à réévaluer toi-même de temps en temps.</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium">
          {showForm ? "Annuler" : "+ Ajouter"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom</label>
            <input placeholder="Ex: Local commercial, Prêt à Marc..." value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Capital investi</label>
            <input type="number" step="0.01" value={form.amountInvested} onChange={(e) => setForm((f) => ({ ...f, amountInvested: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Devise</label>
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date de début</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Rendement annuel attendu (%)</label>
            <input type="number" step="0.1" placeholder="ex: 5" value={form.expectedReturnPct} onChange={(e) => setForm((f) => ({ ...f, expectedReturnPct: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 text-right" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Note (optionnel)</label>
            <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40" />
          </div>
          <button type="submit" className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium">Ajouter</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2 text-right">Capital investi</th>
              <th className="px-4 py-2 text-right">Rendement visé</th>
              <th className="px-4 py-2 text-right">Valeur théorique aujourd'hui</th>
              <th className="px-4 py-2 text-right">Dernière réévaluation</th>
              <th className="px-4 py-2 text-right">+/- value</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((inv) => {
              const last = latestValuation(inv);
              const currentValue = last?.estimatedValue ?? inv.amountInvested;
              const gain = currentValue - inv.amountInvested;
              const gainPct = inv.amountInvested ? (gain / inv.amountInvested) * 100 : 0;
              const theoretical = expectedValueToday(inv);
              return (
                <Fragment key={inv.id}>
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium">
                      {inv.name}
                      {inv.notes && <div className="text-xs text-gray-400 font-normal">{inv.notes}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">{inv.amountInvested.toFixed(2)} {inv.currency}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{inv.expectedReturnPct != null ? `${inv.expectedReturnPct}%/an` : "—"}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{theoretical != null ? `${theoretical.toFixed(0)} ${inv.currency}` : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Money value={currentValue} />
                      {last && <div className="text-xs text-gray-400">{new Date(last.date).toLocaleDateString("fr-FR")}</div>}
                    </td>
                    <td className={`px-4 py-2 text-right ${gain >= 0 ? "text-green" : "text-red"}`}>
                      <Money value={gain} /> ({gainPct.toFixed(1)}%)
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => { setRevaluing(revaluing === inv.id ? null : inv.id); setRevalForm({ estimatedValue: String(currentValue), note: "" }); }} className="text-accent text-xs mr-3">
                        Réévaluer
                      </button>
                      <button onClick={() => handleDelete(inv.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                    </td>
                  </tr>
                  {revaluing === inv.id && (
                    <tr className="bg-blue-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Nouvelle valeur estimée</label>
                            <input type="number" step="0.01" value={revalForm.estimatedValue} onChange={(e) => setRevalForm((f) => ({ ...f, estimatedValue: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Note (optionnel)</label>
                            <input value={revalForm.note} onChange={(e) => setRevalForm((f) => ({ ...f, note: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56" />
                          </div>
                          <button onClick={() => handleRevalue(inv.id)} className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium">
                            Enregistrer
                          </button>
                        </div>
                        {inv.valuations.length > 1 && (
                          <div className="mt-3 text-xs text-gray-500 space-y-1">
                            <p className="font-medium">Historique :</p>
                            {[...inv.valuations].sort((a, b) => b.date.localeCompare(a.date)).map((v) => (
                              <p key={v.id}>{new Date(v.date).toLocaleDateString("fr-FR")} — {v.estimatedValue.toFixed(2)} {inv.currency} {v.note ? `(${v.note})` : ""}</p>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Aucun investissement non coté pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
