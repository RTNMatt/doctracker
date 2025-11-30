import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Tile } from "../lib/types";
import { usePathTree } from "../state/PathTree";
import { useAuth } from "../context/AuthContext";

// Reuse the department/profile card + carousel styling
import "./DepartmentPage.css";

type Tag = {
  id: number;
  name: string;
  slug: string;
  target_kind?: "department" | "collection" | "document" | "external" | "none";
};

type CollectionDetail = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  order?: number;

  documents?: number[];
  subcollections?: number[];

  everyone?: boolean;
  departments?: number[];

  tags?: Tag[];
};

type SimpleDocument = {
  id: number;
  title: string;
  slug: string;
  status?: string;
  collections?: number[];

  everyone?: boolean;
  departments?: number[];
};

type SimpleCollection = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;

  everyone?: boolean;
  departments?: number[];
};

type Snapshot = {
  name: string;
  description: string;
  docIds: number[];
  subIds: number[];
  everyone: boolean;
};

function formatStatus(status?: string | null): string {
  if (!status) return "";
  const lower = status.toLowerCase();
  if (lower === "draft") return "Draft";
  if (lower === "published") return "Published";
  if (lower === "archived") return "Archived";
  return status;
}

function isDocEligibleForCollection(
  doc: SimpleDocument,
  col: CollectionDetail | null
): boolean {
  if (!col) return true;

  const docEveryone = !!doc.everyone;
  const colEveryone = !!col.everyone;

  if (colEveryone) return true;
  if (docEveryone) return true;

  const docDepts = doc.departments ?? [];
  const colDepts = col.departments ?? [];

  if (colDepts.length === 0 || docDepts.length === 0) return true;

  return docDepts.some((id) => colDepts.includes(id));
}

function isSubcollectionEligibleForCollection(
  sub: SimpleCollection,
  col: CollectionDetail | null
): boolean {
  if (!col) return true;

  const subEveryone = !!sub.everyone;
  const colEveryone = !!col.everyone;

  if (colEveryone) return true;
  if (subEveryone) return true;

  const subDepts = sub.departments ?? [];
  const colDepts = col.departments ?? [];

  if (colDepts.length === 0 || subDepts.length === 0) return true;

  return subDepts.some((id) => colDepts.includes(id));
}

