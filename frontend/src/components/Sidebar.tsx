
import "./Sidebar.css";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";


export default function Sidebar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  // Placeholder auth state; wire to your real auth when ready
  const isSignedIn = false; // swap with real state
  const userName = "Guest";

  function handleSignInOut() {
    if (isSignedIn) {
      // TODO: real sign-out
      console.log("Sign out clicked");
    } else {
      // TODO: real sign-in route/modal
      navigate("/login");
    }
  }

  function handleOpenSettings() {
    // TODO: navigate to /settings or open a modal
    navigate("/settings");
  }

  const nav = [
    { to: "/", label: "Home", exact: true },
    { to: "/documents", label: "Documents" },
    { to: "/collections/password-resets", label: "Example Collection" }, // tweak or remove
    { to: "/departments/password-resets", label: "Example Department" }, // tweak or remove
  ];

  return (
    <aside className="site-sidebar">
      <div className="sidebar-body">
        <div className="sidebar-logo">
          <img src="/logo-full.svg" alt="Knowledge Stack logo" />
        </div>
        {/* Search */}
        <form onSubmit={onSubmit} className="sidebar-search">
          <input
            type="search"
            placeholder="Search docs, tags, collections…"
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
                  <Link className={active ? "active" : ""} to={item.to}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Bottom: profile + settings */}
      <div className="sidebar-foot">
        <button className="settings-btn" aria-label="Settings" title="Settings">
          <Settings className="icon-cog" />
        </button>

        <div className="user-chip" title={isSignedIn ? userName : "Not signed in"}>
          <div className="avatar">{userName.slice(0, 1).toUpperCase()}</div>
          <div className="user-meta">
            <div className="user-name">{userName}</div>
            <button className="link-button" onClick={handleSignInOut}>
              {isSignedIn ? "Sign out" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
