import "./Sidebar.css";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import PathTrail from "../components/PathTrail";
import { usePathTree } from "../state/PathTree";
import { useAuth } from "../context/AuthContext";
import SettingsModal from "../components/SettingsModal";


type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
};

export default function Sidebar() {
  const [q, setQ] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { resetTo } = usePathTree();

  // ⟵ added: real auth state from context
  const { isAuthenticated, user, signOut } = useAuth();
  const isSignedIn = isAuthenticated;
  const userName = isSignedIn ? (user?.username ?? "User") : "Guest";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  // ⟵ updated: minimal sign-in/out handlers using auth + router
  async function handleSignInOut() {
    if (isSignedIn) {
      await signOut();
      navigate("/login", { replace: true });
    } else {
      const next = encodeURIComponent(pathname);
      navigate(`/login?next=${next}`);
    }
  }

  function handleOpenSettings() {
    setIsSettingsOpen(true);
  }

  const nav: NavItem[] = [
    { to: "/", label: "Home", exact: true },
    { to: "/departments", label: "Departments" },
    { to: "/collections", label: "Collections" },
    { to: "/create", label: "Create content" },
  ];

  // Reset the path tree when clicking top-level destinations
  function handleNavClick(to: string) {
    if (to === "/") {
      resetTo(null); // clear the trail entirely on Home
    } else if (to === "/departments") {
      resetTo({ kind: "index", name: "Departments", url: "/departments" });
    } else if (to === "/collections") {
      resetTo({ kind: "index", name: "Collections", url: "/collections" });
    } else if (to === "/create") {
      resetTo({ kind: "index", name: "Create content", url: "/create" });
    }
  }

  return (
    <>
      <aside className="site-sidebar">
        <div className="sidebar-body">
          <div className="sidebar-logo">
            <img src="/logo-full.svg" alt="Knowledge Stack logo" />
          </div>

          {/* Search */}
          <form onSubmit={onSubmit} className="sidebar-search">
            <input
              type="search"
              placeholder="Search docs, departments, collections…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search"
            />
          </form>

          {/* Nav */}
          <nav className="sidebar-nav">
            <ul>
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      className={active ? "active" : ""}
                      to={item.to}
                      onClick={() => handleNavClick(item.to)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Path trail in a card */}
          <div className="pathtrail-card">
            <PathTrail />
          </div>
          <div className="sidebar-spacer" aria-hidden="true" />
        </div>

        {/* Bottom: profile + settings */}
        <div className="sidebar-foot">
          <button
            className="settings-btn"
            aria-label="Settings"
            title="Settings"
            onClick={handleOpenSettings}
          >
            <Settings className="icon-cog" />
          </button>

          <div className="user-chip" title={isSignedIn ? userName : "Not signed in"}>
            <Link to="/profile" className="avatar-link">
              <div className="avatar">{userName.slice(0, 1).toUpperCase()}</div>
            </Link>
            <div className="user-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <Link to="/profile" className="user-name" style={{ textDecoration: 'none', color: 'inherit' }}>{userName}</Link>
              <button className="link-button" onClick={handleSignInOut} style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                {isSignedIn ? "Sign out" : "Sign in"}
              </button>
            </div>
          </div>
        </div>
      </aside>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
