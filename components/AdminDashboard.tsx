"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { GOLD } from "@/lib/theme";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  entryCount: number;
  transactionCount: number;
  lastActivity: string | null;
  activeLast30Days: boolean;
};

type Stats = {
  totalUsers: number;
  totalEntries: number;
  totalTransactions: number;
  totalHouseholds: number;
  activeUsersLast30Days: number;
  signupsByMonth: { label: string; count: number }[];
  users: UserRow[];
};

const TOOLTIP_STYLE = { fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(18,35,63,0.08)" };

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(async (r) => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Erreur"); }
        return r.json();
      })
      .then((data) => { setStats(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      <p className="text-xs text-gray-400">
        Statistiques d'usage agrégées uniquement — aucune donnée financière individuelle des utilisateurs n'est affichée ici.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Utilisateurs inscrits</p>
          <p className="text-2xl font-semibold">{stats.totalUsers}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Actifs (30 derniers jours)</p>
          <p className="text-2xl font-semibold">{stats.activeUsersLast30Days}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Lignes de saisie au total</p>
          <p className="text-2xl font-semibold">{stats.totalEntries}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Transactions boursières</p>
          <p className="text-2xl font-semibold">{stats.totalTransactions}</p>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-sm text-gray-500 mb-2">Inscriptions par mois (12 derniers mois)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.signupsByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-4 py-2">Utilisateur</th>
              <th className="px-4 py-2">Inscrit le</th>
              <th className="px-4 py-2 text-right">Lignes saisies</th>
              <th className="px-4 py-2 text-right">Transactions</th>
              <th className="px-4 py-2">Dernière activité</th>
              <th className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {stats.users.map((u) => (
              <tr key={u.id} className="border-b border-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium">{u.name || "—"}</div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </td>
                <td className="px-4 py-2 text-gray-500">{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2 text-right">{u.entryCount}</td>
                <td className="px-4 py-2 text-right">{u.transactionCount}</td>
                <td className="px-4 py-2 text-gray-500">
                  {u.lastActivity ? new Date(u.lastActivity).toLocaleDateString("fr-FR") : "Jamais"}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${u.activeLast30Days ? "bg-green-50 text-green" : "bg-gray-100 text-gray-500"}`}>
                    {u.activeLast30Days ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
