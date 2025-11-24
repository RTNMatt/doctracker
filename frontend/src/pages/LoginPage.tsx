import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔒 Force a base light theme while on the login page
  useEffect(() => {
    const root = document.documentElement;

    const prevThemeAttr = root.getAttribute("data-theme");
    const prevContentBg = root.style.getPropertyValue("--content-bg");
    const prevSidebarText = root.style.getPropertyValue("--sidebar-text");
    const prevSidebarEdge = root.style.getPropertyValue("--sidebar-edge");
    const prevMuted = root.style.getPropertyValue("--muted");
    const prevBrand = root.style.getPropertyValue("--brand");

    root.setAttribute("data-theme", "login-light");
    root.style.setProperty("--content-bg", "#f7f8fa");
    root.style.setProperty("--sidebar-text", "#0f172a");
    root.style.setProperty("--sidebar-edge", "#e6e8eb");
    root.style.setProperty("--muted", "#6b7280");
    root.style.setProperty("--brand", "#3a7bfa");

    return () => {
      if (prevThemeAttr !== null) {
        root.setAttribute("data-theme", prevThemeAttr);
      } else {
        root.removeAttribute("data-theme");
      }

      if (prevContentBg) {
        root.style.setProperty("--content-bg", prevContentBg);
      } else {
        root.style.removeProperty("--content-bg");
      }

      if (prevSidebarText) {
        root.style.setProperty("--sidebar-text", prevSidebarText);
      } else {
        root.style.removeProperty("--sidebar-text");
      }

      if (prevSidebarEdge) {
        root.style.setProperty("--sidebar-edge", prevSidebarEdge);
      } else {
        root.style.removeProperty("--sidebar-edge");
      }

      if (prevMuted) {
        root.style.setProperty("--muted", prevMuted);
      } else {
        root.style.removeProperty("--muted");
      }

      if (prevBrand) {
        root.style.setProperty("--brand", prevBrand);
      } else {
        root.style.removeProperty("--brand");
      }
    };
  }, []);

  // If already authenticated, bounce to next
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username, password);
      navigate(next, { replace: true });
    } catch {
      setError("Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-dot" />
          <h1 className="login-title">Sign in</h1>
          <p className="login-subtitle">Access your Knowledge Stack</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={onSubmit} className="login-form">
          <label className="login-label">
            Username
            <input
              className="login-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="login-label">
            Password
            <input
              className="login-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="login-button"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <input type="hidden" name="next" value={next} />
        </form>
      </div>
    </div>
  );
}
