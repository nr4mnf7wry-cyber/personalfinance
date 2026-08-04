"use client";

import { useEffect, useState, Fragment } from "react";
import { Money } from "@/components/BlurToggle";
import { computeLoanState, DEBT_TYPE_LABELS } from "@/lib/loan";

type Prepayment = { id: string; date: string; amount: number; note?: string };
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
  prepayments: Prepayment[];
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
  const [prepayingId, setPrepayingId] = useState<string | null>(null);
  const [prepayForm, setPrepayForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", note: "" });

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

  function totalPrepaid(d: Debt) {
    return d.prepayments.reduce((s, p) => s + p.amount, 0);
  }

  async function handleAddPrepayment(debtId: string, closeDebt: boolean) {
    if (!prepayForm.amount) return;
    await fetch(`/api/debts/${debtId}/prepayments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date(prepayForm.date).toISOString(),
        amount: Number(prepayForm.amount),
        note: prepayForm.note || undefined,
        closeDebt,
      }),
    });
    setPrepayingId(null);
    setPrepayForm({ date: new Date().toISOString().slice(0, 10), amount: "", note: "" });
    refetch();
  }

  const totals = debts.reduce(
    (acc, d) => {
      const s = computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate), totalPrepaid(d));
      acc.remaining += s.remainingBalance;
      acc.monthly += s.monthsRemaining > 0 && s.remainingBalance > 0 ? d.monthlyPayment : 0;
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
              const prepaid = totalPrepaid(d);
              const s = computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate), prepaid);
              return (
                <Fragment key={d.id}>
                <tr className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium">
                    {d.name}
                    {d.notes && <div className="text-xs text-gray-400 font-normal">{d.notes}</div>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{DEBT_TYPE_LABELS[d.type] ?? d.type}</td>
                  <td className="px-4 py-2 text-right"><Money value={d.amount} /></td>
                  <td className="px-4 py-2 text-right text-gray-500">{d.interestRatePct.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right"><Money value={d.monthlyPayment} /></td>
                  <td className="px-4 py-2 text-right font-medium">
                    <Money value={s.remainingBalance} />
                    {prepaid > 0 && <div className="text-xs text-green">dont <Money value={prepaid} /> remboursé en avance</div>}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500"><Money value={s.totalInterest} /></td>
                  <td className="px-4 py-2 w-32">
                    {s.remainingBalance <= 0 ? (
                      <span className="text-xs text-green font-medium">Soldée</span>
                    ) : (
                      <>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${Math.min(s.progressPct, 100)}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{s.monthsElapsed}/{d.durationMonths} mois</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => { setPrepayingId(prepayingId === d.id ? null : d.id); setPrepayForm({ date: new Date().toISOString().slice(0, 10), amount: "", note: "" }); }}
                      className="text-gray-400 hover:text-accent text-xs mr-2"
                    >
                      Remb. anticipé
                    </button>
                    <button onClick={() => startEdit(d)} className="text-gray-400 hover:text-accent text-xs mr-2">✎</button>
                    <button onClick={() => handleDelete(d.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                  </td>
                </tr>
                {prepayingId === d.id && (
                  <tr className="bg-blue-50">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Date</label>
                          <input type="date" value={prepayForm.date} onChange={(e) => setPrepayForm((f) => ({ ...f, date: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Montant remboursé</label>
                          <input type="number" step="0.01" value={prepayForm.amount} onChange={(e) => setPrepayForm((f) => ({ ...f, amount: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Note (optionnel)</label>
                          <input value={prepayForm.note} onChange={(e) => setPrepayForm((f) => ({ ...f, note: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40" />
                        </div>
                        <button onClick={() => handleAddPrepayment(d.id, false)} className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium">
                          Enregistrer
                        </button>
                        <button
                          onClick={() => { setPrepayForm((f) => ({ ...f, amount: String(s.remainingBalance) })); }}
                          className="text-xs text-accent underline"
                          title="Remplit le montant avec le solde restant dû actuel"
                        >
                          Remplir avec le solde restant ({s.remainingBalance.toFixed(0)} €)
                        </button>
                        <button
                          onClick={() => handleAddPrepayment(d.id, true)}
                          className="text-xs bg-red-50 text-red-600 rounded-lg px-3 py-1.5"
                          title="Enregistre ce remboursement ET arrête la mensualité dans la saisie future"
                        >
                          Solder complètement la dette
                        </button>
                        <button onClick={() => setPrepayingId(null)} className="text-xs text-gray-400">Annuler</button>
                      </div>
                      {d.prepayments.length > 0 && (
                        <div className="mt-3 text-xs text-gray-500 space-y-1">
                          <p className="font-medium">Historique des remboursements anticipés :</p>
                          {d.prepayments.map((p) => (
                            <p key={p.id}>{new Date(p.date).toLocaleDateString("fr-FR")} — {p.amount.toFixed(2)} € {p.note ? `(${p.note})` : ""}</p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
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
