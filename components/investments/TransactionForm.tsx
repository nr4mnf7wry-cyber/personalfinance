"use client";

import { useState } from "react";

export default function TransactionForm({ onSaved }: { onSaved: () => void }) {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [fees, setFees] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function fetchQuote() {
    if (!ticker) return;
    const res = await fetch(`/api/investments/quote?ticker=${encodeURIComponent(ticker)}`);
    const data = await res.json();
    if (data.quote?.price) setPricePerUnit(String(data.quote.price));
  }

  async function handleSubmit() {
    setBusy(true);
    await fetch("/api/investments/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        name: name || undefined,
        type,
        quantity: Number(quantity),
        pricePerUnit: Number(pricePerUnit),
        fees: Number(fees || 0),
        date,
      }),
    });
    setBusy(false);
    setTicker("");
    setName("");
    setQuantity("");
    setPricePerUnit("");
    setFees("");
    onSaved();
  }

  return (
    <div className="card">
      <h3 className="mb-3 font-semibold">Ajouter une transaction</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "BUY" | "SELL")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="BUY">Achat</option>
          <option value="SELL">Vente</option>
        </select>
        <input
          placeholder="Ticker (ex: AAPL)"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onBlur={fetchQuote}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          placeholder="Nom (optionnel)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          placeholder="Quantité"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          placeholder="Prix / unité"
          type="number"
          value={pricePerUnit}
          onChange={(e) => setPricePerUnit(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          placeholder="Frais (optionnel)"
          type="number"
          value={fees}
          onChange={(e) => setFees(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={busy || !ticker || !quantity || !pricePerUnit}
        className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Enregistrement..." : "Ajouter"}
      </button>
    </div>
  );
}
