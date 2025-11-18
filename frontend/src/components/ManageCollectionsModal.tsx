// src/components/ManageCollectionsModal.tsx
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, listCollections, setDocumentCollections } from "../lib/api";
import "./KSModal.css";
import "./ManageCollectionsModal.css";

type SimpleCollection = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
};

type DocumentLike = {
  id: number;
  title: string;
  collections?: number[];
};

type ManageCollectionsModalProps = {
  doc: DocumentLike | null;
  isOpen: boolean;
  canEdit: boolean;
  onClose: () => void;
  onDocUpdated: (doc: any) => void;
};

type Mode = "select" | "create";

const ManageCollectionsModal: React.FC<ManageCollectionsModalProps> = ({
  doc,
  isOpen,
  canEdit,
  onClose,
  onDocUpdated,
}) => {
  const [mode, setMode] = useState<Mode>("select");

  const [allCollections, setAllCollections] = useState<SimpleCollection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
  const [initialCollectionIds, setInitialCollectionIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Load collections when opened
  useEffect(() => {
    if (!isOpen || !canEdit || !doc?.id) return;

    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await listCollections();
        if (cancelled) return;
        setAllCollections(res.data.results ?? res.data);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load collections");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, canEdit, doc?.id]);

  // Initialize selected + initial collections from doc
  useEffect(() => {
    if (!doc) {
      setSelectedCollectionIds([]);
      setInitialCollectionIds([]);
      return;
    }
    const ids = (doc.collections ?? []) as number[];
    setSelectedCollectionIds(ids);
    setInitialCollectionIds(ids);
  }, [doc?.id]); // re-init when doc id changes

  const filteredCollections = useMemo(() => {
    const q = search.trim().toLowerCase();

    // Start with only collections that are NOT currently selected
    let base = allCollections.filter(
      (c) => !selectedCollectionIds.includes(c.id)
    );

    if (q) {
      base = base.filter((c) => c.name.toLowerCase().includes(q));
    }

    return base;
  }, [allCollections, selectedCollectionIds, search]);

  const toggleCollection = (id: number) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const normalizeIds = (ids: number[]) => [...ids].sort((a, b) => a - b);
  const arraysEqual = (a: number[], b: number[]) => {
    const na = normalizeIds(a);
    const nb = normalizeIds(b);
    if (na.length !== nb.length) return false;
    return na.every((v, i) => v === nb[i]);
  };

  const hasUnsavedChanges = useMemo(
    () => !arraysEqual(selectedCollectionIds, initialCollectionIds),
    [selectedCollectionIds, initialCollectionIds]
  );

  const handleSaveCollections = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;

    try {
      setSaving(true);
      setError(null);
      const res = await setDocumentCollections(doc.id, selectedCollectionIds);
      onDocUpdated(res.data);

      // Mark current selection as "clean"
      setInitialCollectionIds(selectedCollectionIds);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save collections");
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToCreate = () => {
    setMode("create");
    setError(null);
  };

  const handleBackToSelect = () => {
    setMode("select");
    setError(null);
  };

  const slugify = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleCreateCollection = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;

    const name = newName.trim();
    if (!name) {
      setError("Name is required");
      return;
    }

    const slug = (newSlug.trim() || slugify(name)) || undefined;

    try {
      setCreating(true);
      setError(null);

      const payload: any = { name };
      if (slug) payload.slug = slug;
      if (newDescription.trim()) payload.description = newDescription.trim();

      const res = await api.post("/collections/", payload);
      const created: SimpleCollection = res.data;

      // Add to list + mark as selected for this doc
      setAllCollections((prev) => [...prev, created]);
      setSelectedCollectionIds((prev) =>
        prev.includes(created.id) ? prev : [...prev, created.id]
      );

      // Sync to backend so the document is added to this collection
      try {
        const docRes = await setDocumentCollections(doc.id, [
          ...selectedCollectionIds,
          created.id,
        ]);
        onDocUpdated(docRes.data);
        // Now "clean" state includes the new collection as well
        setInitialCollectionIds((prev) =>
          prev.includes(created.id) ? prev : [...prev, created.id]
        );
      } catch (e: any) {
        setError(
          e?.message ?? "Collection created, but failed to attach to document"
        );
      }

      setNewName("");
      setNewSlug("");
      setNewDescription("");
      setMode("select");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create collection");
    } finally {
      setCreating(false);
    }
  };

  const handleRequestClose = () => {
    if (canEdit && hasUnsavedChanges) {
      const shouldClose = window.confirm(
        "You have unsaved collection changes. Close without saving?"
      );
      if (!shouldClose) return;
    }
    onClose();
  };

  if (!isOpen || !doc || !canEdit) return null;

  return (
    <div className="ks-modal-backdrop">
      <div className="ks-modal manage-collections-modal">
        <header className="ks-modal-header">
          <h3 className="ks-modal-title">
            Manage collections for “{doc.title}”
          </h3>
          <button
            type="button"
            className="ks-modal-close-btn"
            onClick={handleRequestClose}
          >
            Close
          </button>
        </header>

        {error && <p className="ks-modal-error">{error}</p>}

        <div className="manage-collections-mode-toggle">
          <button
            type="button"
            className={
              "manage-collections-mode-btn" +
              (mode === "select" ? " is-active" : "")
            }
            onClick={handleBackToSelect}
          >
            Select existing
          </button>
          <button
            type="button"
            className={
              "manage-collections-mode-btn" +
              (mode === "create" ? " is-active" : "")
            }
            onClick={handleSwitchToCreate}
          >
            Create new
          </button>
        </div>

        {mode === "select" && (
          <div className="manage-collections-body">
            <section className="manage-collections-section">
              <h4>Current collections</h4>
              <p className="manage-collections-help">
                These are the collections this document currently belongs to.
                Click a pill to remove it.
              </p>

              {selectedCollectionIds.length === 0 && (
                <p className="manage-collections-muted">
                  This document is not part of any collections yet.
                </p>
              )}

              {selectedCollectionIds.length > 0 && (
                <div className="manage-collections-chips-row">
                  {allCollections
                    .filter((c) => selectedCollectionIds.includes(c.id))
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="tag-chip tag-chip--selected"
                        onClick={() => toggleCollection(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              )}
            </section>

            <section className="manage-collections-section">
              <h4>Available collections</h4>
              <p className="manage-collections-help">
                Attach this document to one or more existing collections.
              </p>

              <input
                type="text"
                className="ks-modal-search-input"
                placeholder="Search collections…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {loading && <p>Loading collections…</p>}

              {!loading && allCollections.length === 0 && (
                <p className="manage-collections-muted">
                  No collections exist yet. Try creating one on the Collections
                  page or using the “Create new” tab above.
                </p>
              )}

              {!loading && filteredCollections.length > 0 && (
                <div className="ks-modal-chips-row">
                  {filteredCollections.map((c) => {
                    const selected = selectedCollectionIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={
                          "tag-chip " + (selected ? "tag-chip--selected" : "")
                        }
                        onClick={() => toggleCollection(c.id)}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {!loading &&
                allCollections.length > 0 &&
                filteredCollections.length === 0 && (
                  <p className="manage-collections-muted">
                    No collections match that search.
                  </p>
                )}
            </section>

            <footer className="manage-collections-footer">
              <button
                type="button"
                className="ks-btn-primary"
                onClick={handleSaveCollections}
                disabled={!hasUnsavedChanges || saving || loading}
              >
                {saving ? "Saving…" : "Save collections"}
              </button>
            </footer>
          </div>
        )}

        {mode === "create" && (
          <div className="manage-collections-body">
            <section className="manage-collections-section">
              <h4>Create a new collection</h4>
              <p className="manage-collections-help">
                New collections are org-scoped. After creation, this document
                will be added to the collection automatically.
              </p>

              <form
                onSubmit={handleCreateCollection}
                className="manage-collections-form"
              >
                <label className="manage-collections-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </label>

                <label className="manage-collections-field">
                  <span>Slug (optional)</span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="auto-generated from name if left blank"
                  />
                </label>

                <label className="manage-collections-field">
                  <span>Description (optional)</span>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </label>

                <footer className="manage-collections-footer">
                  <button
                    type="button"
                    className="manage-collections-secondary-btn"
                    onClick={handleBackToSelect}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="manage-collections-primary-btn"
                    disabled={creating}
                  >
                    {creating ? "Creating…" : "Create & attach"}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCollectionsModal;
