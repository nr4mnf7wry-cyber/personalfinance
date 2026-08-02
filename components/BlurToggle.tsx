"use client";

import { createContext, useContext, useState } from "react";

const BlurContext = createContext<{ blurred: boolean; toggle: () => void }>({
  blurred: false,
  toggle: () => {},
});

export function BlurProvider({ children }: { children: React.ReactNode }) {
  const [blurred, setBlurred] = useState(false);
  return (
    <BlurContext.Provider value={{ blurred, toggle: () => setBlurred((b) => !b) }}>
      <div className={blurred ? "blur-numbers" : ""}>{children}</div>
    </BlurContext.Provider>
  );
}

export function useBlur() {
  return useContext(BlurContext);
}

export function BlurToggleButton() {
  const { blurred, toggle } = useBlur();
  return (
    <button
      onClick={toggle}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
    >
      {blurred ? "👁️ Afficher les chiffres" : "🙈 Flouter les chiffres"}
    </button>
  );
}

// Wrapper à utiliser autour de tout montant affiché à l'écran
export function Money({ value, className = "" }: { value: number; className?: string }) {
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return <span className={`money ${className}`}>{formatted}</span>;
}
