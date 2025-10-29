import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import type { RequirementsResponse } from "../lib/types";

export default function DocumentRequirements() {
  const { id } = useParams();
  const [data, setData] = useState<RequirementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<RequirementsResponse>(`/documents/${id}/requirements/`);
        setData(res.data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div style={{ padding: 24, color: "red" }}>{err}</div>;
  if (!data) return null;

  return (
    <div style={{ padding: 24 }}>
      <p><Link to="/documents">← Back</Link></p>
      <h2>{data.title}</h2>
      <h3>Auto Requirements</h3>
      {data.requirements.length === 0 ? (
        <p>No requirements found from tags.</p>
      ) : (
        <ul>
          {data.requirements.map((req, i) => (
            <li key={i} style={{ marginBottom: 16 }}>
              <strong>{req.title}</strong>
              <pre style={{ whiteSpace: "pre-wrap" }}>{req.content_md}</pre>
              {req.links?.length ? (
                <div>
                  <em>Links:</em>
                  <ul>
                    {req.links.map((l, j) => (
                      <li key={j}>
                        {l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.title}</a> : null}
                        {" "}
                        {l.document_id ? <span>(doc #{l.document_id})</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <small style={{ opacity: 0.7 }}>tag: {req.tag}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
