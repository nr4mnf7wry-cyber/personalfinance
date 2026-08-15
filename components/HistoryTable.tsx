"use client";

import { useMemo, useState } from "react";
import { GROUP_LABELS, Group, MONTH_LABELS } from "@/lib/categories";
import { Money } from "@/components/BlurToggle";

type Entry = { year: number; month: number; group: string; category: string; amount: number };
type CategoryRef = { id: string; group: string; name: string; order?: number };
type EditFn = (year: number, month: number, group: string, category: string, amount: number) => Promise<void> | void;
type GroupChangeFn = (categoryId: string, newGroup: Group) => Promise<void> | void;
type DeleteRowFn = (group: string, category: string) => Promise<void> | void;
type ReorderFn = (categoryId: string, direction: "up" | "down") => Promise<void> | void;
type DeleteAllFn = () => Promise<void> | void;

const GROUPS: Group[] = ["revenus", "fixes", "variables", "epargne"];

export default function HistoryTable({
  entries,
  categories = [],
  onEdit,
  onGroupChange,
  onDeleteRow,
  onReorder,
  onDeleteAll,
}: {
  entries: Entry[];
  categories?: CategoryRef[];
  onEdit?: EditFn;
  onGroupChange?: GroupChangeFn;
  onDeleteRow?: DeleteRowFn;
  onReorder?: ReorderFn;
  onDeleteAll?: DeleteAllFn;
}) {
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);

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

  function findCategory(group: string, name: string) {
    return categories.find((c) => c.group === group && c.name === name);
  }

  // Catégories dérivées des entrées elles-mêmes (garde l'historique même si une
  // catégorie a depuis été renommée ou supprimée), triées par groupe puis par
  // ordre personnalisé (si la catégorie existe encore) sinon par nom
  const rows = useMemo(() => {
    const groupOrder = ["revenus", "fixes", "variables", "epargne"];
    const seen = new Map<string, { group: string; category: string }>();
    for (const e of entries) {
      const key = `${e.group}:${e.category}`;
      if (!seen.has(key)) seen.set(key, { group: e.group, category: e.category });
    }
    return Array.from(seen.values()).sort((a, b) => {
      const gDiff = groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
      if (gDiff !== 0) return gDiff;
      const catA = findCategory(a.group, a.category);
      const catB = findCategory(b.group, b.category);
      if (catA && catB) return (catA.order ?? 0) - (catB.order ?? 0);
      return a.category.localeCompare(b.category);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, categories]);

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

  if (months.length === 0) {
    return <p className="text-sm text-gray-500">Aucune saisie pour le moment.</p>;
  }

  return (
    <div className="space-y-2">
      {onDeleteAll && (
        <div className="flex justify-end">
          {confirmingDeleteAll ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-600">Supprimer tout l'historique ? Irréversible.</span>
              <button
                onClick={() => { onDeleteAll(); setConfirmingDeleteAll(false); }}
                className="bg-red-600 text-white rounded-lg px-3 py-1"
              >
                Confirmer
              </button>
              <button onClick={() => setConfirmingDeleteAll(false)} className="border border-gray-300 rounded-lg px-3 py-1">
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDeleteAll(true)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              🗑 Supprimer tout l'historique
            </button>
          )}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {(onReorder || onDeleteRow) && <th className="px-1 py-2 whitespace-nowrap"></th>}
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
            {rows.map(({ group, category }, rowIdx) => {
              const key = `${group}:${category}`;
              const row = grid[key] ?? {};
              const cells = months.map((m) => row[`${m.year}-${m.month}`] ?? null);
              const cat = findCategory(group, category);
              // pour savoir si les flèches haut/bas doivent être actives (limites du groupe)
              const isFirstInGroup = rowIdx === 0 || rows[rowIdx - 1].group !== group;
              const isLastInGroup = rowIdx === rows.length - 1 || rows[rowIdx + 1].group !== group;
              return (
                <tr key={key} className="border-b border-gray-100">
                  {(onReorder || onDeleteRow) && (
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        {onReorder && cat && (
                          <>
                            <button
                              disabled={isFirstInGroup}
                              onClick={() => onReorder(cat.id, "up")}
                              className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:hover:text-gray-300 text-xs"
                              title="Monter"
                            >▲</button>
                            <button
                              disabled={isLastInGroup}
                              onClick={() => onReorder(cat.id, "down")}
                              className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:hover:text-gray-300 text-xs"
                              title="Descendre"
                            >▼</button>
                          </>
                        )}
                        {onDeleteRow && (
                          <button
                            onClick={() => { if (confirm(`Supprimer toute la ligne "${category}" (tous les mois) ?`)) onDeleteRow(group, category); }}
                            className="text-gray-300 hover:text-red-500 text-xs ml-1"
                            title="Supprimer cette ligne"
                          >✕</button>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2 sticky left-0 bg-white text-gray-700 whitespace-nowrap">{category}</td>
                  <td className="px-2 py-1">
                    {onGroupChange && cat ? (
                      <select
                        value={group}
                        onChange={(e) => onGroupChange(cat.id, e.target.value as Group)}
                        className="text-xs border border-gray-200 rounded px-1 py-1 text-gray-600 bg-white"
                      >
                        {GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">{GROUP_LABELS[group as Group] ?? group}</span>
                    )}
                  </td>
                  {months.map((m, i) => {
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
