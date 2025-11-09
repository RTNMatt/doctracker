import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { usePathTree } from "../state/PathTree";

export default function DepartmentPage() {
  const { slug } = useParams();
  const { enter } = usePathTree();

  const [dept, setDept] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // Load department by slug (detail endpoint) + its documents
        const [deptRes, docsRes] = await Promise.all([
          api.get(`/departments/${slug}/`),
          api.get(`/departments/${slug}/documents/`),
        ]);

        if (!alive) return;
        setDept(deptRes.data || null);

        const docsData = Array.isArray(docsRes.data)
          ? docsRes.data
          : (docsRes.data.results ?? []);
        setDocs(docsData);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load department");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  // Enter this department into the sidebar path tree once we know it
  useEffect(() => {
    if (dept?.name && dept?.slug) {
      enter({ kind: "department", name: dept.name, url: `/departments/${dept.slug}` });
    }
  }, [dept, enter]);

  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;

  return (
    <>
      <h1>Department: {dept?.name ?? slug}</h1>

      {docs.length ? (
        <ul>
          {docs.map((d) => (
            <li key={d.id}>
              <Link to={`/documents/${d.id}`}>{d.title}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No documents in this department.</p>
      )}
    </>
  );
}
