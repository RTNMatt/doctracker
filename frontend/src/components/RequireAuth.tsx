
import React, { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = { children: React.ReactNode };

export default function RequireAuth({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // safety: if loading takes too long, fail closed -> /login
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setTimedOut(false);
      return;
    }
    timerRef.current = window.setTimeout(() => setTimedOut(true), 2500);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [loading]);

  // while checking session
  if (loading && !timedOut) {
    return (
      <div style={{
        display: "grid", placeItems: "center", height: "60vh",
        color: "var(--muted, #6b7280)", fontSize: 14
      }}>
        Loading…
      </div>
    );
  }

  // after load or timeout: if unauthenticated -> login
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}

// Optional companion for /login
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user) {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";
    return <Navigate to={next} replace />;
  }
  return <>{children}</>;
}