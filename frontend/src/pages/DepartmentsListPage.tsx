import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { usePathTree } from "../state/PathTree";

type Department = {
  id: number;
  name: string;
  slug: string;
  description?: string;
};

export default function DepartmentsListPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const { resetTo } = usePathTree();

  useEffect(() => {
    resetTo({ kind: "index", name: "Departments", url: "/departments" });
  }, [resetTo]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/departments/");
        setItems(res.data?.results ?? res.data ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load departments");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="content-section"><h1>Departments</h1><p>Loading…</p></div>;
  if (err) return <div className="content-section"><h1>Departments</h1><p style={{color:"red"}}>{err}</p></div>;

  return (
    <div className="content-section search-page">
      <h1 className="page-title">Departments</h1>
      {items.length === 0 ? (
        <p className="doc-hint">No departments yet.</p>
      ) : (
        <ul className="tiles">
          {items.map((d) => (
            <li key={d.id} className="tile">
              <button
                className="tile-link"
                onClick={() => navigate(`/departments/${d.slug}`)}
                aria-label={`Open ${d.name}`}
              >
                <div className="title-meta">
                  <h2 className="tile-title">{d.name}</h2>
                  {d.description ? <p className="tile-desc">{d.description}</p> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
