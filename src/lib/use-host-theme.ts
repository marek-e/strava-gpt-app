import { useEffect } from "react";
import { useLayout } from "skybridge/web";

/**
 * Mirrors the host theme onto `<html data-theme="…">` so CSS tokens scoped to
 * `[data-theme="dark"]` swap automatically. Call once at the top of each view.
 */
export function useHostTheme(): "light" | "dark" {
  const { theme } = useLayout();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return theme;
}
