"use client";

import { createContext, useContext, useEffect, useState } from "react";

type BlurContextValue = {
  blurred: boolean;
  toggle: () => void;
};

const BlurContext = createContext<BlurContextValue>({
  blurred: false,
  toggle: () => {},
});

const STORAGE_KEY = "finance-tracker.blur";

export function BlurProvider({ children }: { children: React.ReactNode }) {
  const [blurred, setBlurred] = useState(false);

  // Restore preference on mount; keep <body data-blur> in sync so the pure
  // CSS rule in globals.css can do the actual blurring (no per-component work).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setBlurred(true);
  }, []);

  useEffect(() => {
    document.body.dataset.blur = blurred ? "true" : "false";
    window.localStorage.setItem(STORAGE_KEY, String(blurred));
  }, [blurred]);

  return (
    <BlurContext.Provider value={{ blurred, toggle: () => setBlurred((b) => !b) }}>
      {children}
    </BlurContext.Provider>
  );
}

export function useBlur() {
  return useContext(BlurContext);
}
