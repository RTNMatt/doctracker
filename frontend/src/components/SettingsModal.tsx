// src/components/SettingsModal.tsx
import { useState, type ChangeEvent } from "react";
import "./KSModal.css";
import "./SettingsModal.css";
import { useTheme, type ThemeName, type CustomTheme } from "../context/ThemeContext";

type SettingsSection = "appearance" | "general" | "reading" | "navigation";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ColorKey = keyof CustomTheme;

type ColorControlProps = {
  label: string;
  description?: string;
  colorKey: ColorKey;
  value: string;
  onChange: (value: string) => void;
};

function ColorControl({
  label,
  description,
  value,
  onChange,
}: ColorControlProps) {
  const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    if (!v) {
      onChange(value);
      return;
    }
    onChange(v.startsWith("#") ? v : `#${v}`);
  };

  return (
    <div className="settings-color-row">
      <div className="settings-color-label">
        <div className="settings-color-title">{label}</div>
        {description && (
          <div className="settings-color-description">{description}</div>
        )}
      </div>
      <div className="settings-color-inputs">
        <input
          type="color"
          className="settings-color-swatch"
          value={value}
          onChange={handleColorChange}
          aria-label={label}
        />
        <input
          type="text"
          className="settings-color-text"
          value={value}
          onChange={handleTextChange}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function AppearanceSection() {
  const { themeName, setThemeName, customTheme, updateCustomTheme } = useTheme();

  const handleThemeSelect = (name: ThemeName) => {
    setThemeName(name);
  };

  const handleColorUpdate = (key: ColorKey, val: string) => {
    updateCustomTheme({ [key]: val });
  };

  const isCustom = themeName === "custom";

  return (
    <div className="settings-panel">
      <h2 className="settings-panel-title">Appearance</h2>
      <p className="settings-panel-intro">
        Choose how Knowledge Stack looks. Switch between light and dark, or
        fine-tune a custom theme for your organization.
      </p>

      {/* Theme selection */}
      <section className="settings-block">
        <h3 className="settings-block-title">Theme</h3>
        <div className="settings-theme-options">
          <button
            type="button"
            className={
              "settings-theme-pill" +
              (themeName === "light" ? " settings-theme-pill--active" : "")
            }
            onClick={() => handleThemeSelect("light")}
          >
            <span className="settings-theme-pill-label">Knowledge Stack</span>
            <span className="settings-theme-pill-caption">Light</span>
          </button>
          <button
            type="button"
            className={
              "settings-theme-pill" +
              (themeName === "dark" ? " settings-theme-pill--active" : "")
            }
            onClick={() => handleThemeSelect("dark")}
          >
            <span className="settings-theme-pill-label">Dark mode</span>
            <span className="settings-theme-pill-caption">
              Dim shell, dark docs
            </span>
          </button>
          <button
            type="button"
            className={
              "settings-theme-pill" +
              (themeName === "custom" ? " settings-theme-pill--active" : "")
            }
            onClick={() => handleThemeSelect("custom")}
          >
            <span className="settings-theme-pill-label">Custom</span>
            <span className="settings-theme-pill-caption">
              Tweak colors for your org
            </span>
          </button>
        </div>
      </section>

      {/* Custom colors */}
      <section className="settings-block">
        <h3 className="settings-block-title">Custom colors</h3>
        <p className="settings-block-caption">
          These colors are applied when the theme is set to{" "}
          <strong>Custom</strong>. Light and Dark use their own presets.
        </p>

        <div className="settings-color-grid">
          {/* Sidebar */}
          <div className="settings-color-group">
            <h4 className="settings-color-group-title">Sidebar</h4>
            <ColorControl
              label="Sidebar background"
              description="Left navigation column background."
              colorKey="sidebarBg"
              value={customTheme.sidebarBg}
              onChange={(val) => handleColorUpdate("sidebarBg", val)}
            />
            <ColorControl
              label="Sidebar text"
              description="Links and labels inside the sidebar."
              colorKey="sidebarText"
              value={customTheme.sidebarText}
              onChange={(val) => handleColorUpdate("sidebarText", val)}
            />
            <ColorControl
              label="Sidebar controls"
              description="Search bar and PathTree background."
              colorKey="sidebarControlBg"
              value={customTheme.sidebarControlBg}
              onChange={(val) => handleColorUpdate("sidebarControlBg", val)}
            />
            <ColorControl
              label="Sidebar control text"
              description="Search text and PathTree labels."
              colorKey="sidebarControlText"
              value={customTheme.sidebarControlText}
              onChange={(val) => handleColorUpdate("sidebarControlText", val)}
            />
          </div>

          {/* Content */}
          <div className="settings-color-group">
            <h4 className="settings-color-group-title">Main content</h4>
            <ColorControl
              label="Content background"
              description="Background behind documents and tiles."
              colorKey="contentBg"
              value={customTheme.contentBg}
              onChange={(val) => handleColorUpdate("contentBg", val)}
            />
            <ColorControl
              label="Content text"
              description="Default text color in main content areas."
              colorKey="contentText"
              value={customTheme.contentText}
              onChange={(val) => handleColorUpdate("contentText", val)}
            />
          </div>

          {/* Cards / tiles / tags */}
          <div className="settings-color-group">
            <h4 className="settings-color-group-title">Cards & tags</h4>
            <ColorControl
              label="Card background"
              description="Tile cards, tag chips, and settings cards."
              colorKey="cardBg"
              value={customTheme.cardBg}
              onChange={(val) => handleColorUpdate("cardBg", val)}
            />
            <ColorControl
              label="Card text"
              description="Text on cards, tiles, and tag chips."
              colorKey="cardText"
              value={customTheme.cardText}
              onChange={(val) => handleColorUpdate("cardText", val)}
            />
          </div>

          {/* Document */}
          <div className="settings-color-group">
            <h4 className="settings-color-group-title">Document</h4>
            <ColorControl
              label="Document background"
              description="The page behind document sections."
              colorKey="docBg"
              value={customTheme.docBg}
              onChange={(val) => handleColorUpdate("docBg", val)}
            />
            <ColorControl
              label="Document text"
              description="Default text color inside documents."
              colorKey="docText"
              value={customTheme.docText}
              onChange={(val) => handleColorUpdate("docText", val)}
            />
          </div>

          {/* Accent */}
          <div className="settings-color-group">
            <h4 className="settings-color-group-title">Accent</h4>
            <ColorControl
              label="Brand"
              description="Primary accent for buttons and highlights."
              colorKey="brand"
              value={customTheme.brand}
              onChange={(val) => handleColorUpdate("brand", val)}
            />
            <ColorControl
              label="Brand (hover/active)"
              description="Hover and active states."
              colorKey="brandStrong"
              value={customTheme.brandStrong}
              onChange={(val) => handleColorUpdate("brandStrong", val)}
            />
          </div>
        </div>

        <p className="settings-inline-hint">
          {isCustom ? (
            <>Custom colors are applied to this theme.</>
          ) : (
            <>
              Switch to <strong>Custom</strong> to see these colors applied.
            </>
          )}
        </p>
      </section>
    </div>
  );
}


function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="settings-panel">
      <h2 className="settings-panel-title">{title}</h2>
      <p className="settings-panel-intro">
        This area will hold more preferences later. For now, Appearance is the
        primary section.
      </p>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [section, setSection] = useState<SettingsSection>("appearance");

  if (!isOpen) return null;

  return (
    <div className="ks-modal-backdrop settings-modal-backdrop">
      <div className="ks-modal settings-modal">
        <div className="settings-modal-header">
          <h1 className="settings-modal-title">Settings</h1>
          <button
            type="button"
            className="ks-modal-close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="settings-modal-layout">
          {/* LEFT NAV */}
          <aside className="settings-nav">
            <button
              type="button"
              className={
                "settings-nav-item" +
                (section === "appearance" ? " settings-nav-item--active" : "")
              }
              onClick={() => setSection("appearance")}
            >
              <span className="settings-nav-label">Appearance</span>
              <span className="settings-nav-caption">
                Theme & color preferences
              </span>
            </button>

            <button
              type="button"
              className={
                "settings-nav-item" +
                (section === "general" ? " settings-nav-item--active" : "")
              }
              onClick={() => setSection("general")}
            >
              <span className="settings-nav-label">General</span>
              <span className="settings-nav-caption">Home page & basics</span>
            </button>

            <button
              type="button"
              className={
                "settings-nav-item" +
                (section === "reading" ? " settings-nav-item--active" : "")
              }
              onClick={() => setSection("reading")}
            >
              <span className="settings-nav-label">Documents & reading</span>
              <span className="settings-nav-caption">
                Font size, spacing (coming soon)
              </span>
            </button>

            <button
              type="button"
              className={
                "settings-nav-item" +
                (section === "navigation" ? " settings-nav-item--active" : "")
              }
              onClick={() => setSection("navigation")}
            >
              <span className="settings-nav-label">Navigation & lists</span>
              <span className="settings-nav-caption">
                Sorting and list display
              </span>
            </button>
          </aside>

          {/* RIGHT CONTENT */}
          <main className="settings-content">
            {section === "appearance" && <AppearanceSection />}
            {section === "general" && (
              <PlaceholderSection title="General" />
            )}
            {section === "reading" && (
              <PlaceholderSection title="Documents & reading" />
            )}
            {section === "navigation" && (
              <PlaceholderSection title="Navigation & lists" />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
