"use client";

import { useState, useEffect } from "react";

export type Theme = "dark" | "light";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem("awwaz_theme") as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("awwaz_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    window.dispatchEvent(new CustomEvent("awwaz-theme-changed", { detail: theme }));
  } catch (err) {
    console.error("Failed to persist theme:", err);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const current = getInitialTheme();
    setThemeState(current);
    document.documentElement.setAttribute("data-theme", current);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>;
      if (customEvent.detail) {
        setThemeState(customEvent.detail);
      }
    };

    window.addEventListener("awwaz-theme-changed", handleThemeChange);
    return () => window.removeEventListener("awwaz-theme-changed", handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    applyTheme(next);
  };

  return { theme, toggleTheme };
}
