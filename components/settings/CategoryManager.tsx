"use client";

import { useEffect, useState } from "react";
import { GROUP_LABELS, GROUP_ORDER, type CategoryGroupKey } from "@/lib/categories";
import type { CategoryDTO } from "@/types";
import clsx from "clsx";

export default function CategoryManager() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [newName, setNewName] = useState<Record<string, string>>({});

  function load() {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }

  useEffect(load, []);

  async function addCategory(group: CategoryGroupKey) {
    const name = (newName[group] ?? "").trim();
    if (!name) return;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group, name }),
    });
    setNewName((prev) => ({ ...prev, [group]: "" }));
    load();
  }

  async function toggleArchived(cat: CategoryDTO) {
    await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, archived: !cat.archived }),
    });
    load();
  }

  async function rename(cat: CategoryDTO, name: string) {
    if (!name.trim() || name === cat.name) return;
    await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, name: name.trim() }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      {GROUP_ORDER.map((group) => (
        <div key={group} className="card">
          <h3 className="mb-3 font-semibold">{GROUP_LABELS[group]}</h3>
          <ul className="space-y-2">
            {categories
              .filter((c) => c.group === group)
              .map((cat) => (
                <li key={cat.id} className="flex items-center gap-2">
                  <input
                    defaultValue={cat.name}
                    onBlur={(e) => rename(cat, e.target.value)}
                    className={clsx(
                      "flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800",
                      cat.archived && "opacity-50"
                    )}
                  />
                  <button
                    onClick={() => toggleArchived(cat)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  >
                    {cat.archived ? "Réactiver" : "Archiver"}
                  </button>
                </li>
              ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              placeholder="Nouvelle catégorie"
              value={newName[group] ?? ""}
              onChange={(e) => setNewName((prev) => ({ ...prev, [group]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addCategory(group)}
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              onClick={() => addCategory(group)}
              className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white"
            >
              Ajouter
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
