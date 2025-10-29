import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Document as Doc } from "../lib/types";

function normalizeArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export default function DocumentsList() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/documents/");
        setDocs(normalizeArray<Doc>(res.data));
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div style={{ padding: 24, color: "red" }}>{err}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>Documents</h2>
      {docs.length === 0 ? (
        <p>No documents found.</p>
      ) : (
        <ul>
          {docs.map((d) => (
            <li key={d.id}>
              <strong>{d.title}</strong>{" "}
              <a href={`/documents/${d.id}/requirements`}>requirements</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
