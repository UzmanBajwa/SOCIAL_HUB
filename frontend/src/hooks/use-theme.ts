import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "socialhub_theme";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // SocialHub's visual identity is a dark command-center -- default new visitors
  // into it rather than following the OS light/dark preference.
  return "dark";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
  }

  function toggleTheme(checked: boolean) {
    setThemeState(checked ? "dark" : "light");
  }

  return { theme, setTheme, toggleTheme };
}
