"use client";

import { useMemo, useState } from "react";
import { GROUP_LABELS, Group, MONTH_LABELS } from "@/lib/categories";
import { Money } from "@/components/BlurToggle";

type Entry = { year: number; month: number; group: string; category: string; amount: number };
type CategoryRef = { id: string; group: string; name: string };
type EditFn = (year: number, month: number, group: string, category: string, amount: number) => Promise<void> | void;
type GroupChangeFn = (categoryId: string, newGroup: Group) => Promise<void> | void;

const GROUPS: Group[] = ["revenus", "fixes", "variables", "epargne"];

export default function HistoryTable({
  entries,
  categories = [],
  onEdit,
  onGroupChange,
}: {
  entries: Entry[];
  categories?: CategoryRef[];
  onEdit?: EditFn;
  onGroupChange?: GroupChangeFn;
}) {
  // Construit la liste triée des mois présents
  const months = useMemo(() => {
    const set = new Set(entries.map((e) => `${e.year}-${e.month}`));
    return Array.from(set)
      .map((s) => {
        const [y, m] = s.split("-").map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);
  }, [entries]);

  // Catégories dérivées des entrées elles-mêmes (garde l'historique même si une
  // catégorie a depuis été renommée ou supprimée), groupées et triées par groupe
  const rows = useMemo(() => {
    const order = ["revenus", "fixes", "variables", "epargne"];
    const seen = new Map<string, { group: string; category: string }>();
    for (const e of entries) {
      const key = `${e.group}:${e.category}`;
      if (!seen.has(key)) seen.set(key, { group: e.group, category: e.category });
    }
    return Array.from(seen.values()).sort(
      (a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.category.localeCompare(b.category)
    );
  }, [entries]);

  // grid[group:category][monthKey] = amount
  const grid = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const e of entries) {
      const key = `${e.group}:${e.category}`;
      if (!map[key]) map[key] = {};
      map[key][`${e.year}-${e.month}`] = e.amount;
    }
    return map;
  }, [entries]);

  function findCategoryId(group: string, name: string) {
    return categories.find((c) => c.group === group && c.name === name)?.id;
  }

  if (months.length === 0) {
    return <p className="text-sm text-gray-500">Aucune saisie pour le moment.</p>;
  }

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left px-4 py-2 sticky left-0 bg-white">Catégorie</th>
            <th className="text-left px-4 py-2 whitespace-nowrap">Groupe</th>
            {months.map((m) => (
              <th key={`${m.year}-${m.month}`} className="text-right px-4 py-2 whitespace-nowrap">
                {MONTH_LABELS[m.month - 1].slice(0, 3)} {m.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ group, category }) => {
            const key = `${group}:${category}`;
            const row = grid[key] ?? {};
            const cells = months.map((m) => row[`${m.year}-${m.month}`] ?? null);
            const catId = findCategoryId(group, category);
            return (
              <tr key={key} className="border-b border-gray-100">
                <td className="px-4 py-2 sticky left-0 bg-white text-gray-700 whitespace-nowrap">{category}</td>
                <td className="px-2 py-1">
                  {onGroupChange && catId ? (
                    <select
                      value={group}
                      onChange={(e) => onGroupChange(catId, e.target.value as Group)}
                      className="text-xs border border-gray-200 rounded px-1 py-1 text-gray-600 bg-white"
                    >
                      {GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-400">{GROUP_LABELS[group as Group] ?? group}</span>
                  )}
                </td>
                {months.map((m, i) => {
                  // fusion purement visuelle : pas de bordure gauche si la valeur
                  // est identique au mois précédent (mais chaque cellule reste éditable)
                  const sameAsPrev = i > 0 && cells[i] === cells[i - 1] && cells[i] !== null;
                  return (
                    <td key={`${m.year}-${m.month}`} className={`text-right p-0 ${sameAsPrev ? "border-l-0" : "border-l border-gray-100"}`}>
                      <EditableCell
                        value={cells[i]}
                        editable={!!onEdit}
                        onSave={(newVal) => onEdit?.(m.year, m.month, group, category, newVal)}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditableCell({ value, editable, onSave }: { value: number | null; editable: boolean; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "0");

  if (!editable) {
    return (
      <div className="px-4 py-2 text-gray-800">
        {value !== null ? <Money value={value} /> : <span className="text-gray-300">—</span>}
      </div>
    );
  }

  if (editing) {
    return (
      <input
        type="number"
        step="0.01"
        autoFocus
        defaultValue={value ?? 0}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const num = Math.round(Number(draft) * 100) / 100;
          if (!Number.isNaN(num) && num !== value) onSave(num);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full text-right px-4 py-2 border-2 border-accent outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value?.toString() ?? "0"); setEditing(true); }}
      className="w-full text-right px-4 py-2 text-gray-800 hover:bg-blue-50 cursor-text"
      title="Cliquer pour modifier"
    >
      {value !== null ? <Money value={value} /> : <span className="text-gray-300">—</span>}
    </button>
  );
}
