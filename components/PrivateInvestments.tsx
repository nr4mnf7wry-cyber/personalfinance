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
  closedAt: string | null;
  closedAmount: number | null;
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
  const [closing, setClosing] = useState<string | null>(null);
  const [closeForm, setCloseForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "" });
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

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

  async function handleClose(id: string) {
    if (!closeForm.amount) return;
    await fetch(`/api/private-investments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closedAt: new Date(closeForm.date).toISOString(), closedAmount: Number(closeForm.amount) }),
    });
    setClosing(null);
    setCloseForm({ date: new Date().toISOString().slice(0, 10), amount: "" });
    refetch();
  }

  async function handleReopen(id: string) {
    await fetch(`/api/private-investments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closedAt: null, closedAmount: null }),
    });
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

  const activeItems = items.filter((i) => !i.closedAt);
  const closedItems = items.filter((i) => i.closedAt);

  return (
    <section className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Investissements non cotés</h2>
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
            {activeItems.map((inv) => {
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
                    <td className="px-4 py-2 text-right relative">
                      <button onClick={() => setMenuOpenId(menuOpenId === inv.id ? null : inv.id)} className="text-gray-300 hover:text-gray-600 w-6" title="Actions">
                        ⋯
                      </button>
                      {menuOpenId === inv.id && (
                        <div className="absolute right-4 top-8 z-10 card bg-white shadow-lg py-1 w-44 text-sm text-left">
                          <button
                            onClick={() => { setRevaluing(revaluing === inv.id ? null : inv.id); setRevalForm({ estimatedValue: String(currentValue), note: "" }); setMenuOpenId(null); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50"
                          >
                            Réévaluer
                          </button>
                          <button
                            onClick={() => { setClosing(closing === inv.id ? null : inv.id); setCloseForm({ date: new Date().toISOString().slice(0, 10), amount: String(currentValue) }); setMenuOpenId(null); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50"
                          >
                            Clôturer / j'ai été remboursé
                          </button>
                          <button onClick={() => { handleDelete(inv.id); setMenuOpenId(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600">
                            Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {revaluing === inv.id && (
                    <tr className="bg-[#F5F0E6]">
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
                  {closing === inv.id && (
                    <tr className="bg-red-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <span className="text-sm text-gray-700">Clôturer "{inv.name}" — combien as-tu reçu au total ?</span>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Date</label>
                            <input type="date" value={closeForm.date} onChange={(e) => setCloseForm((f) => ({ ...f, date: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Montant reçu</label>
                            <input type="number" step="0.01" value={closeForm.amount} onChange={(e) => setCloseForm((f) => ({ ...f, amount: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" />
                          </div>
                          <button onClick={() => handleClose(inv.id)} className="bg-red-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium">
                            Confirmer la clôture
                          </button>
                          <button onClick={() => setClosing(null)} className="text-xs text-gray-400">Annuler</button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Une fois clôturé, cet investissement ne comptera plus dans ton patrimoine — pense à ajouter ce montant à ton solde en banque dans /input.
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {activeItems.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Aucun investissement non coté en cours.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {closedItems.length > 0 && (
        <div>
          <button onClick={() => setShowClosed((s) => !s)} className="text-sm text-gray-500 hover:text-gray-800">
            {showClosed ? "▾" : "▸"} {closedItems.length} investissement{closedItems.length > 1 ? "s" : ""} clôturé{closedItems.length > 1 ? "s" : ""}
          </button>
          {showClosed && (
            <div className="card overflow-x-auto mt-2">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-4 py-2">Nom</th>
                    <th className="px-4 py-2 text-right">Capital investi</th>
                    <th className="px-4 py-2 text-right">Reçu à la clôture</th>
                    <th className="px-4 py-2 text-right">+/- value finale</th>
                    <th className="px-4 py-2">Clôturé le</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {closedItems.map((inv) => {
                    const gain = (inv.closedAmount ?? 0) - inv.amountInvested;
                    const gainPct = inv.amountInvested ? (gain / inv.amountInvested) * 100 : 0;
                    return (
                      <tr key={inv.id} className="border-b border-gray-50 text-gray-500">
                        <td className="px-4 py-2">{inv.name}</td>
                        <td className="px-4 py-2 text-right">{inv.amountInvested.toFixed(2)} {inv.currency}</td>
                        <td className="px-4 py-2 text-right"><Money value={inv.closedAmount ?? 0} /></td>
                        <td className={`px-4 py-2 text-right ${gain >= 0 ? "text-green" : "text-red"}`}>
                          <Money value={gain} /> ({gainPct.toFixed(1)}%)
                        </td>
                        <td className="px-4 py-2">{inv.closedAt ? new Date(inv.closedAt).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => handleReopen(inv.id)} className="text-accent text-xs">Rouvrir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
