"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Money } from "@/components/BlurToggle";
import { CATEGORICAL_PALETTE } from "@/lib/theme";

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
  allocationPct: number | null;
  order: number;
};

const TYPE_LABELS: Record<string, string> = {
  courant: "Compte courant",
  epargne: "Épargne",
  investissement: "Investissement",
  autre: "Autre",
};

const emptyForm = { name: "", type: "courant", balance: "", allocationPct: "" };
const TOOLTIP_STYLE = { fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(18,35,63,0.08)" };

export default function AccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [latestMonthlyBalance, setLatestMonthlyBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function refetch() {
    return fetch("/api/accounts").then((r) => r.json()).then((data) => { setAccounts(data); setLoading(false); });
  }
  useEffect(() => {
    refetch();
    // Dernier solde de fin de mois connu, saisi dans /input — pour comparaison
    fetch("/api/balances").then((r) => r.json()).then((data: any[]) => {
      const valid = data.filter((b) => b.endBalance != null).sort((a, b) => (a.year - b.year) || (a.month - b.month));
      setLatestMonthlyBalance(valid.length ? valid[valid.length - 1].endBalance : null);
    });
  }, []);

  function startEdit(a: Account) {
    setEditingId(a.id);
    setForm({ name: a.name, type: a.type, balance: String(a.balance), allocationPct: a.allocationPct != null ? String(a.allocationPct) : "" });
    setShowForm(true);
  }
  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    const body = JSON.stringify({
      name: form.name,
      type: form.type,
      balance: form.balance ? Number(form.balance) : 0,
      allocationPct: form.allocationPct ? Number(form.allocationPct) : null,
    });
    const res = editingId
      ? await fetch(`/api/accounts/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
      : await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (res.ok) { cancelForm(); refetch(); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce compte ?")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    refetch();
  }

  // Édition rapide du solde directement dans le tableau
  async function handleQuickBalance(a: Account, value: string) {
    const num = Number(value);
    if (Number.isNaN(num) || num === a.balance) return;
    await fetch(`/api/accounts/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: num }),
    });
    refetch();
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const allocationTotal = accounts.reduce((s, a) => s + (a.allocationPct ?? 0), 0);

  const balanceData = accounts.filter((a) => a.balance > 0).map((a) => ({ name: a.name, value: a.balance }));
  const allocationData = accounts.filter((a) => (a.allocationPct ?? 0) > 0).map((a) => ({ name: a.name, value: a.allocationPct ?? 0 }));

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Solde total (tous comptes)</p>
          <p className="text-2xl font-semibold"><Money value={totalBalance} /></p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Nombre de comptes</p>
          <p className="text-2xl font-semibold">{accounts.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Répartition du salaire allouée</p>
          <p className={`text-2xl font-semibold ${Math.round(allocationTotal) === 100 ? "" : "text-amber-600"}`}>
            {allocationTotal.toFixed(0)}%
          </p>
          {Math.round(allocationTotal) !== 100 && allocationTotal > 0 && (
            <p className="text-xs text-amber-600 mt-1">Le total n'atteint pas 100%</p>
          )}
        </div>
      </div>

      {latestMonthlyBalance !== null && Math.abs(latestMonthlyBalance - totalBalance) > 1 && (
        <p className="text-xs text-gray-400 bg-[#F5F0E6] rounded-lg p-3">
          Pour info : le dernier solde de fin de mois saisi dans <a href="/input" className="text-accent">/input</a> est de{" "}
          <Money value={latestMonthlyBalance} /> — cette page affiche <Money value={totalBalance} /> au total sur tes comptes.
          Les deux ne sont pas reliés automatiquement, à toi de voir si ça mérite une correction quelque part.
        </p>
      )}

      <div className="flex justify-end">
        <button onClick={() => (showForm ? cancelForm() : setShowForm(true))} className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium">
          {showForm ? "Annuler" : "+ Ajouter un compte"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom</label>
            <input placeholder="Ex: Compte courant Belfius" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Solde actuel</label>
            <input type="number" step="0.01" value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">% du salaire routé ici</label>
            <input type="number" step="0.1" placeholder="ex: 30" value={form.allocationPct} onChange={(e) => setForm((f) => ({ ...f, allocationPct: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 text-right" />
          </div>
          <button type="submit" className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium">
            {editingId ? "Enregistrer" : "Ajouter"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-4 py-2">Compte</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2 text-right">Solde</th>
              <th className="px-4 py-2 text-right">% du salaire</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-gray-50">
                <td className="px-4 py-2 font-medium">{a.name}</td>
                <td className="px-4 py-2 text-gray-500">{TYPE_LABELS[a.type] ?? a.type}</td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number" step="0.01" defaultValue={a.balance}
                    onBlur={(e) => handleQuickBalance(a, e.target.value)}
                    className="border border-transparent hover:border-gray-200 focus:border-gray-300 rounded px-2 py-1 w-28 text-right focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2 text-right text-gray-500">{a.allocationPct != null ? `${a.allocationPct}%` : "—"}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => startEdit(a)} className="text-gray-400 hover:text-accent text-xs mr-2">✎</button>
                  <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Aucun compte enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Répartition du solde actuel</p>
          {balanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={balanceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {balanceData.map((_, i) => <Cell key={i} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-10 text-center">Pas encore de solde renseigné.</p>}
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Répartition du salaire entre comptes</p>
          {allocationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={allocationData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {allocationData.map((_, i) => <Cell key={i} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(0)}%`} contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-10 text-center">Pas encore de répartition définie.</p>}
        </div>
      </div>
    </div>
  );
}
