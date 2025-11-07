// src/pages/SearchResultsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import TilesGrid from "../components/TilesGrid";
import type { Tile } from "../lib/types";
import { api } from "../lib/api";

type DocItem = { kind: "document"; id: number; title: string; snippet?: string };
type ColItem = { kind: "collection"; slug: string; title: string; snippet?: string };
type DeptItem = { kind: "department"; slug: string; title: string; snippet?: string };
type TagItem = { kind: "tag"; id: number; slug: string; title: string; snippet?: string };
type SearchItem = DocItem | ColItem | DeptItem | TagItem;

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = (params.get("q") || "").trim();
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!q) {
      setLoading(false);
      setResults([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/search/?q=${encodeURIComponent(q)}`);
        setResults(res.data.results ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Search failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [q]);

  const { docTiles, colTiles, deptItems, tagItems } = useMemo(() => {
  const docs: Tile[] = [];
  const cols: Tile[] = [];
  const deps: DeptItem[] = [];   // <— specific type
  const tags: TagItem[] = [];    // <— specific type

  for (const r of results as SearchItem[]) {
    if (r.kind === "document") {
      docs.push({
        id: r.id,
        title: r.title,
        kind: "document",
        documentId: r.id,
        description: r.snippet || "",
      });
    } else if (r.kind === "collection") {
      cols.push({
        id: `col-${r.slug}` as any,
        title: r.title,
        kind: "collection",
        collectionSlug: r.slug,
        description: r.snippet || "",
      } as Tile);
    } else if (r.kind === "department") {
      deps.push(r);              // r is DeptItem here
    } else if (r.kind === "tag") {
      tags.push(r);              // r is TagItem here
    }
  }
  return { docTiles: docs, colTiles: cols, deptItems: deps, tagItems: tags };
}, [results]);

  function onClickTile(t: Tile) {
    switch (t.kind) {
      case "document":
        if (t.documentId != null) navigate(`/documents/${t.documentId}`);
        break;
      case "collection":
        if (t.collectionSlug) navigate(`/collections/${t.collectionSlug}`);
        break;
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Searching…</div>;
  if (err) return <div style={{ padding: 24, color: "red" }}>{err}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>Search results for “{q}”</h2>

      {colTiles.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Collections</h3>
          <TilesGrid tiles={colTiles} onClickTile={onClickTile} />
        </>
      )}

      {docTiles.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Documents</h3>
          <TilesGrid tiles={docTiles} onClickTile={onClickTile} />
        </>
      )}

      {deptItems.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Departments</h3>
          <ul>
            {deptItems.map((d) => (
              <li key={d.slug}>
                  <Link to={`/departments/${d.slug}`}>{d.title}</Link>
                  {d.snippet ? <small> — {d.snippet}</small> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {tagItems.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Tags</h3>
          <ul>
            {tagItems.map((t) => (
              <li key={t.slug}>
                <span>{t.title}</span>
                {t.snippet ? <small> — {t.snippet}</small> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {colTiles.length === 0 && docTiles.length === 0 && deptItems.length === 0 && tagItems.length === 0 && (
        <p>No results.</p>
      )}
    </div>
  );
}
