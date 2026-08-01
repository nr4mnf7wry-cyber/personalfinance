"use client";

import { useState } from "react";

export default function LinkInvestmentModal({
  entryId,
  suggestedAmount,
  currency,
  onClose,
  onLinked,
}: {
  entryId: string;
  suggestedAmount: number;
  currency: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchQuote() {
    if (!ticker) return;
    const res = await fetch(`/api/investments/quote?ticker=${encodeURIComponent(ticker)}`);
    const data = await res.json();
    if (data.quote?.price) setPricePerUnit(String(data.quote.price));
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/investments/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        name: name || undefined,
        type: "BUY",
        quantity: Number(quantity),
        pricePerUnit: Number(pricePerUnit),
        currency,
        date,
        linkedEntryId: entryId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Erreur lors de la création de la transaction.");
      return;
    }
    onLinked();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 dark:bg-slate-900">
        <h3 className="mb-1 font-semibold">Lier à un achat d&apos;actions</h3>
        <p className="mb-4 text-xs text-slate-500">
          Montant épargné ce mois : {suggestedAmount} {currency}
        </p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              placeholder="Ticker (ex: AAPL)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onBlur={fetchQuote}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <input
            placeholder="Nom (optionnel)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <div className="flex gap-2">
            <input
              placeholder="Quantité"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              placeholder="Prix / unité"
              type="number"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          {error && <p className="text-xs text-expense">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy || !ticker || !quantity || !pricePerUnit}
              className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "..." : "Lier"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
