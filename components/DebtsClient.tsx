"use client";

import { useEffect, useState } from "react";
import { Money } from "@/components/BlurToggle";
import { computeLoanState, DEBT_TYPE_LABELS } from "@/lib/loan";

type Debt = {
  id: string;
  name: string;
  type: string;
  startDate: string;
  amount: number;
  interestRatePct: number;
  durationMonths: number;
  monthlyPayment: number;
  notes?: string;
};

const emptyForm = {
  name: "", type: "car", startDate: new Date().toISOString().slice(0, 10),
  amount: "", interestRatePct: "", durationMonths: "", monthlyPayment: "", notes: "",
};

export default function DebtsClient() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function refetch() {
    return fetch("/api/debts").then((r) => r.json()).then((data) => { setDebts(data); setLoading(false); });
  }
  useEffect(() => { refetch(); }, []);

  function startEdit(d: Debt) {
    setEditingId(d.id);
    setForm({
      name: d.name, type: d.type, startDate: d.startDate.slice(0, 10),
      amount: String(d.amount), interestRatePct: String(d.interestRatePct),
      durationMonths: String(d.durationMonths), monthlyPayment: String(d.monthlyPayment),
      notes: d.notes ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amount || !form.durationMonths || !form.monthlyPayment) return;
    const body = JSON.stringify({
      name: form.name,
      type: form.type,
      startDate: new Date(form.startDate).toISOString(),
      amount: Number(form.amount),
      interestRatePct: Number(form.interestRatePct) || 0,
      durationMonths: Number(form.durationMonths),
      monthlyPayment: Number(form.monthlyPayment),
      notes: form.notes || undefined,
    });
    const res = editingId
      ? await fetch(`/api/debts/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
      : await fetch("/api/debts", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (res.ok) {
      cancelForm();
      refetch();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette dette ? La catégorie de dépense fixe liée sera aussi supprimée (l'historique déjà saisi est conservé).")) return;
    await fetch(`/api/debts/${id}`, { method: "DELETE" });
    refetch();
  }

  const totals = debts.reduce(
    (acc, d) => {
      const s = computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate));
      acc.remaining += s.remainingBalance;
      acc.monthly += s.monthsRemaining > 0 ? d.monthlyPayment : 0;
      return acc;
    },
    { remaining: 0, monthly: 0 }
  );

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Solde restant dû total</p>
          <p className="text-2xl font-semibold"><Money value={totals.remaining} /></p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Mensualités en cours</p>
          <p className="text-2xl font-semibold"><Money value={totals.monthly} /></p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Nombre de dettes actives</p>
          <p className="text-2xl font-semibold">{debts.length}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => (showForm ? cancelForm() : setShowForm(true))} className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium">
          {showForm ? "Annuler" : "+ Ajouter une dette"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom</label>
            <input placeholder="Ex: Crédit auto Clio" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              {Object.entries(DEBT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date de début</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Montant emprunté</label>
            <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Taux d'intérêt annuel (%)</label>
            <input type="number" step="0.01" value={form.interestRatePct} onChange={(e) => setForm((f) => ({ ...f, interestRatePct: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 text-right" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Durée (mois)</label>
            <input type="number" value={form.durationMonths} onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 text-right" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Mensualité</label>
            <input type="number" step="0.01" value={form.monthlyPayment} onChange={(e) => setForm((f) => ({ ...f, monthlyPayment: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 text-right" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Note (optionnel)</label>
            <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40" />
          </div>
          <button type="submit" className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium">
            {editingId ? "Enregistrer" : "Ajouter"}
          </button>
          <p className="text-xs text-gray-400 basis-full">
            La mensualité sera ajoutée comme catégorie de dépense fixe "{form.name || "..."}", active jusqu'à la fin théorique du remboursement.
          </p>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2 text-right">Emprunté</th>
              <th className="px-4 py-2 text-right">Taux</th>
              <th className="px-4 py-2 text-right">Mensualité</th>
              <th className="px-4 py-2 text-right">Solde restant dû</th>
              <th className="px-4 py-2 text-right">Intérêts totaux</th>
              <th className="px-4 py-2">Progression</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {debts.map((d) => {
              const s = computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate));
              return (
                <tr key={d.id} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium">
                    {d.name}
                    {d.notes && <div className="text-xs text-gray-400 font-normal">{d.notes}</div>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{DEBT_TYPE_LABELS[d.type] ?? d.type}</td>
                  <td className="px-4 py-2 text-right"><Money value={d.amount} /></td>
                  <td className="px-4 py-2 text-right text-gray-500">{d.interestRatePct.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right"><Money value={d.monthlyPayment} /></td>
                  <td className="px-4 py-2 text-right font-medium"><Money value={s.remainingBalance} /></td>
                  <td className="px-4 py-2 text-right text-gray-500"><Money value={s.totalInterest} /></td>
                  <td className="px-4 py-2 w-32">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${Math.min(s.progressPct, 100)}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{s.monthsElapsed}/{d.durationMonths} mois</div>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(d)} className="text-gray-400 hover:text-accent text-xs mr-2">✎</button>
                    <button onClick={() => handleDelete(d.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                  </td>
                </tr>
              );
            })}
            {debts.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Aucune dette enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
