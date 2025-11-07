import { useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import TilesGrid from "../components/TilesGrid";
import { api } from "../lib/api";
import type { Tile } from "../lib/types";

function docsToTiles(docs: any[]): Tile[] {
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    kind: "document",
    documentId: d.id,
    description: "",
    icon: undefined,
  })) as Tile[];
}

function collectionsToTiles(cols: any[]): Tile[] {
  return cols.map((c) => ({
    id: c.id,
    title: c.name,
    kind: "collection",
    collectionSlug: c.slug,
    description: c.description ?? "",
    icon: undefined,
  })) as Tile[];
}

export default function CollectionPage() {
  const { slug } = useParams();
  const [title, setTitle] = useState<string>("");
  const [desc, setDesc] = useState<string>("");
  const [docTiles, setDocTiles] = useState<Tile[]>([]);
  const [subcolTiles, setSubcolTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // meta
        const meta = await api.get(`/collections/${slug}/`);
        setTitle(meta.data.name ?? String(slug));
        setDesc(meta.data.description ?? "");

        // subcollections
        const subsRes = await api.get(`/collections/${slug}/subcollections/`);
        const subcols = Array.isArray(subsRes.data) ? subsRes.data : (subsRes.data.results ?? []);
        setSubcolTiles(collectionsToTiles(subcols));

        // documents
        const docsRes = await api.get(`/collections/${slug}/documents/`);
        const docs = Array.isArray(docsRes.data) ? docsRes.data : (docsRes.data.results ?? []);
        setDocTiles(docsToTiles(docs));
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load collection");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleTileClick = useCallback((t: Tile) => {
    switch (t.kind) {
      case "document":
        if (t.documentId != null) window.location.assign(`/documents/${t.documentId}`);
        break;
      case "collection":
        if (t.collectionSlug) window.location.assign(`/collections/${t.collectionSlug}`);
        break;
    }
  }, []);

  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;

  return (
    <>
      <h1>{title}</h1>
      {desc && <p className="collection-desc">{desc}</p>}

      {subcolTiles.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>Additional Collections</h2>
          <TilesGrid tiles={subcolTiles} onClickTile={handleTileClick} />
        </>
      )}

      {docTiles.length > 0 ? (
        <>
          <h2 style={{ marginTop: 24 }}>Documents</h2>
          <TilesGrid tiles={docTiles} onClickTile={handleTileClick} />
        </>
      ) : (
        <p>No documents in this collection.</p>
      )}
    </>
  );
}
