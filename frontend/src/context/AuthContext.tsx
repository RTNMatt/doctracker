import React, { createContext, useContext, useEffect, useState } from "react";
import { api, login as apiLogin, logout as apiLogout, me as apiMe } from "../lib/api";

type Org = { id: number | null; slug: string | null } | null;
type User = { id: number; username: string } | null;

type AuthState = {
  user: User;
  org: Org;
  role: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [org, setOrg] = useState<Org>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Internal helper: attempt /auth/me; on 401 try one /auth/refresh then /auth/me again
  const hydrate = async () => {
    try {
      const { data } = await apiMe();
      setUser(data.user);
      setOrg(data.org);
      setRole(data.role || null);
      return true;
    } catch {
      try {
        // one-time silent refresh
        await api.post("/auth/refresh/", null, { withCredentials: true });
        const { data } = await apiMe();
        setUser(data.user);
        setOrg(data.org);
        setRole(data.role || null);
        return true;
      } catch {
        setUser(null);
        setOrg(null);
        setRole(null);
        return false;
      }
    }
  };

  const refreshMe = async () => {
    setLoading(true);
    try {
      await hydrate();
    } finally {
      // ALWAYS clear loading
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (username: string, password: string) => {
    await apiLogin(username, password);
    await refreshMe();
  };

  const signOut = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore logout errors
    }
    setUser(null);
    setOrg(null);
    setRole(null);
  };

  // Role helpers (admin/editor/viewer)
  const isAdmin = role === "admin";
  const isEditor = role === "editor" || role === "admin";
  const isViewer = role === "viewer";

  return (
    <AuthCtx.Provider
      value={{
        user,
        org,
        role,
        isAuthenticated: !!user,
        loading,
        isAdmin,
        isEditor,
        isViewer,
        signIn,
        signOut,
        refreshMe,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
