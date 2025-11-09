import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type NodeKind = "department" | "collection" | "document" | "home" | "index";
export type PathNode = {
  kind: NodeKind;
  name: string;
  url: string; // router path like /departments/networks
};

type PathTreeContextType = {
  path: PathNode[];
  enter: (node: PathNode) => void;               // push or trim-to existing node, then push
  trimTo: (url: string) => void;                 // keep nodes up to url
  resetTo: (node: PathNode | null) => void;      // reset the stack (null clears it)
};

const PathTreeContext = createContext<PathTreeContextType | null>(null);
const STORAGE_KEY = "ks:path-tree";

function loadInitial(): PathNode[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export const PathTreeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [path, setPath] = useState<PathNode[]>(loadInitial);
  const save = useRef((p: PathNode[]) => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p)));

  useEffect(() => { save.current(path); }, [path]);

  const trimTo = useCallback((url: string) => {
    setPath(prev => {
      const idx = prev.findIndex(n => n.url === url);
      if (idx === -1) return prev;
      return prev.slice(0, idx + 1);
    });
  }, []);

  const enter = useCallback((node: PathNode) => {
    setPath(prev => {
      // if node already exists, trim to it, then (optionally) re-enter if url changed
      const idx = prev.findIndex(n => n.url === node.url);
      if (idx >= 0) return prev.slice(0, idx + 1); // clicking a prior node trims to it
      return [...prev, node];
    });
  }, []);

  const resetTo = useCallback((node: PathNode | null) => {
    setPath(node ? [node] : []);
  }, []);

  const value = useMemo(() => ({ path, enter, trimTo, resetTo }), [path, enter, trimTo, resetTo]);

  return <PathTreeContext.Provider value={value}>{children}</PathTreeContext.Provider>;
};

export function usePathTree() {
  const ctx = useContext(PathTreeContext);
  if (ctx) return ctx;

  // Fail-soft fallback (no-ops) so the app never hard-crashes
  return {
    path: [] as PathNode[],
    enter: () => {},
    trimTo: () => {},
    resetTo: () => {},
  };
}
