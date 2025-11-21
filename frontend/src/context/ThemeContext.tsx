// src/context/ThemeContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeName = "light" | "dark" | "custom";

export type CustomTheme = {
  sidebarBg: string;
  sidebarText: string;
  mainBg: string;
  surface: string;
  hairline: string;
  docPaperBg: string;
  docPaperText: string;
  brand: string;
};

type ThemeContextValue = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  customTheme: CustomTheme;
  updateCustomTheme: (patch: Partial<CustomTheme>) => void;
};

const defaultCustomTheme: CustomTheme = {
  // match your current light theme defaults from index.css
  sidebarBg: "#EEF3FF",
  sidebarText: "#1F2937",
  mainBg: "#FAFCFF",
  surface: "#FFFFFF",
  hairline: "#E5ECF6",
  docPaperBg: "#FFFFFF",
  docPaperText: "#0B1220",
  brand: "#3A7BFA",
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const cssVarMap: Record<keyof CustomTheme, string> = {
  sidebarBg: "--sidebar-bg",
  sidebarText: "--sidebar-text",
  mainBg: "--bg",
  surface: "--surface",
  hairline: "--hairline",
  docPaperBg: "--doc-paper-bg",
  docPaperText: "--doc-paper-text",
  brand: "--brand",
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeName, setThemeName] = useState<ThemeName>("light");
  const [customTheme, setCustomTheme] = useState<CustomTheme>(defaultCustomTheme);

  // Apply data-theme attribute
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", themeName);
  }, [themeName]);

  // Apply / clear CSS variables for custom theme
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const applyVars = (vars: CustomTheme | null) => {
      (Object.keys(cssVarMap) as (keyof CustomTheme)[]).forEach((key) => {
        const cssName = cssVarMap[key];
        if (vars) {
          root.style.setProperty(cssName, vars[key]);
        } else {
          root.style.removeProperty(cssName);
        }
      });
    };

    if (themeName === "custom") {
      applyVars(customTheme);
    } else {
      applyVars(null);
    }
  }, [themeName, customTheme]);

  const updateCustomTheme = (patch: Partial<CustomTheme>) => {
    setCustomTheme((prev) => ({ ...prev, ...patch }));
  };

  const value: ThemeContextValue = useMemo(
    () => ({
      themeName,
      setThemeName,
      customTheme,
      updateCustomTheme,
    }),
    [themeName, customTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
};
