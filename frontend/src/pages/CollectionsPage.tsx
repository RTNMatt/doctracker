


import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function CollectionPage() {
  const { slug } = useParams();
  const [title, setTitle] = useState<string>("");
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/collections/${slug}/`);
        setTitle(res.data.title ?? slug);
        setDocs(res.data.documents ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load collection");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;

  return (
    <>
      <h1>{title}</h1>
      {docs.length ? (
        <ul>
          {docs.map((d) => (
            <li key={d.id}><Link to={`/documents/${d.id}`}>{d.title}</Link></li>
          ))}
        </ul>
      ) : <p>No documents in this collection.</p>}
    </>
  );
}
