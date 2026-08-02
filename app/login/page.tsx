"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Email ou mot de passe incorrect");
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError("Erreur serveur — réessaie dans un instant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8 space-y-4">
        <h1 className="text-xl font-semibold">Connexion</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-1">
          <label className="text-sm text-gray-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-600">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>
        <button
          disabled={loading}
          className="w-full bg-accent text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
        <p className="text-sm text-gray-600 text-center">
          Pas de compte ? <Link href="/register" className="text-accent">Créer un compte</Link>
        </p>
      </form>
    </main>
  );
}
