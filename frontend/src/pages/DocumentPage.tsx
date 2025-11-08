import { useParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";
import './DocumentPage.css';

type RawTag = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  // Optional enhanced fields if backend is updated:
  target_kind?: "department" | "collection" | "document" | "external" | "none";
  target_value?: { slug?: string; id?: number; url?: string };
  // Legacy link fields (your current backend already has these):
  link_document?: number | null;
  link_url?: string | null;
  // If you later add these, they'll be picked up automatically:
  link_department?: number | null;
  link_collection?: number | null;
};

type TagKind = "department" | "collection" | "document" | "external" | "none";
type NormalizedTag = RawTag & { target_kind: TagKind; target_value: { slug?: string; id?: number; url?: string } };

function normalizeTag(t: RawTag): NormalizedTag {
  if (t.target_kind && t.target_value) return t as NormalizedTag; // enhanced API path
  if (t.link_department) return { ...t, target_kind: "department", target_value: { slug: t.slug } };
  if (t.link_collection) return { ...t, target_kind: "collection", target_value: { slug: t.slug } };
  if (t.link_document)   return { ...t, target_kind: "document",   target_value: { id: t.link_document } };
  if (t.link_url)        return { ...t, target_kind: "external",   target_value: { url: t.link_url ?? undefined } };
  return { ...t, target_kind: "none", target_value: {} };
}

function groupTags(raw: RawTag[] = []) {
  const tags = raw.map(normalizeTag);
  const deptsOrCols: NormalizedTag[] = [];
  const docLinks: NormalizedTag[] = [];
  const externals: NormalizedTag[] = [];
  for (const t of tags) {
    if (t.target_kind === "department" || t.target_kind === "collection") deptsOrCols.push(t);
    else if (t.target_kind === "document") docLinks.push(t);
    else if (t.target_kind === "external") externals.push(t);
  }
  return { deptsOrCols, docLinks, externals };
}

function openTag(t: NormalizedTag) {
  const k = t.target_kind;
  const v = t.target_value || {};
  let url = "";
  if (k === "department" && v.slug)          url = `/departments/${v.slug}`;
  else if (k === "collection" && v.slug)     url = `/collections/${v.slug}`;
  else if (k === "document" && typeof v.id === "number") url = `/documents/${v.id}`;
  else if (k === "external" && v.url)        url = v.url;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

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

  const grouped = useMemo(() => groupTags(doc?.tags), [doc?.tags]);

  if (loading) return <p>Loading...</p>;
  if (err) return <p style={{color: "red"}}>{err}</p>;
  if (!doc) return null;

  return (
    <>
      <h1 className="doc-title">{doc.title}</h1>

      {/* TAG BAR (new) */}
      {(grouped.deptsOrCols.length || grouped.docLinks.length || grouped.externals.length) ? (
        <div className="doc-tagbar">
          {!!grouped.deptsOrCols.length && (
            <div className="tag-group">
              <div className="tag-group-label">Related Areas</div>
              <div className="tag-chips">
                {grouped.deptsOrCols.map((t) => (
                  <button
                    key={t.id}
                    className={`tag-chip ${t.target_kind === "department" ? "is-dept" : "is-col"}`}
                    onClick={() => openTag(t)}
                    title={t.description || t.name}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!!grouped.docLinks.length && (
            <div className="tag-group">
              <div className="tag-group-label">Related Docs</div>
              <div className="tag-chips">
                {grouped.docLinks.map((t) => (
                  <button
                    key={t.id}
                    className="tag-chip is-doc"
                    onClick={() => openTag(t)}
                    title={t.description || t.name}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!!grouped.externals.length && (
            <div className="tag-group">
              <div className="tag-group-label">External</div>
              <div className="tag-chips">
                {grouped.externals.map((t) => (
                  <button
                    key={t.id}
                    className="tag-chip is-ext"
                    onClick={() => openTag(t)}
                    title={t.description || t.name}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

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
