"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Money } from "@/components/BlurToggle";
import { CATEGORICAL_PALETTE } from "@/lib/theme";
import { computeMonthTotals, Entry, Balance } from "@/lib/aggregate";
import { GROUP_LABELS } from "@/lib/categories";

type Account = {
  id: string;
  name: string;
  categoryNames: string[];
  balance: number;
  allocationPct: number | null;
  monthlyBudget: number | null;
  order: number;
};

const emptyForm = { name: "", balance: "", allocationPct: "", monthlyBudget: "", categoryNames: [] as string[] };
const TOOLTIP_STYLE = { fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(18,35,63,0.08)" };
const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

export default function AccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  function refetch() {
    return fetch("/api/accounts").then((r) => r.json()).then((data) => { setAccounts(data); setLoading(false); });
  }
  useEffect(() => {
    refetch();
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
    fetch("/api/entries").then((r) => r.json()).then(setEntries);
    fetch("/api/balances").then((r) => r.json()).then(setBalances);
    fetch("/api/investments").then((r) => r.json()).then(setTransactions);
  }, []);

  useEffect(() => {
    const currencies = new Set(transactions.map((t) => t.currency).filter((c: string) => c && c !== "EUR"));
    currencies.forEach((c) => {
      if (rates[c] !== undefined) return;
      fetch(`/api/exchange-rate?from=${c}&to=EUR`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setRates((prev) => ({ ...prev, [c]: data?.rate ?? 1 })))
        .catch(() => setRates((prev) => ({ ...prev, [c]: 1 })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const monthTotals = useMemo(() => computeMonthTotals(entries, balances, transactions, rates), [entries, balances, transactions, rates]);

  const prevMonth = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
  const prevYear = CURRENT_MONTH === 1 ? CURRENT_YEAR - 1 : CURRENT_YEAR;
  const lastClosed = monthTotals.find((t) => t.year === prevYear && t.month === prevMonth);
  const currentMonthTotals = monthTotals.find((t) => t.year === CURRENT_YEAR && t.month === CURRENT_MONTH);
  const montantAAllouer = currentMonthTotals?.revenus ?? lastClosed?.revenus ?? 0;

  // Catégories cochables : celles de la saisie (fixes, variables, épargne), actives ou non
  const selectableCategories = useMemo(
    () => categories.filter((c) => c.group === "fixes" || c.group === "variables" || c.group === "epargne")
      .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)),
    [categories]
  );

  function startEdit(a: Account) {
    setEditingId(a.id);
    setForm({
      name: a.name, balance: String(a.balance),
      allocationPct: a.allocationPct != null ? String(a.allocationPct) : "",
      monthlyBudget: a.monthlyBudget != null ? String(a.monthlyBudget) : "",
      categoryNames: a.categoryNames ?? [],
    });
    setShowForm(true);
  }
  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleCategory(name: string) {
    setForm((f) => ({
      ...f,
      categoryNames: f.categoryNames.includes(name) ? f.categoryNames.filter((c) => c !== name) : [...f.categoryNames, name],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    const body = JSON.stringify({
      name: form.name,
      categoryNames: form.categoryNames,
      balance: form.balance ? Number(form.balance) : 0,
      allocationPct: form.allocationPct ? Number(form.allocationPct) : null,
      monthlyBudget: form.monthlyBudget ? Number(form.monthlyBudget) : null,
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

  async function handleQuickBalance(a: Account, value: string) {
    const num = Number(value);
    if (Number.isNaN(num) || num === a.balance) return;
    await fetch(`/api/accounts/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: num }),
    });
    refetch();
  }

  // Montant suggéré = somme du dernier mois clos pour les catégories cochées sur ce
  // compte. Si aucune catégorie n'est cochée, on retombe sur le budget manuel.
  function suggestedAmount(a: Account): number {
    if (!a.categoryNames || a.categoryNames.length === 0) return a.monthlyBudget ?? 0;
    return entries
      .filter((e) => e.year === prevYear && e.month === prevMonth && a.categoryNames.includes(e.category))
      .reduce((s, e) => s + e.amount, 0);
  }

  function effectiveAmount(a: Account): number {
    return overrides[a.id] ?? suggestedAmount(a);
  }

  async function handleConfirmRepartition() {
    await Promise.all(
      accounts.map((a) => {
        const amount = effectiveAmount(a);
        return fetch(`/api/accounts/${a.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthlyBudget: amount }),
        });
      })
    );
    setOverrides({});
    refetch();
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const balanceData = accounts.filter((a) => a.balance > 0).map((a) => ({ name: a.name, value: a.balance }));

  // Solde restant après chaque compte, dans l'ordre d'affichage — comme un chéquier
  let running = montantAAllouer;
  const repartitionRows = accounts.map((a) => {
    const amount = effectiveAmount(a);
    const before = running;
    running -= amount;
    return { account: a, amount, before, after: running };
  });
  const soldeFinal = running;

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
          <p className="text-sm text-gray-500">Montant à allouer</p>
          <p className="text-2xl font-semibold"><Money value={montantAAllouer} /></p>
          <p className="text-xs text-gray-400 mt-1">Revenus du mois précédent</p>
        </div>
      </div>

      {/* Répartition du mois */}
      {accounts.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Répartition du mois</h2>
            <p className="text-sm text-gray-500">
              Montants suggérés d'après les catégories cochées sur chaque compte ({lastClosed ? `${lastClosed.month}/${lastClosed.year}` : "dernier mois clos"}) — ajustables, avec le solde restant après chaque virement.
            </p>
          </div>
          <div className="card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-2">Compte</th>
                  <th className="px-4 py-2">Catégories couvertes</th>
                  <th className="px-4 py-2 text-right">Montant à virer</th>
                  <th className="px-4 py-2 text-right">Solde restant</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#F5F0E6]/60">
                  <td className="px-4 py-2 font-medium" colSpan={3}>Montant à allouer</td>
                  <td className="px-4 py-2 text-right font-medium"><Money value={montantAAllouer} /></td>
                </tr>
                {repartitionRows.map(({ account: a, amount, after }) => (
                  <tr key={a.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium">{a.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs max-w-[220px]">
                      {a.categoryNames.length > 0 ? a.categoryNames.join(", ") : <span className="italic">budget manuel</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number" step="0.01"
                        value={overrides[a.id] ?? Math.round(amount)}
                        onChange={(e) => setOverrides((o) => ({ ...o, [a.id]: Number(e.target.value) }))}
                        className="border border-gray-300 rounded-lg px-2 py-1 w-28 text-right tabular-nums"
                      />
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums ${after < 0 ? "text-red" : "text-gray-600"}`}>
                      <Money value={after} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="px-4 py-2" colSpan={3}>Solde non affecté</td>
                  <td className={`px-4 py-2 text-right ${Math.abs(soldeFinal) < 1 ? "text-green" : soldeFinal < 0 ? "text-red" : "text-amber-600"}`}>
                    <Money value={soldeFinal} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex justify-end">
            <button onClick={handleConfirmRepartition} className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium">
              Enregistrer cette répartition comme budget du mois
            </button>
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <button onClick={() => (showForm ? cancelForm() : setShowForm(true))} className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium">
          {showForm ? "Annuler" : "+ Ajouter un compte"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nom</label>
              <input placeholder="Ex: Compte courant Belfius" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Solde actuel</label>
              <input type="number" step="0.01" value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Budget manuel (si aucune catégorie cochée)</label>
              <input type="number" step="0.01" placeholder="ex: 200" value={form.monthlyBudget} onChange={(e) => setForm((f) => ({ ...f, monthlyBudget: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 text-right" />
            </div>
            <button type="submit" className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium">
              {editingId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Catégories de la saisie qui alimentent ce compte</label>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3">
              {selectableCategories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.categoryNames.includes(c.name)} onChange={() => toggleCategory(c.name)} className="accent-[var(--accent)]" />
                  <span>{c.name}</span>
                  <span className="text-xs text-gray-400">({GROUP_LABELS[c.group as keyof typeof GROUP_LABELS]})</span>
                </label>
              ))}
              {selectableCategories.length === 0 && <p className="text-sm text-gray-400">Aucune catégorie trouvée — crée-les d'abord dans /input.</p>}
            </div>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-4 py-2">Compte</th>
              <th className="px-4 py-2">Catégories</th>
              <th className="px-4 py-2 text-right">Solde</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-gray-50">
                <td className="px-4 py-2 font-medium">{a.name}</td>
                <td className="px-4 py-2 text-gray-500 text-xs max-w-[240px]">
                  {a.categoryNames.length > 0 ? a.categoryNames.join(", ") : <span className="italic">budget manuel</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number" step="0.01" defaultValue={a.balance}
                    onBlur={(e) => handleQuickBalance(a, e.target.value)}
                    className="border border-transparent hover:border-gray-200 focus:border-gray-300 rounded px-2 py-1 w-28 text-right focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => startEdit(a)} className="text-gray-400 hover:text-accent text-xs mr-2">✎</button>
                  <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aucun compte enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {balanceData.length > 0 && (
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Répartition du solde actuel</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={balanceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                {balanceData.map((_, i) => <Cell key={i} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
