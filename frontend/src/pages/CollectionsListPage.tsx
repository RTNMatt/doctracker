import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePathTree } from "../state/PathTree";

import "./CollectionsListPage.css";

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

type CollectionListItem = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  tags?: Tag[];
  document_count?: number; // optional, if backend exposes this
};

export default function CollectionsListPage() {
  const [collections, setCollections] = useState<CollectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"name_asc" | "name_desc">(
    "name_asc"
  );

  const [tagSearch, setTagSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;
  const navigate = useNavigate();
  const { resetTo } = usePathTree();

  // PathTrail root
  useEffect(() => {
    resetTo({ kind: "index", name: "Collections", url: "/collections" });
  }, [resetTo]);

  // Load collections
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await api.get("/collections/");
        const data = res.data;
        const items: CollectionListItem[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];

        if (!cancelled) {
          setCollections(items);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setErr(e?.message ?? "Failed to load collections.");
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

  // Tag universe derived from collections
  const availableTags = useMemo(() => {
    const map = new Map<number, Tag>();

    for (const c of collections) {
      for (const t of c.tags ?? []) {
        // Skip auto "collection" tags – we still keep them in the model
        // for documents, but don't surface them as filters on /collections.
        if (t.target_kind === "collection") {
          continue;
        }

        if (!map.has(t.id)) {
          map.set(t.id, t);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [collections]);

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

  const filteredCollections = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = collections.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;

      if (selectedTagIds.length > 0) {
        const colTagIds = new Set((c.tags ?? []).map((t) => t.id));
        // AND logic: collection must have *all* selected tags
        const hasAll = selectedTagIds.every((id) => colTagIds.has(id));
        if (!hasAll) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      if (sortOrder === "name_asc") {
        return aName.localeCompare(bName);
      } else {
        return bName.localeCompare(aName);
      }
    });

    return sorted;
  }, [collections, search, selectedTagIds, sortOrder]);

  // --- Render ---

  if (loading) {
    return (
      <div className="page-wrapper collections-list-page">
        <div className="page-header collections-list-header">
          <h1>Collections</h1>
          <p className="page-subtitle">Loading collections…</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="page-wrapper collections-list-page">
        <div className="page-header collections-list-header">
          <h1>Collections</h1>
          <p className="page-subtitle collections-error">{err}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper collections-list-page">
      <div className="page-header collections-list-header">
        <div>
          <h1>Collections</h1>
          <p className="page-subtitle">
            Browse, search, and filter all collections in this workspace.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="ks-btn-primary"
            onClick={() => navigate("/collections/new")}
          >
            + New collection
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="collections-filters">
        <input
          type="search"
          className="collections-title-search"
          placeholder="Search collection names…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="collections-sort-select"
          value={sortOrder}
          onChange={(e) =>
            setSortOrder(e.target.value as "name_asc" | "name_desc")
          }
        >
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </select>
      </div>

      {/* Layout: tags column on the left, collections on the right */}
      <div className="collections-layout">
        <aside className="collections-tag-column">
          <div className="collections-tag-filter">
            <div className="collections-tag-filter-label">
              Filter by tags (collections must have all selected tags):
            </div>

            <input
              type="search"
              className="collections-tag-search"
              placeholder="Search tags…"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
            />

            <button
              type="button"
              className={
                "ks-btn-secondary collections-tag-clear-btn" +
                (selectedTagIds.length === 0
                  ? " collections-tag-clear-btn--hidden"
                  : "")
              }
              onClick={() => setSelectedTagIds([])}
            >
              Clear tags
            </button>

            <div className="collections-tag-scroll">
              <div className="collections-tag-chips">
                {visibleTags.length === 0 ? (
                  <span className="collections-tag-filter-empty">
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
                        className={`tag-chip ${kindClass} collections-tag-chip-filter ${
                          selected
                            ? "collections-tag-chip--selected"
                            : "collections-tag-chip--unselected"
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

        <main className="collections-main-column">
          {filteredCollections.length === 0 ? (
            <p className="collections-empty">
              No collections match these filters.
            </p>
          ) : (
            <div className="collections-card-scroll">
              <div className="collections-card-grid">
                {filteredCollections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="dept-card collections-card"
                    onClick={() => navigate(`/collections/${c.slug}`)}
                  >
                    <div className="dept-card-title">{c.name}</div>
                    {c.description && (
                      <div className="dept-card-body">{c.description}</div>
                    )}
                    <div className="dept-card-meta">
                      {typeof c.document_count === "number" &&
                      c.document_count >= 0 ? (
                        <span className="collections-doc-count">
                          {c.document_count}{" "}
                          {c.document_count === 1 ? "document" : "documents"}
                        </span>
                      ) : null}
                    </div>
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
