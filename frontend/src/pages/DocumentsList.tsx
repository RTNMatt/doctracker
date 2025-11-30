import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePathTree } from "../state/PathTree";

import "./DocumentsList.css";

type Tag = {
  id: number;
  name: string;
  slug: string;
  target_kind?: "department" | "collection" | "document" | "external" | "none";
  link_document?: number | null;
  link_department?: number | null;
  link_collection?: number | null;
  link_url?: string | null;
};

type DocumentListItem = {
  id: number;
  title: string;
  status: "draft" | "published" | "archived" | string;
  summary?: string | null;
  tags?: Tag[];
};

export default function DocumentsList() {
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "published" | "archived"
  >("all");
  const [sortOrder, setSortOrder] = useState<"title_asc" | "title_desc">(
    "title_asc"
  );

  const [tagSearch, setTagSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;
  const navigate = useNavigate();
  const { resetTo } = usePathTree();

  // PathTrail root node
  useEffect(() => {
    resetTo({ kind: "index", name: "Documents", url: "/documents" });
  }, [resetTo]);

  // Load documents
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await api.get("/documents/");
        const data = res.data;
        const items: DocumentListItem[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];

        if (!cancelled) {
          setDocs(items);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setErr(e?.message ?? "Failed to load documents.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Tag universe
  const availableTags = useMemo(() => {
    const map = new Map<number, Tag>();
    for (const d of docs) {
      for (const t of d.tags ?? []) {
        if (!map.has(t.id)) map.set(t.id, t);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [docs]);

  const normalizedTagSearch = tagSearch.trim().toLowerCase();
  const visibleTags = useMemo(
    () =>
      availableTags.filter((t) =>
        t.name.toLowerCase().includes(normalizedTagSearch)
      ),
    [availableTags, normalizedTagSearch]
  );

  const toggleTag = (id: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = docs.filter((d) => {
      if (q && !d.title.toLowerCase().includes(q)) return false;

      if (statusFilter !== "all" && d.status !== statusFilter) return false;

      if (selectedTagIds.length > 0) {
        const docTagIds = new Set((d.tags ?? []).map((t) => t.id));
        // AND logic: doc must have *all* selected tags
        const hasAll = selectedTagIds.every((id) => docTagIds.has(id));
        if (!hasAll) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();

      if (sortOrder === "title_asc") {
        return aTitle.localeCompare(bTitle);
      } else {
        return bTitle.localeCompare(aTitle);
      }
    });

    return sorted;
  }, [docs, search, statusFilter, selectedTagIds, sortOrder]);

  // --- Render ---

  if (loading) {
    return (
      <div className="page-wrapper documents-list-page">
        <div className="page-header documents-list-header">
          <h1>Documents</h1>
          <p className="page-subtitle">Loading documents…</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="page-wrapper documents-list-page">
        <div className="page-header documents-list-header">
          <h1>Documents</h1>
          <p className="page-subtitle documents-error">{err}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper documents-list-page">
      <div className="page-header documents-list-header">
        <div>
          <h1>Documents</h1>
          <p className="page-subtitle">
            Browse, search, and filter all documents in this workspace.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="ks-btn-primary"
            onClick={() => navigate("/create")}
          >
            + New document
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="docs-filters">
        <input
          type="search"
          className="docs-title-search"
          placeholder="Search titles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="docs-status-select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "all" | "draft" | "published" | "archived"
            )
          }
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <select
          className="docs-sort-select"
          value={sortOrder}
          onChange={(e) =>
            setSortOrder(e.target.value as "title_asc" | "title_desc")
          }
        >
          <option value="title_asc">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
        </select>
      </div>

      {/* Layout: tags column on the left, docs on the right */}
      <div className="docs-layout">
        {availableTags.length > 0 && (
          <aside className="docs-tag-column">
            <div className="docs-tag-filter">
              <div className="docs-tag-filter-label">
                Filter by tags (documents must have all selected tags):
              </div>

              <input
                type="search"
                className="docs-tag-search"
                placeholder="Search tags…"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
              />

              <button
                type="button"
                className={
                  "ks-btn-secondary docs-tag-clear-btn" +
                  (selectedTagIds.length === 0
                    ? " docs-tag-clear-btn--hidden"
                    : "")
                }
                onClick={() => setSelectedTagIds([])}
              >
                Clear tags
              </button>

              <div className="docs-tag-scroll">
                <div className="docs-tag-chips">
                  {visibleTags.length === 0 ? (
                    <span className="docs-tag-filter-empty">
                      No tags match this search.
                    </span>
                  ) : (
                    visibleTags.map((t) => {
                      const selected = selectedTagIds.includes(t.id);

                      const kindClass =
                        t.target_kind === "department"
                          ? "is-dept"
                          : t.target_kind === "collection"
                          ? "is-col"
                          : t.target_kind === "external"
                          ? "is-ext"
                          : "is-doc";

                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`tag-chip ${kindClass} docs-tag-chip-filter ${
                            selected
                              ? "docs-tag-chip--selected"
                              : "docs-tag-chip--unselected"
                          }`}
                          onClick={() => toggleTag(t.id)}
                        >
                          {t.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        <main className="docs-main-column">
          {filteredDocs.length === 0 ? (
            <p className="docs-empty">No documents match these filters.</p>
          ) : (
            <div className="docs-card-scroll">
              <div className="docs-card-grid">
                {filteredDocs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="dept-card docs-card"
                    onClick={() => navigate(`/documents/${d.id}`)}
                  >
                    <div className="dept-card-title">{d.title}</div>
                    {d.summary && (
                      <div className="dept-card-body">{d.summary}</div>
                    )}
                    {d.status && (
                      <div className="dept-card-meta">
                        <span className="dept-doc-status">
                          {String(d.status).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
