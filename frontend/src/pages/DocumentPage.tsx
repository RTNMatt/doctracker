import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import './DocumentPage.css';

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
        <h1 className="doc-title">{doc.title}</h1>
        {!!doc.links?.length && (
            <>
              <h3>Relevant Links</h3>
              <ul className="doc-links">
                  {doc.links.map((l:any) => (
                      <li key={l.id}>
                          <a href={l.url} target="_blank" rel="noreferrer">{l.title}</a>
                          {l.note ? ` — ${l.note}` : ""}
                      </li>
                  ))}
              </ul>
            </>
        )}
        {doc.sections?.map((s: any) => (
            <section className="doc-contents" key={s.id} style={{marginBlock: 16}}>
                <div className="doc-left">
                  <h3>{s.header}</h3>
                  <pre style={{whiteSpace: "pre-wrap"}}>{s.body_md}</pre>
                </div>
                <div className="doc-right">
                  {s.image ? (
                    <div style={{margin: "8px 0"}}>
                      <img className="doc-sec-img" src={s.image} alt={s.header || "section image"} />
                    </div>
                  ) : null}
                </div>
            </section>
        ))}
    </>
  );
}