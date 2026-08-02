"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Money } from "@/components/BlurToggle";

type Transaction = {
  id: string;
  date: string;
  ticker: string;
  label?: string;
  type: "achat" | "vente";
  quantity: number;
  unitPrice: number;
  currency: string;
  amount: number;
  sector?: string;
};

const COLORS = ["#1971c2", "#e8590c", "#2f9e44", "#7048e8", "#e03131", "#f08c00", "#0ca678", "#495057"];
const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

const emptyForm = { date: new Date().toISOString().slice(0, 10), ticker: "", label: "", type: "achat" as "achat" | "vente", quantity: "", unitPrice: "", currency: "EUR", sector: "" };

export default function InvestmentsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prices, setPrices] = useState<Record<string, { price: number; changePercent: number } | null>>({});
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  function refetchTransactions() {
    return fetch("/api/investments").then((r) => r.json()).then(setTransactions);
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setForm({
      date: t.date.slice(0, 10),
      ticker: t.ticker,
      label: t.label ?? "",
      type: t.type ?? "achat",
      quantity: String(t.quantity),
      unitPrice: String(t.unitPrice),
      currency: t.currency ?? "EUR",
      sector: t.sector ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette transaction ?")) return;
    await fetch(`/api/investments/${id}`, { method: "DELETE" });
    refetchTransactions();
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ticker || !form.quantity || !form.unitPrice) return;
    setSubmitting(true);
    const body = JSON.stringify({
      date: new Date(form.date).toISOString(),
      ticker: form.ticker,
      label: form.label || undefined,
      type: form.type,
      quantity: Number(form.quantity),
      unitPrice: Number(form.unitPrice),
      currency: form.currency,
      sector: form.sector || undefined,
    });
    const res = editingId
      ? await fetch(`/api/investments/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
      : await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    setSubmitting(false);
    if (res.ok) {
      cancelForm();
      refetchTransactions();
    }
  }

  useEffect(() => {
    fetch("/api/investments")
      .then((r) => r.json())
      .then((data) => { setTransactions(data); setLoading(false); });
  }, []);

  // Positions agrégées par ticker : quantité nette (achats - ventes), prix moyen
  // d'achat, plus-value réalisée (sur les ventes) et latente (sur ce qui reste)
  const positions = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (!map.has(t.ticker)) map.set(t.ticker, []);
      map.get(t.ticker)!.push(t);
    }
    return Array.from(map.entries()).map(([ticker, txs]) => {
      const buys = txs.filter((t) => t.type !== "vente");
      const sells = txs.filter((t) => t.type === "vente");
      const currency = txs[0]?.currency ?? "EUR";
      const sector = txs[0]?.sector;
      const label = txs[0]?.label;

      const totalBuyQty = buys.reduce((s, t) => s + t.quantity, 0);
      const totalBuyAmount = buys.reduce((s, t) => s + t.amount, 0);
      const avgPrice = totalBuyQty !== 0 ? totalBuyAmount / totalBuyQty : 0;

      const totalSellQty = sells.reduce((s, t) => s + t.quantity, 0);
      const totalSellAmount = sells.reduce((s, t) => s + t.amount, 0);

      const quantity = totalBuyQty - totalSellQty;
      const invested = avgPrice * quantity; // coût d'acquisition de ce qu'il reste
      const realizedGain = totalSellAmount - avgPrice * totalSellQty; // plus-value déjà réalisée

      return { ticker, quantity, invested, avgPrice, currency, sector, label, realizedGain };
    });
  }, [transactions]);

  // Taux de change pour chaque devise utilisée (hors EUR)
  useEffect(() => {
    const currencies = new Set(positions.map((p) => p.currency).filter((c) => c && c !== "EUR"));
    currencies.forEach((c) => {
      if (rates[c] !== undefined) return;
      fetch(`/api/exchange-rate?from=${c}&to=EUR`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setRates((prev) => ({ ...prev, [c]: data?.rate ?? 1 })))
        .catch(() => setRates((prev) => ({ ...prev, [c]: 1 })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  // Cours actuels (uniquement utile si on détient encore des titres)
  useEffect(() => {
    positions.filter((p) => p.quantity > 0).forEach((p) => {
      if (prices[p.ticker] !== undefined) return;
      fetch(`/api/stock-price?ticker=${encodeURIComponent(p.ticker)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setPrices((prev) => ({ ...prev, [p.ticker]: data ? { price: data.price, changePercent: data.changePercent } : null })))
        .catch(() => setPrices((prev) => ({ ...prev, [p.ticker]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  function toEur(amount: number, currency: string) {
    return amount * (rates[currency] ?? 1);
  }

  const totalInvested = positions.reduce((s, p) => s + toEur(p.invested, p.currency), 0);
  const totalCurrentValue = positions.reduce((s, p) => {
    const live = prices[p.ticker]?.price;
    const valueInOrigCurrency = live ? live * p.quantity : p.invested;
    return s + toEur(valueInOrigCurrency, p.currency);
  }, 0);
  const totalRealizedGain = positions.reduce((s, p) => s + toEur(p.realizedGain, p.currency), 0);
  const totalUnrealizedGain = totalCurrentValue - totalInvested;
  const totalGain = totalUnrealizedGain + totalRealizedGain;
  const totalGainPct = totalInvested ? (totalUnrealizedGain / totalInvested) * 100 : 0;

  // Évolution du portefeuille (approximation : flux net cumulé achats - ventes, en EUR)
  const evolution = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const map = new Map<string, number>();
    for (const t of sorted) {
      const signed = t.type === "vente" ? -t.amount : t.amount;
      running += toEur(signed, t.currency ?? "EUR");
      const key = t.date.slice(0, 7);
      map.set(key, running);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, rates]);

  const sectorAllocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions.filter((p) => p.quantity > 0)) {
      const key = p.sector ?? "Non renseigné";
      map.set(key, (map.get(key) ?? 0) + toEur(p.invested, p.currency));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, rates]);

  const heldPositions = positions.filter((p) => p.quantity > 0.0001);

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-10">
      {/* Résumé */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Résumé</h2>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium"
        >
          {showForm ? "Annuler" : "+ Ajouter une transaction"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmitForm} className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "achat" | "vente" }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="achat">Achat</option>
              <option value="vente">Vente</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ticker</label>
            <input placeholder="MSFT" value={form.ticker} onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom (optionnel)</label>
            <input placeholder="Microsoft" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Quantité</label>
            <input type="number" step="0.0001" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 text-right" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Prix unitaire {form.type === "vente" ? "(vente)" : "(achat)"}</label>
            <input type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 text-right" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Devise</label>
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Secteur (optionnel)</label>
            <input placeholder="Tech" value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28" />
          </div>
          <button type="submit" disabled={submitting} className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50">
            {submitting ? "Enregistrement..." : editingId ? "Enregistrer" : "Ajouter"}
          </button>
        </form>
      )}

      {/* Chiffres clés (convertis en EUR) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Valeur du portefeuille</p>
          <p className="text-2xl font-semibold"><Money value={totalCurrentValue} /></p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Montant investi</p>
          <p className="text-2xl font-semibold"><Money value={totalInvested} /></p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Plus/moins-value latente</p>
          <p className={`text-2xl font-semibold ${totalUnrealizedGain >= 0 ? "text-green" : "text-red"}`}>
            <Money value={totalUnrealizedGain} /> ({totalGainPct.toFixed(1)}%)
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Plus/moins-value réalisée</p>
          <p className={`text-2xl font-semibold ${totalRealizedGain >= 0 ? "text-green" : "text-red"}`}>
            <Money value={totalRealizedGain} />
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Positions détenues</p>
          <p className="text-2xl font-semibold">{heldPositions.length}</p>
        </div>
      </div>

      {/* Positions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Positions actuelles</h2>
        <p className="text-xs text-gray-400 mb-2">
          Montants convertis en EUR au taux du jour (source : Frankfurter / Banque Centrale Européenne)
        </p>
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-2">Ticker</th>
                <th className="px-4 py-2 text-right">Quantité</th>
                <th className="px-4 py-2 text-right">Prix moyen d'achat</th>
                <th className="px-4 py-2 text-right">Cours actuel</th>
                <th className="px-4 py-2 text-right">Valeur actuelle (EUR)</th>
                <th className="px-4 py-2 text-right">+/- value latente</th>
                <th className="px-4 py-2 text-right">+/- value réalisée</th>
              </tr>
            </thead>
            <tbody>
              {heldPositions.map((p) => {
                const live = prices[p.ticker];
                const currentValueOrig = live ? live.price * p.quantity : p.invested;
                const currentValueEur = toEur(currentValueOrig, p.currency);
                const investedEur = toEur(p.invested, p.currency);
                const gain = currentValueEur - investedEur;
                const gainPct = investedEur ? (gain / investedEur) * 100 : 0;
                return (
                  <tr key={p.ticker} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium">
                      {p.ticker} {p.currency !== "EUR" && <span className="text-xs text-gray-400 font-normal">({p.currency})</span>}
                    </td>
                    <td className="px-4 py-2 text-right">{p.quantity}</td>
                    <td className="px-4 py-2 text-right">{p.avgPrice.toFixed(2)} {p.currency}</td>
                    <td className="px-4 py-2 text-right">
                      {live ? `${live.price.toFixed(2)} ${p.currency}` : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right"><Money value={currentValueEur} /></td>
                    <td className={`px-4 py-2 text-right ${gain >= 0 ? "text-green" : "text-red"}`}>
                      <Money value={gain} /> ({gainPct.toFixed(1)}%)
                    </td>
                    <td className={`px-4 py-2 text-right ${p.realizedGain >= 0 ? "text-green" : "text-red"}`}>
                      {p.realizedGain !== 0 ? <Money value={toEur(p.realizedGain, p.currency)} /> : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
              {heldPositions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Aucune position en cours — ajoute une transaction ci-dessus.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Graphiques */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Évolution du portefeuille (EUR)</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={evolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
              <Line type="monotone" dataKey="value" stroke="#7048e8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Répartition par secteur (EUR)</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={sectorAllocation} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                {sectorAllocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historique des transactions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Historique des transactions</h2>
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Ticker</th>
                <th className="px-4 py-2">Titre</th>
                <th className="px-4 py-2 text-right">Quantité</th>
                <th className="px-4 py-2 text-right">Prix unitaire</th>
                <th className="px-4 py-2 text-right">Montant</th>
                <th className="px-4 py-2 text-right">Devise</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="px-4 py-2">{new Date(t.date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${t.type === "vente" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                      {t.type === "vente" ? "Vente" : "Achat"}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium">{t.ticker}</td>
                  <td className="px-4 py-2 text-gray-500">{t.label ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{t.quantity}</td>
                  <td className="px-4 py-2 text-right">{t.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{t.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{t.currency ?? "EUR"}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-accent text-xs mr-2" title="Modifier">✎</button>
                    <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500 text-xs" title="Supprimer">✕</button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Aucune transaction pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
