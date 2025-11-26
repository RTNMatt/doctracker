// src/context/ThemeContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../lib/api";

export type ThemeName = "light" | "dark" | "custom";

/**
 * Area-based theme model.
 * Every major UI zone gets explicit bg + text tokens.
 */
export type CustomTheme = {
  // Sidebar
  sidebarBg: string;
  sidebarText: string;
  sidebarControlBg: string;
  sidebarControlText: string;

  // Chrome (toolbar + bottom doc bar)
  chromeBg: string;
  chromeText: string;

  // Main content behind tiles/doc
  contentBg: string;
  contentText: string;

  // Card/tile/tag surfaces
  cardBg: string;
  cardText: string;

  // Document “paper”
  docBg: string;
  docText: string;

  // Borders
  borderSoft: string;

  // Accent
  brand: string;
  brandStrong: string;
};

/** Mirrors your current light theme feel */
const defaultCustomTheme: CustomTheme = {
  sidebarBg: "#EEF3FF",
  sidebarText: "#1F2937",
  sidebarControlBg: "#FFFFFF",
  sidebarControlText: "#1F2937",

  chromeBg: "#E5ECF6",
  chromeText: "#111827",

  contentBg: "#FAFCFF",
  contentText: "#0B1220",

  cardBg: "#FFFFFF",
  cardText: "#0B1220",

  docBg: "#FFFFFF",
  docText: "#0B1220",

  borderSoft: "#E5ECF6",

  brand: "#3A7BFA",
  brandStrong: "#2563EB",
};

type ThemeContextValue = {
  themeName: ThemeName;
  setThemeName: (t: ThemeName) => void;
  customTheme: CustomTheme;
  updateCustomTheme: (patch: Partial<CustomTheme>) => void;
  reloadThemeFromServer: () => Promise<void>;
  saveTheme: () => void;
  hasUnsavedChanges: boolean;
};

type UserThemePayload = {
  mode?: ThemeName;
  custom?: Partial<CustomTheme> | null;
} | null;

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Map CustomTheme → CSS variables */
const cssVarMap: Record<keyof CustomTheme, string> = {
  sidebarBg: "--sidebar-bg",
  sidebarText: "--sidebar-text",
  sidebarControlBg: "--sidebar-control-bg",
  sidebarControlText: "--sidebar-control-text",

  chromeBg: "--chrome-bg",
  chromeText: "--chrome-text",

  contentBg: "--content-bg",
  contentText: "--content-text",

  cardBg: "--card-bg",
  cardText: "--card-text",

  docBg: "--doc-bg",
  docText: "--doc-text",

  borderSoft: "--border-soft",

  brand: "--brand",
  brandStrong: "--brand-strong",
};

const mergeCustomTheme = (
  incoming?: Partial<CustomTheme> | null
): CustomTheme => ({
  ...defaultCustomTheme,
  ...(incoming || {}),
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeName, setThemeNameState] = useState<ThemeName>("light");
  const [customTheme, setCustomTheme] = useState<CustomTheme>(
    defaultCustomTheme
  );
  // Track the last saved state to detect changes
  const [savedCustomTheme, setSavedCustomTheme] = useState<CustomTheme>(
    defaultCustomTheme
  );

  // --- Backend persistence helpers ---

  const saveThemeToServer = (mode: ThemeName, custom: CustomTheme) => {
    // Fire-and-forget: UI should stay snappy
    void api
      .post("/theme/", {
        mode,
        custom,
      })
      .catch((err) => {
        // Non-fatal
        console.error("Failed to save theme", err);
      });
  };

  const reloadThemeFromServer = async () => {
    try {
      const res = await api.get<UserThemePayload>("/theme/");
      const data = res.data;

      if (!data) {
        return;
      }

      const mode = (data.mode as ThemeName) || "light";
      const mergedCustom = mergeCustomTheme(data.custom || {});

      setThemeNameState(mode);
      setCustomTheme(mergedCustom);
      setSavedCustomTheme(mergedCustom);
    } catch (err: any) {
      // 401 = not logged in -> ignore quietly
      if (err?.response?.status !== 401) {
        console.error("Failed to load theme", err);
      }
    }
  };

  // Initial hydrate from backend (if session is already valid)
  useEffect(() => {
    void reloadThemeFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Set data-theme attr */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeName);
  }, [themeName]);

  /** Apply/remove CSS variables */
  useEffect(() => {
    const root = document.documentElement;

    const apply = (vars: CustomTheme | null) => {
      // 1. Primary area tokens
      (Object.keys(cssVarMap) as (keyof CustomTheme)[]).forEach((k) => {
        const css = cssVarMap[k];
        if (vars) root.style.setProperty(css, vars[k]);
        else root.style.removeProperty(css);
      });

      // 2. Legacy aliases (keep until full migration)
      if (vars) {
        root.style.setProperty("--bg", vars.contentBg);
        root.style.setProperty("--text", vars.contentText);
        root.style.setProperty("--muted", "#6B7280");

        root.style.setProperty("--sidebar-bg", vars.sidebarBg);
        root.style.setProperty("--sidebar-text", vars.sidebarText);
        root.style.setProperty("--sidebar-edge", vars.borderSoft);

        root.style.setProperty("--surface", vars.cardBg);
        root.style.setProperty("--surface-muted", vars.sidebarControlBg);

        root.style.setProperty("--hairline", vars.borderSoft);

        root.style.setProperty("--doc-paper-bg", vars.docBg);
        root.style.setProperty("--doc-paper-text", vars.docText);
      } else {
        [
          "--bg",
          "--text",
          "--muted",
          "--sidebar-edge",
          "--surface",
          "--surface-muted",
          "--hairline",
          "--doc-paper-bg",
          "--doc-paper-text",
        ].forEach((p) => root.style.removeProperty(p));
      }
    };

    if (themeName === "custom") apply(customTheme);
    else apply(null);
  }, [themeName, customTheme]);

  // --- Public API for SettingsModal etc. ---

  const saveTheme = () => {
    saveThemeToServer(themeName, customTheme);
    setSavedCustomTheme(customTheme);
  };

  const setThemeName = (t: ThemeName) => {
    setThemeNameState(t);
    // Auto-save mode switching
    saveThemeToServer(t, customTheme);
  };

  const updateCustomTheme = (patch: Partial<CustomTheme>) => {
    setCustomTheme((prev) => {
      const merged = { ...prev, ...patch };
      // No auto-save for custom theme tweaks; user must click Save
      return merged;
    });
  };

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(customTheme) !== JSON.stringify(savedCustomTheme);
  }, [customTheme, savedCustomTheme]);

  const value = useMemo(
    () => ({
      themeName,
      setThemeName,
      customTheme,
      updateCustomTheme,
      reloadThemeFromServer,
      saveTheme,
      hasUnsavedChanges,
    }),
    [themeName, customTheme, savedCustomTheme, hasUnsavedChanges]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
