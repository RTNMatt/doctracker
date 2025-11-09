import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { usePathTree } from "../state/PathTree";

type Collection = {
  id: number;
  name: string;
  slug: string;
  description?: string;
};

export default function CollectionsListPage() {
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const { resetTo } = usePathTree();

  useEffect(() => {
    resetTo({ kind: "index", name: "Collections", url: "/collections" });
  }, [resetTo]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/collections/");
        setItems(res.data?.results ?? res.data ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load collections");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="content-section"><h1>Collections</h1><p>Loading…</p></div>;
  if (err) return <div className="content-section"><h1>Collections</h1><p style={{color:"red"}}>{err}</p></div>;

  return (
    <div className="content-section search-page">
      <h1 className="page-title">Collections</h1>
      {items.length === 0 ? (
        <p className="doc-hint">No collections yet.</p>
      ) : (
        <ul className="tiles">
          {items.map((c) => (
            <li key={c.id} className="tile">
              <button
                className="tile-link"
                onClick={() => navigate(`/collections/${c.slug}`)}
                aria-label={`Open ${c.name}`}
              >
                <div className="title-meta">
                  <h2 className="tile-title">{c.name}</h2>
                  {c.description ? <p className="tile-desc">{c.description}</p> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