export default function CollectionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { enter } = usePathTree();
  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [allDocuments, setAllDocuments] = useState<SimpleDocument[]>([]);
  const [allCollections, setAllCollections] = useState<SimpleCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [workingName, setWorkingName] = useState("");
  const [workingDescription, setWorkingDescription] = useState("");
  const [workingDocIds, setWorkingDocIds] = useState<number[]>([]);
  const [workingSubcollectionIds, setWorkingSubcollectionIds] = useState<
    number[]
  >([]);
  const [initialSnapshot, setInitialSnapshot] = useState<Snapshot | null>(null);
  const [saving, setSaving] = useState(false);

  const [docSearch, setDocSearch] = useState("");
  const [colSearch, setColSearch] = useState("");

  const [workingEveryone, setWorkingEveryone] = useState<boolean>(true);
  const [areTagsOpen, setAreTagsOpen] = useState<boolean>(true);

  // ------- LOAD -------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug) return;

      setLoading(true);
      setErr(null);

      try {
        const [colRes, docsRes, colsRes] = await Promise.all([
          api.get(`/collections/${slug}/`),
          api.get("/documents/"),
          api.get("/collections/"),
        ]);

        if (cancelled) return;

        const col = colRes.data as CollectionDetail;
        setCollection(col);

        const docsData = Array.isArray(docsRes.data?.results)
          ? (docsRes.data.results as SimpleDocument[])
          : (docsRes.data as SimpleDocument[]);

        const colsData = Array.isArray(colsRes.data?.results)
          ? (colsRes.data.results as SimpleCollection[])
          : (colsRes.data as SimpleCollection[]);

        setAllDocuments(docsData);
        setAllCollections(colsData);

        const colId = col.id;

        const docIdsFromDocs = docsData
          .filter((d) => (d.collections ?? []).includes(colId))
          .map((d) => d.id);

        const subIdsFromCol = col.subcollections ?? [];

        setWorkingName(col.name);
        setWorkingDescription(col.description || "");
        setWorkingDocIds(docIdsFromDocs);
        setWorkingSubcollectionIds(subIdsFromCol);

        const everyone = !! col.everyone ?? true;
        setWorkingEveryone(everyone);

        setInitialSnapshot({
          name: col.name,
          description: col.description || "",
          docIds: [...docIdsFromDocs],
          subIds: [...subIdsFromCol],
          everyone,
        });
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setErr(e?.message ?? "Failed to load collection.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ------- PATH TRAIL -------
  useEffect(() => {
    if (collection) {
      enter({
        kind: "collection",
        name: collection.name,
        url: `/collections/${collection.slug}`,
      });
    }
  }, [collection, enter]);

  // ------- TILES (current membership) -------
  const docTiles: Tile[] = useMemo(() => {
    if (!collection) return [];
    const idSet = new Set(workingDocIds);
    return allDocuments
      .filter((d) => idSet.has(d.id))
      .map((d) => ({
        id: d.id,
        title: d.title,
        kind: "document" as const,
        documentId: d.id,
        description: formatStatus(d.status),
        icon: undefined,
      }));
  }, [collection, allDocuments, workingDocIds]);

  const subcollectionTiles: Tile[] = useMemo(() => {
    if (!collection) return [];
    const idSet = new Set(workingSubcollectionIds);
    return allCollections
      .filter((c) => idSet.has(c.id))
      .map((c) => ({
        id: c.id,
        title: c.name,
        kind: "collection" as const,
        collectionSlug: c.slug,
        description: c.description || "",
        icon: undefined,
      }));
  }, [collection, allCollections, workingSubcollectionIds]);

  // ------- AVAILABLE (right-hand side) -------
  const docsAvailableToAdd = useMemo(() => {
    const idSet = new Set(workingDocIds);
    const q = docSearch.trim().toLowerCase();

    return allDocuments
      .filter((d) => !idSet.has(d.id))
      .filter((d) => isDocEligibleForCollection(d, collection))
      .filter((d) => (!q ? true : d.title.toLowerCase().includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [allDocuments, workingDocIds, docSearch, collection]);

  const docTilesAvailable: Tile[] = useMemo(
    () =>
      docsAvailableToAdd.map((d) => ({
        id: d.id,
        title: d.title,
        kind: "document" as const,
        documentId: d.id,
        description: formatStatus(d.status),
        icon: undefined,
      })),
    [docsAvailableToAdd]
  );

  const subcollectionsAvailableToAdd = useMemo(() => {
    if (!collection) return [];
    const idSet = new Set(workingSubcollectionIds);
    const q = colSearch.trim().toLowerCase();

    return allCollections
      .filter((c) => c.id !== collection.id && !idSet.has(c.id))
      .filter((c) => isSubcollectionEligibleForCollection(c, collection))
      .filter((c) => (!q ? true : c.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCollections, workingSubcollectionIds, colSearch, collection]);

  const subcollectionTilesAvailable: Tile[] = useMemo(
    () =>
      subcollectionsAvailableToAdd.map((c) => ({
        id: c.id,
        title: c.name,
        kind: "collection" as const,
        collectionSlug: c.slug,
        description: c.description || "",
        icon: undefined,
      })),
    [subcollectionsAvailableToAdd]
  );

  // ------- UNSAVED CHANGES -------
  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) return false;

    const norm = (arr: number[]) => [...arr].slice().sort((a, b) => a - b);

    if (initialSnapshot.name !== workingName.trim()) return true;
    if ((initialSnapshot.description || "") !== (workingDescription || "")) {
      return true;
    }

    if (initialSnapshot.everyone !== workingEveryone) return true;

    const aDocs = norm(workingDocIds);
    const bDocs = norm(initialSnapshot.docIds);
    if (aDocs.length !== bDocs.length) return true;
    if (aDocs.some((v, i) => v !== bDocs[i])) return true;

    const aSubs = norm(workingSubcollectionIds);
    const bSubs = norm(initialSnapshot.subIds);
    if (aSubs.length !== bSubs.length) return true;
    if (aSubs.some((v, i) => v !== bSubs[i])) return true;

    return false;
  }, [
    initialSnapshot,
    workingName,
    workingDescription,
    workingDocIds,
    workingSubcollectionIds,
    workingEveryone,
  ]);

  // ------- EDIT HANDLERS -------
  const beginEdit = () => {
    if (!collection || !initialSnapshot) return;
    setWorkingName(initialSnapshot.name);
    setWorkingDescription(initialSnapshot.description || "");
    setWorkingDocIds([...initialSnapshot.docIds]);
    setWorkingSubcollectionIds([...initialSnapshot.subIds]);
    setWorkingEveryone(initialSnapshot.everyone);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    if (!initialSnapshot) {
      setEditMode(false);
      return;
    }
    setWorkingName(initialSnapshot.name);
    setWorkingDescription(initialSnapshot.description || "");
    setWorkingDocIds([...initialSnapshot.docIds]);
    setWorkingSubcollectionIds([...initialSnapshot.subIds]);
    setWorkingEveryone(initialSnapshot.everyone);
    setEditMode(false);
  };

  const handleToggleEdit = () => {
    if (!canEdit) return;

    if (!editMode) {
      beginEdit();
      return;
    }

    if (hasUnsavedChanges) {
      const ok = window.confirm(
        "You have unsaved changes to this collection. Discard them?"
      );
      if (!ok) return;
      handleCancelEdit();
      return;
    }

    setEditMode(false);
  };

  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!collection || !slug) return;

    const name = workingName.trim() || collection.name;

    try {
      setSaving(true);
      setErr(null);

      const payload: Partial<CollectionDetail> = {
        name,
        description: workingDescription,
        documents: workingDocIds,
        subcollections: workingSubcollectionIds,
        everyone: workingEveryone,
      };

      const res = await api.patch(`/collections/${slug}/`, payload);
      const updated = res.data as CollectionDetail;

      setCollection(updated);

      const snapshot: Snapshot = {
        name: updated.name,
        description: updated.description || "",
        docIds: [...workingDocIds],
        subIds: [...workingSubcollectionIds],
        everyone: updated.everyone ?? workingEveryone,
      };
      setInitialSnapshot(snapshot);
      setWorkingEveryone(snapshot.everyone);
      setEditMode(false);
    } catch (eAny: any) {
      console.error(eAny);
      setErr(eAny?.message ?? "Failed to save collection.");
    } finally {
      setSaving(false);
    }
  };

  // ------- TILE CLICK BEHAVIOR (view mode only) -------
  const handleTileClick = useCallback(
    (tile: Tile) => {
      if (editMode) {
        return;
      }
      if (tile.kind === "document" && tile.documentId != null) {
        navigate(`/documents/${tile.documentId}`);
      } else if (tile.kind === "collection" && tile.collectionSlug) {
        navigate(`/collections/${tile.collectionSlug}`);
      } else if (tile.kind === "department" && tile.departmentSlug) {
        navigate(`/departments/${tile.departmentSlug}`);
      } else if (tile.kind === "external" && tile.href) {
        window.open(tile.href, "_blank", "noopener");
      }
    },
    [navigate, editMode]
  );

  // ------- ADD/REMOVE HELPERS (edit-mode) -------
  const handleRemoveDocByTile = (tile: Tile) => {
    if (tile.kind !== "document") return;
    const id = typeof tile.id === "string" ? parseInt(tile.id, 10) : tile.id;
    if (Number.isNaN(id)) return;
    setWorkingDocIds((prev) => prev.filter((docId) => docId !== id));
  };

  const handleAddDocByTile = (tile: Tile) => {
    if (tile.kind !== "document") return;
    const id = typeof tile.id === "string" ? parseInt(tile.id, 10) : tile.id;
    if (Number.isNaN(id)) return;
    setWorkingDocIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleRemoveSubcollectionByTile = (tile: Tile) => {
    if (tile.kind !== "collection") return;
    const id = typeof tile.id === "string" ? parseInt(tile.id, 10) : tile.id;
    if (Number.isNaN(id)) return;
    setWorkingSubcollectionIds((prev) => prev.filter((colId) => colId !== id));
  };

  const handleAddSubcollectionByTile = (tile: Tile) => {
    if (tile.kind !== "collection") return;
    const id = typeof tile.id === "string" ? parseInt(tile.id, 10) : tile.id;
    if (Number.isNaN(id)) return;
    setWorkingSubcollectionIds((prev) =>
      prev.includes(id) ? prev : [...prev, id]
    );
  };

  // ------- LOADING / ERROR STATES -------
  if (loading && !collection) {
    return (
      <div className="page-wrapper">
        <div className="page-header">
          <h1>Collection</h1>
          <p className="page-subtitle">Loading…</p>
        </div>
      </div>
    );
  }

  if (err && !collection) {
    return (
      <div className="page-wrapper">
        <div className="page-header">
          <h1>Collection</h1>
          <p className="page-subtitle" style={{ color: "red" }}>
            {err}
          </p>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="page-wrapper">
        <div className="page-header">
          <h1>Collection</h1>
          <p className="page-subtitle">Collection not found.</p>
        </div>
      </div>
    );
  }

  // ------- RENDER HELPERS – VIEW MODE (dept-card look + navigation) -------

  const renderDocCardsView = () => {
    if (docTiles.length === 0) {
      return (
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--muted)",
            marginTop: 4,
          }}
        >
          No documents in this collection yet.
        </p>
      );
    }

    return (
      <div className="department-carousel-wrapper">
        <div className="dept-carousel">
          <div className="dept-card-grid">
            {docTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="dept-card"
                onClick={() => handleTileClick(tile)}
              >
                <div className="dept-card-title">{tile.title}</div>
                {tile.description && (
                  <div className="dept-card-body">{tile.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSubcollectionCardsView = () => {
    if (subcollectionTiles.length === 0) {
      return (
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--muted)",
            marginTop: 4,
          }}
        >
          No subcollections yet.
        </p>
      );
    }

    return (
      <div className="department-carousel-wrapper">
        <div className="dept-carousel">
          <div className="dept-card-grid">
            {subcollectionTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="dept-card"
                onClick={() => handleTileClick(tile)}
              >
                <div className="dept-card-title">{tile.title}</div>
                {tile.description && (
                  <div className="dept-card-body">{tile.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ------- RENDER HELPERS – EDIT MODE (dept-card look + add/remove) -------

  const renderDocCardsInCollection = () => {
    if (docTiles.length === 0) {
      return (
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--muted)",
            marginTop: 4,
          }}
        >
          No documents currently in this collection.
        </p>
      );
    }

    return (
      <div className="department-carousel-wrapper">
        <div className="dept-carousel">
          <div className="dept-card-grid">
            {docTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="dept-card"
                onClick={() => handleRemoveDocByTile(tile)}
              >
                <div className="dept-card-title">{tile.title}</div>
                {tile.description && (
                  <div className="dept-card-body">{tile.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDocCardsAvailable = () => {
    if (docTilesAvailable.length === 0) {
      return (
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--muted)",
            marginTop: 4,
          }}
        >
          No documents available to add.
        </p>
      );
    }

    return (
      <div className="department-carousel-wrapper">
        <div className="dept-carousel">
          <div className="dept-card-grid">
            {docTilesAvailable.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="dept-card"
                onClick={() => handleAddDocByTile(tile)}
              >
                <div className="dept-card-title">{tile.title}</div>
                {tile.description && (
                  <div className="dept-card-body">{tile.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSubcollectionCardsInCollection = () => {
    if (subcollectionTiles.length === 0) {
      return (
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--muted)",
            marginTop: 4,
          }}
        >
          No subcollections currently in this collection.
        </p>
      );
    }

    return (
      <div className="department-carousel-wrapper">
        <div className="dept-carousel">
          <div className="dept-card-grid">
            {subcollectionTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="dept-card"
                onClick={() => handleRemoveSubcollectionByTile(tile)}
              >
                <div className="dept-card-title">{tile.title}</div>
                {tile.description && (
                  <div className="dept-card-body">{tile.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSubcollectionCardsAvailable = () => {
    if (subcollectionTilesAvailable.length === 0) {
      return (
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--muted)",
            marginTop: 4,
          }}
        >
          No collections available to add.
        </p>
      );
    }

    return (
      <div className="department-carousel-wrapper">
        <div className="dept-carousel">
          <div className="dept-card-grid">
            {subcollectionTilesAvailable.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="dept-card"
                onClick={() => handleAddSubcollectionByTile(tile)}
              >
                <div className="dept-card-title">{tile.title}</div>
                {tile.description && (
                  <div className="dept-card-body">{tile.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ------- MAIN RENDER -------
  return (
    <div className="page-wrapper">
      <div className="page-header">
        {!editMode ? (
          <>
            <h1>{collection.name}</h1>
          </>
        ) : (
          <div>
            {/* Title edit – match document page style */}
            <input
              type="text"
              className="document-title-edit-input"
              value={workingName}
              onChange={(e) => setWorkingName(e.target.value)}
              maxLength={160}
              placeholder="Collection title"
            />

            {/* Description under the title */}
            <textarea
              className="collection-description-edit-input"
              value={workingDescription}
              onChange={(e) => setWorkingDescription(e.target.value)}
              rows={3}
              placeholder="Short description for this collection…"
            />

            <label className="doc-toggle-line" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={workingEveryone}
                onChange={(e) => setWorkingEveryone(e.target.checked)}
              />
              <span>Visible to everyone</span>
            </label>

            {err && <p style={{ color: "red", marginTop: 8 }}>{err}</p>}
          </div>
        )}
      </div>
      {!editMode && collection.description && (
        <section
          className="department-summary-card"
          style={{ maxWidth: 780, marginBottom: 16 }}
        >
          <div className="department-summary-body">
            <p>{collection.description}</p>
          </div>
        </section>
      )}

      {/* TAGS – left-aligned, no manage button for now */}
      {collection.tags && collection.tags.length > 0 && (
        <section
          className="doc-sidebar-panel"
          style={{ maxWidth: 780, margin: "0 0 16px 0" }}
        >
          {/* Header with Hide/Show toggle on the right – same pattern as document page */}
          <button
            type="button"
            className="doc-sidebar-toggle"
            onClick={() => setAreTagsOpen((open) => !open)}
          >
            <span className="doc-sidebar-heading">Tags</span>
            <span className="doc-sidebar-toggle-indicator">
              {areTagsOpen ? "Hide" : "Show"}
            </span>
          </button>

          {areTagsOpen && (
            <div className="doc-sidebar-body" style={{ borderTop: "none" }}>
              <div className="doc-tagbar">
                <div className="tag-group">
                  <div className="tag-group-label">Collection tags</div>
                  <div className="tag-chips">
                    {collection.tags.map((t) => {
                      const kindClass =
                        t.target_kind === "department"
                          ? "is-dept"
                          : t.target_kind === "collection"
                          ? "is-col"
                          : t.target_kind === "external"
                          ? "is-ext"
                          : "is-doc";

                      return (
                        <span
                          key={t.id}
                          className={`tag-chip ${kindClass}`}
                          style={{ cursor: "default" }}
                        >
                          {t.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom-right manage button – brand color, ready to wire to a modal later */}
          {editMode && canEdit && (
            <div
              className="doc-sidebar-panel-actions"
              style={{ justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="ks-btn-primary"
                disabled
                title="Collection tags are edited on document pages for now."
              >
                Manage tags
              </button>
            </div>
          )}
        </section>
      )}

      {/* DOCUMENTS */}
      {(docTiles.length > 0 || (editMode && canEdit)) && (
        <>
          <h2 style={{ marginTop: 24 }}>Documents</h2>
          {!editMode ? (
            renderDocCardsView()
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "16px",
                alignItems: "flex-start",
                marginBottom: 24,
              }}
            >
              <div>
                <h3 className="doc-sidebar-heading">In this collection</h3>
                {renderDocCardsInCollection()}
              </div>

              <div>
                <h3 className="doc-sidebar-heading" style={{ marginBottom: 0 }}>
                  Available to add
                </h3>
                <input
                  type="search"
                  className="collections-tag-search"
                  placeholder="Search documents…"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  style={{ marginTop: 6, marginBottom: 8 }}
                />
                {renderDocCardsAvailable()}
              </div>
            </div>
          )}
        </>
      )}

      {/* SUBCOLLECTIONS */}
      {(subcollectionTiles.length > 0 || (editMode && canEdit)) && (
        <>
          <h2 style={{ marginTop: 24 }}>Subcollections</h2>
          {!editMode ? (
            renderSubcollectionCardsView()
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "16px",
                alignItems: "flex-start",
                marginBottom: 80,
              }}
            >
              <div>
                <h3 className="doc-sidebar-heading">In this collection</h3>
                {renderSubcollectionCardsInCollection()}
              </div>

              <div>
                <h3 className="doc-sidebar-heading" style={{ marginBottom: 0 }}>
                  Available to add
                </h3>
                <input
                  type="search"
                  className="collections-tag-search"
                  placeholder="Search collections…"
                  value={colSearch}
                  onChange={(e) => setColSearch(e.target.value)}
                  style={{ marginTop: 6, marginBottom: 8 }}
                />
                {renderSubcollectionCardsAvailable()}
              </div>
            </div>
          )}
        </>
      )}

      {/* FOOTER */}
      <footer className="document-footer">
        <div className="document-footer-meta">
          {editMode && canEdit && hasUnsavedChanges && (
            <span className="doc-unsaved-pill">Unsaved changes</span>
          )}
        </div>

        <div className="document-footer-center" />

        <div className="document-footer-actions">
          {canEdit && (
            <>
              {editMode && (
                <button
                  type="button"
                  className="document-save-btn ks-btn-primary"
                  onClick={(e) => handleSave(e as any)}
                  disabled={!hasUnsavedChanges || saving}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              )}
              <button
                type="button"
                className="document-edit-toggle ks-btn-secondary"
                onClick={handleToggleEdit}
              >
                {editMode ? "Done editing" : "Edit collection"}
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
