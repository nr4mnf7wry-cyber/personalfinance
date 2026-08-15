"use client";

import { useEffect, useState } from "react";

type Member = { id: string; name: string | null; email: string };
type Invite = { id: string; code: string; createdAt: string };
type Household = { id: string; name: string | null; members: Member[]; invites: Invite[] } | null;
type SharingRow = { module: string; visible: boolean };

const MODULE_LABELS: Record<string, string> = {
  entries: "Saisie mensuelle (revenus, dépenses, épargne)",
  investments: "Investissements cotés (actions, ETF)",
  private_investments: "Investissements non cotés",
  debts: "Dettes",
  accounts: "Comptes bancaires",
  goals: "Objectifs patrimoniaux",
};

export default function HouseholdSettings() {
  const [household, setHousehold] = useState<Household>(null);
  const [sharing, setSharing] = useState<SharingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);

  function refetch() {
    return Promise.all([
      fetch("/api/household").then((r) => r.json()).then((d) => setHousehold(d.household)),
      fetch("/api/household/sharing").then((r) => r.json()).then(setSharing),
    ]).then(() => setLoading(false));
  }
  useEffect(() => { refetch(); }, []);

  async function handleCreate() {
    setError(null);
    const res = await fetch("/api/household", { method: "POST" });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    refetch();
  }

  async function handleJoin() {
    setError(null);
    if (!joinCode) return;
    const res = await fetch("/api/household/join", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode.trim() }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setJoinCode("");
    refetch();
  }

  async function handleLeave() {
    if (!confirm("Quitter ce foyer ? Tes données personnelles ne sont pas supprimées, elles redeviennent simplement privées.")) return;
    await fetch("/api/household/leave", { method: "POST" });
    refetch();
  }

  async function handleInvite() {
    const res = await fetch("/api/household/invite", { method: "POST" });
    if (res.ok) {
      const invite = await res.json();
      setNewInviteCode(invite.code);
      refetch();
    }
  }

  async function handleToggleSharing(mod: string, visible: boolean) {
    setSharing((s) => s.map((r) => (r.module === mod ? { ...r, visible } : r)));
    await fetch("/api/household/sharing", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: mod, visible }),
    });
  }

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Foyer</h2>
        <p className="text-sm text-gray-500">
          Un foyer permet de partager la vue de tes finances avec quelqu'un (ton/ta partenaire, par exemple).
          Chacun garde la pleine propriété de ses propres données — rien n'est fusionné, et tu choisis toi-même,
          module par module, ce que tu rends visible à l'autre.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!household ? (
          <div className="card p-5 space-y-4">
            <div>
              <button onClick={handleCreate} className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium">
                Créer un foyer
              </button>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs text-gray-500 block mb-1">Ou rejoindre un foyer existant avec un code d'invitation</label>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Ex: A1B2C3D4"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
                />
                <button onClick={handleJoin} className="border border-accent text-accent rounded-lg px-4 py-2 text-sm font-medium">
                  Rejoindre
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-5 space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">Membres du foyer</p>
              <ul className="space-y-1">
                {household.members.map((m) => (
                  <li key={m.id} className="text-sm text-ink">{m.name || m.email}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <button onClick={handleInvite} className="text-sm text-accent font-medium">
                + Générer un code d'invitation
              </button>
              {newInviteCode && (
                <p className="text-sm mt-2 bg-[#F5F0E6] rounded-lg p-3">
                  Code : <span className="font-mono font-semibold">{newInviteCode}</span> — partage-le à la personne que tu veux inviter
                  (elle doit avoir un compte, puis le saisir dans "Rejoindre un foyer existant").
                </p>
              )}
              {household.invites.length > 0 && (
                <div className="mt-2 space-y-1">
                  {household.invites.map((inv) => (
                    <p key={inv.id} className="text-xs text-gray-400">
                      Code en attente : <span className="font-mono">{inv.code}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <button onClick={handleLeave} className="text-sm text-red-600">
                Quitter ce foyer
              </button>
            </div>
          </div>
        )}
      </section>

      {household && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Ce que je partage avec mon foyer</h2>
            <p className="text-sm text-gray-500">
              Décide toi-même, module par module, ce que les autres membres peuvent voir. Tout est privé par défaut.
              Ce réglage ne concerne que la visibilité — chacun reste seul maître de ses propres saisies.
            </p>
          </div>
          <div className="card divide-y divide-gray-50">
            {sharing.map((row) => (
              <label key={row.module} className="flex items-center justify-between px-5 py-3 cursor-pointer">
                <span className="text-sm text-ink">{MODULE_LABELS[row.module] ?? row.module}</span>
                <input
                  type="checkbox"
                  checked={row.visible}
                  onChange={(e) => handleToggleSharing(row.module, e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Ces réglages sont enregistrés dès maintenant. L'affichage effectif des données partagées dans chaque page
            arrive dans une prochaine mise à jour.
          </p>
        </section>
      )}
    </div>
  );
}
