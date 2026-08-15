"use client";

import { useEffect, useRef, useState } from "react";
import { MONTH_LABELS } from "@/lib/categories";

export default function MonthYearPicker({
  year,
  month,
  onChange,
  maxYear,
  maxMonth,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  maxYear?: number;
  maxMonth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [panelYear, setPanelYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setPanelYear(year), [year, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const atMax = maxYear !== undefined && maxMonth !== undefined && year === maxYear && month === maxMonth;

  function step(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    if (maxYear !== undefined && maxMonth !== undefined && (y > maxYear || (y === maxYear && m > maxMonth))) return;
    onChange(y, m);
  }

  function pick(m: number) {
    if (maxYear !== undefined && maxMonth !== undefined && (panelYear > maxYear || (panelYear === maxYear && m > maxMonth))) return;
    onChange(panelYear, m);
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <div className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden text-sm">
        <button onClick={() => step(-1)} className="px-2.5 py-2 hover:bg-gray-50 text-gray-500" title="Mois précédent">
          ‹
        </button>
        <button onClick={() => setOpen((o) => !o)} className="px-3 py-2 font-medium text-ink hover:bg-gray-50 border-x border-gray-200 min-w-[130px] text-center">
          {MONTH_LABELS[month - 1]} {year}
        </button>
        <button onClick={() => step(1)} disabled={atMax} className="px-2.5 py-2 hover:bg-gray-50 text-gray-500 disabled:opacity-30 disabled:hover:bg-white" title="Mois suivant">
          ›
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 card bg-white shadow-lg p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setPanelYear((y) => y - 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-50 rounded">‹</button>
            <span className="text-sm font-medium">{panelYear}</span>
            <button
              onClick={() => setPanelYear((y) => y + 1)}
              disabled={maxYear !== undefined && panelYear >= maxYear}
              className="px-2 py-1 text-gray-500 hover:bg-gray-50 rounded disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_LABELS.map((m, i) => {
              const mNum = i + 1;
              const disabled = maxYear !== undefined && maxMonth !== undefined && (panelYear > maxYear || (panelYear === maxYear && mNum > maxMonth));
              const active = panelYear === year && mNum === month;
              return (
                <button
                  key={m}
                  disabled={disabled}
                  onClick={() => pick(mNum)}
                  className={`text-xs px-2 py-1.5 rounded ${active ? "bg-accent text-white" : disabled ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
