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
  quantity: number;
  unitPrice: number;
  amount: number;
  sector?: string;
};

const COLORS = ["#1971c2", "#e8590c", "#2f9e44", "#7048e8", "#e03131", "#f08c00", "#0ca678", "#495057"];

export default function InvestmentsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prices, setPrices] = useState<Record<string, { price: number; changePercent: number } | null>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), ticker: "", label: "", quantity: "", unitPrice: "", sector: "" });
  const [submitting, setSubmitting] = useState(false);

  function refetchTransactions() {
    return fetch("/api/investments").then((r) => r.json()).then(setTransactions);
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ticker || !form.quantity || !form.unitPrice) return;
    setSubmitting(true);
    const res = await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date(form.date).toISOString(),
        ticker: form.ticker,
        label: form.label || undefined,
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice),
        sector: form.sector || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setForm({ date: new Date().toISOString().slice(0, 10), ticker: "", label: "", quantity: "", unitPrice: "", sector: "" });
      setShowForm(false);
      refetchTransactions();
    }
  }

  useEffect(() => {
    fetch("/api/investments")
      .then((r) => r.json())
      .then((data) => { setTransactions(data); setLoading(false); });
  }, []);

  // Positions agrégées par ticker (quantité totale, prix moyen d'achat pondéré)
  const positions = useMemo(() => {
    const map = new Map<string, { ticker: string; quantity: number; invested: number; sector?: string; label?: string }>();
    for (const t of transactions) {
      const cur = map.get(t.ticker) ?? { ticker: t.ticker, quantity: 0, invested: 0, sector: t.sector, label: t.label };
      cur.quantity += t.quantity;
      cur.invested += t.amount;
      map.set(t.ticker, cur);
    }
    return Array.from(map.values()).map((p) => ({
      ...p,
      avgPrice: p.quantity !== 0 ? p.invested / p.quantity : 0,
    }));
  }, [transactions]);

  // Récupère les cours actuels pour chaque ticker détenu
  useEffect(() => {
    positions.forEach((p) => {
      if (prices[p.ticker] !== undefined) return;
      fetch(`/api/stock-price?ticker=${encodeURIComponent(p.ticker)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setPrices((prev) => ({ ...prev, [p.ticker]: data ? { price: data.price, changePercent: data.changePercent } : null })))
        .catch(() => setPrices((prev) => ({ ...prev, [p.ticker]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const totalInvested = positions.reduce((s, p) => s + p.invested, 0);
  const totalCurrentValue = positions.reduce((s, p) => {
    const live = prices[p.ticker]?.price;
    return s + (live ? live * p.quantity : p.invested);
  }, 0);
  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested ? (totalGain / totalInvested) * 100 : 0;

  // Évolution du portefeuille (approximation : valeur investie cumulée mois par mois)
  const evolution = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const map = new Map<string, number>();
    for (const t of sorted) {
      running += t.amount;
      const key = t.date.slice(0, 7);
      map.set(key, running);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [transactions]);

  const sectorAllocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions) {
      const key = p.sector ?? "Non renseigné";
      map.set(key, (map.get(key) ?? 0) + p.invested);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [positions]);

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-10">
      {/* Résumé */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Résumé</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium"
        >
          {showForm ? "Annuler" : "+ Ajouter une transaction"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddTransaction} className="card p-4 flex flex-wrap items-end gap-3">
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
            <label className="text-xs text-gray-500 block mb-1">Prix unitaire</label>
            <input type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 text-right" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Secteur (optionnel)</label>
            <input placeholder="Tech" value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28" />
          </div>
          <button type="submit" disabled={submitting} className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50">
            {submitting ? "Ajout..." : "Ajouter"}
          </button>
        </form>
      )}

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <p className={`text-2xl font-semibold ${totalGain >= 0 ? "text-green" : "text-red"}`}>
            <Money value={totalGain} /> ({totalGainPct.toFixed(1)}%)
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Positions</p>
          <p className="text-2xl font-semibold">{positions.length}</p>
        </div>
      </div>

      {/* Positions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Positions actuelles</h2>
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-2">Ticker</th>
                <th className="px-4 py-2 text-right">Quantité</th>
                <th className="px-4 py-2 text-right">Prix moyen d'achat</th>
                <th className="px-4 py-2 text-right">Cours actuel</th>
                <th className="px-4 py-2 text-right">Valeur actuelle</th>
                <th className="px-4 py-2 text-right">+/- value</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const live = prices[p.ticker];
                const currentValue = live ? live.price * p.quantity : p.invested;
                const gain = currentValue - p.invested;
                const gainPct = p.invested ? (gain / p.invested) * 100 : 0;
                return (
                  <tr key={p.ticker} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium">{p.ticker}</td>
                    <td className="px-4 py-2 text-right">{p.quantity}</td>
                    <td className="px-4 py-2 text-right"><Money value={p.avgPrice} /></td>
                    <td className="px-4 py-2 text-right">
                      {live ? <Money value={live.price} /> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right"><Money value={currentValue} /></td>
                    <td className={`px-4 py-2 text-right ${gain >= 0 ? "text-green" : "text-red"}`}>
                      <Money value={gain} /> ({gainPct.toFixed(1)}%)
                    </td>
                  </tr>
                );
              })}
              {positions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Aucune position — ajoute un montant sur la catégorie "Investissement" lors de ta saisie mensuelle.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Graphiques */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Évolution du portefeuille</p>
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
          <p className="text-sm text-gray-500 mb-2">Répartition par secteur</p>
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
                <th className="px-4 py-2">Ticker</th>
                <th className="px-4 py-2">Titre</th>
                <th className="px-4 py-2 text-right">Quantité</th>
                <th className="px-4 py-2 text-right">Prix unitaire</th>
                <th className="px-4 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="px-4 py-2">{new Date(t.date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2 font-medium">{t.ticker}</td>
                  <td className="px-4 py-2 text-gray-500">{t.label ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{t.quantity}</td>
                  <td className="px-4 py-2 text-right"><Money value={t.unitPrice} /></td>
                  <td className="px-4 py-2 text-right"><Money value={t.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
