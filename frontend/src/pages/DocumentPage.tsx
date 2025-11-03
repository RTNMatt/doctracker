import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function DocumentPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/documents/${id}/`);
        setDoc(res.data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load document");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (err) return <p style={{color: "red"}}>{err}</p>;
  if (!doc) return null;

  return (
    <>
        <h1>{doc.title}</h1>
        {doc.sections?.map((s: any) => (
            <section key={s.id} style={{marginBlock: 16}}>
                <h3>{s.header}</h3>
                <pre style={{whiteSpace: "pre-wrap"}}>{s.body_md}</pre>
            </section>
        ))}
        {!!doc.links?.length && (
            <>
              <h3>Links</h3>
              <ul>
                  {doc.links.map((l:any) => (
                      <li key={l.id}>
                          <a href={l.url} target="_blank" rel="noreferrer">{l.title}</a>
                          {l.note ? ` — ${l.note}` : ""}
                      </li>
                  ))}
              </ul>
            </>
        )}
    </>
  );
}