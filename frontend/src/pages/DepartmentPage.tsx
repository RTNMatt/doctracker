

import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function DepartmentPage() {
  const { slug } = useParams();
  const [docs, setDocs] = useState<any[]>([]);
  const [deptName, setDeptName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get(`/departments/?slug=${slug}`);
        setDeptName(d?.data?.results?.[0]?.name ?? slug);
        const res = await api.get(`/departments/${slug}/documents/`);
        setDocs(res.data.results ?? res.data ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load department");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;

  return (
    <>
      <h1>Department: {deptName}</h1>
      {docs.length ? (
        <ul>
          {docs.map((d) => (
            <li key={d.id}><Link to={`/documents/${d.id}`}>{d.title}</Link></li>
          ))}
        </ul>
      ) : <p>No documents in this department.</p>}
    </>
  );
}
