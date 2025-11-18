// src/pages/DocumentPage.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import "./DocumentPage.css";
import { usePathTree } from "../state/PathTree";
import { useAuth } from "../context/AuthContext";
import ManageTagsModal from "../components/ManageTagsModal";
import ManageCollectionsModal from "../components/ManageCollectionsModal";

type RawTag = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  target_kind?: "department" | "collection" | "document" | "external" | "none";
  target_value?: { slug?: string; id?: number; url?: string };
  link_document?: number | null;
  link_url?: string | null;
  link_department?: number | null;
  link_collection?: number | null;
};

type TagKind = "department" | "collection" | "document" | "external" | "none";
type NormalizedTag = RawTag & {
  target_kind: TagKind;
  target_value: { slug?: string; id?: number; url?: string };
};

function normalizeTag(t: RawTag): NormalizedTag {
  if (t.target_kind && t.target_value) return t as NormalizedTag;
  if (t.link_department)
    return { ...t, target_kind: "department", target_value: { slug: t.slug } };
  if (t.link_collection)
    return { ...t, target_kind: "collection", target_value: { slug: t.slug } };
  if (t.link_document)
    return {
      ...t,
      target_kind: "document",
      target_value: { id: t.link_document },
    };
  if (t.link_url)
    return {
      ...t,
      target_kind: "external",
      target_value: { url: t.link_url ?? undefined },
    };
  return { ...t, target_kind: "none", target_value: {} };
}

function groupTags(raw: RawTag[] = []) {
  const tags = raw.map(normalizeTag);
  const deptsOrCols: NormalizedTag[] = [];
  const docLinks: NormalizedTag[] = [];
  const externals: NormalizedTag[] = [];

  for (const t of tags) {
    if (t.target_kind === "department" || t.target_kind === "collection") {
      deptsOrCols.push(t);
    } else if (t.target_kind === "document") {
      docLinks.push(t);
    } else if (t.target_kind === "external") {
      externals.push(t);
    }
  }

  return { deptsOrCols, docLinks, externals };
}

function openTag(t: NormalizedTag) {
  const k = t.target_kind;
  const v = t.target_value || {};
  let url = "";

  if (k === "department" && v.slug) url = `/departments/${v.slug}`;
  else if (k === "collection" && v.slug) url = `/collections/${v.slug}`;
  else if (k === "document" && typeof v.id === "number")
    url = `/documents/${v.id}`;
  else if (k === "external" && v.url) url = v.url;

  if (url) {
    const external = k === "external" || url.startsWith("http");
    window.open(
      url,
      external ? "_blank" : "_self",
      external ? "noopener,noreferrer" : undefined
    );
  }
}

export default function DocumentPage() {
  const { id } = useParams();
  const { enter } = usePathTree();
  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;

  const [doc, setDoc] = useState<any>(null);
  const [initialDocSnapshot, setInitialDocSnapshot] = useState<any | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);

  // sections
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editSectionHeader, setEditSectionHeader] = useState("");
  const [editSectionBody, setEditSectionBody] = useState("");
  const [editSectionImage, setEditSectionImage] = useState<File | null>(null);

  const [newSectionHeader, setNewSectionHeader] = useState("");
  const [newSectionBody, setNewSectionBody] = useState("");
  const [newSectionImage, setNewSectionImage] = useState<File | null>(null);

  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // links
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [editLinkTitle, setEditLinkTitle] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editLinkNote, setEditLinkNote] = useState("");

  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkNote, setNewLinkNote] = useState("");

  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // modals
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isCollectionsModalOpen, setIsCollectionsModalOpen] = useState(false);

  // ----- LOAD DOCUMENT -----
  const loadDoc = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/documents/${id}/`);
      const data = res.data;
      setDoc(data);

      // only set the initial snapshot the first time; later, Save document updates it
      if (!initialDocSnapshot) {
        setInitialDocSnapshot(data);
      }

      setErr(null);
      setDocError(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (doc?.id && doc?.title) {
      enter({ kind: "document", name: doc.title, url: `/documents/${doc.id}` });
    }
  }, [doc?.id, doc?.title, enter]);

  const grouped = useMemo(() => groupTags(doc?.tags), [doc?.tags]);

  // ----- DOC UNSAVED-CHANGES DETECTION -----
  const extractDocMeta = (d: any | null) => {
    if (!d) return null;
    return {
      title: d.title ?? "",
      status: d.status ?? "",
      everyone: !!d.everyone,
    };
  };

  const hasDocUnsavedChanges = useMemo(() => {
    if (!doc || !initialDocSnapshot) return false;
    const current = extractDocMeta(doc);
    const initial = extractDocMeta(initialDocSnapshot);
    try {
      return JSON.stringify(current) !== JSON.stringify(initial);
    } catch {
      return true;
    }
  }, [doc, initialDocSnapshot]);

  // Warn on full page unload (refresh, close tab, navigate URL) if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!editMode || !hasDocUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [editMode, hasDocUnsavedChanges]);

  const handleSaveDocument = async () => {
    if (!doc?.id) return;

    try {
      setDocSaving(true);
      setDocError(null);

      // Enforce: if everyone=false, doc must belong to at least one department.
      const deptCount = Array.isArray(doc.departments)
        ? doc.departments.length
        : 0;

      if (!doc.everyone && deptCount === 0) {
        setDocError(
          "When visibility is restricted, this document must belong to at least one department. Add a department tag first."
        );
        setDocSaving(false);
        return;
      }

      // For now we only PATCH top-level metadata.
      const payload: any = {
        title: doc.title,
        status: doc.status,
        everyone: doc.everyone,
      };

      const res = await api.patch(`/documents/${doc.id}/`, payload);
      setDoc(res.data);
      setInitialDocSnapshot(res.data); // new "clean" baseline
    } catch (e: any) {
      setDocError(e?.message ?? "Failed to save document");
    } finally {
      setDocSaving(false);
    }
  };

  // ----- SECTION EDITING -----
  const startEditSection = (s: any) => {
    setEditingSectionId(s.id);
    setEditSectionHeader(s.header || "");
    setEditSectionBody(s.body_md || "");
    setEditSectionImage(null);
    setSectionError(null);
  };

  const cancelEditSection = () => {
    setEditingSectionId(null);
    setEditSectionHeader("");
    setEditSectionBody("");
    setEditSectionImage(null);
    setSectionError(null);
  };

  const handleUpdateSection = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSectionId) return;

    try {
      setSectionSaving(true);
      setSectionError(null);
      const form = new FormData();
      form.append("header", editSectionHeader.trim() || "(Untitled section)");
      form.append("body_md", editSectionBody);
      if (editSectionImage) {
        form.append("image", editSectionImage);
      }

      await api.patch(`/sections/${editingSectionId}/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      cancelEditSection();
      await loadDoc();
    } catch (e: any) {
      setSectionError(e?.message ?? "Failed to update section");
    } finally {
      setSectionSaving(false);
    }
  };

  const handleCreateSection = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;
    if (!newSectionHeader.trim() && !newSectionBody.trim() && !newSectionImage)
      return;

    try {
      setSectionSaving(true);
      setSectionError(null);

      const form = new FormData();
      form.append("document", String(doc.id));
      form.append("header", newSectionHeader.trim() || "(Untitled section)");
      form.append("body_md", newSectionBody);
      if (newSectionImage) {
        form.append("image", newSectionImage);
      }

      await api.post("/sections/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setNewSectionHeader("");
      setNewSectionBody("");
      setNewSectionImage(null);
      await loadDoc();
    } catch (e: any) {
      setSectionError(e?.message ?? "Failed to save section");
    } finally {
      setSectionSaving(false);
    }
  };

  // ----- LINK EDITING -----
  const startEditLink = (l: any) => {
    setEditingLinkId(l.id);
    setEditLinkTitle(l.title || "");
    setEditLinkUrl(l.url || "");
    setEditLinkNote(l.note || "");
    setLinkError(null);
  };

  const cancelEditLink = () => {
    setEditingLinkId(null);
    setEditLinkTitle("");
    setEditLinkUrl("");
    setEditLinkNote("");
    setLinkError(null);
  };

  const handleUpdateLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingLinkId) return;

    try {
      setLinkSaving(true);
      setLinkError(null);
      await api.patch(`/links/${editingLinkId}/`, {
        title: editLinkTitle.trim() || editLinkUrl.trim() || "(Untitled link)",
        url: editLinkUrl,
        note: editLinkNote,
      });
      cancelEditLink();
      await loadDoc();
    } catch (e: any) {
      setLinkError(e?.message ?? "Failed to update link");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleCreateLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;
    if (!newLinkTitle.trim() && !newLinkUrl.trim()) return;

    try {
      setLinkSaving(true);
      setLinkError(null);
      await api.post("/links/", {
        document: doc.id,
        title: newLinkTitle.trim() || newLinkUrl.trim() || "(Untitled link)",
        url: newLinkUrl,
        note: newLinkNote,
      });
      setNewLinkTitle("");
      setNewLinkUrl("");
      setNewLinkNote("");
      await loadDoc();
    } catch (e: any) {
      setLinkError(e?.message ?? "Failed to save link");
    } finally {
      setLinkSaving(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>; // leaving this one simple
  if (!doc) return null;

  const collectionCount = Array.isArray(doc.collections)
    ? doc.collections.length
    : 0;

  return (
    <div className="document-page">
      <header className="document-header">
        <div className="document-header-main">
          <div>
            <h1 className="document-title">{doc.title}</h1>
            {doc.status && (
              <span className={`document-status document-status--${doc.status}`}>
                {doc.status}
              </span>
            )}
          </div>

          {canEdit && (
            <div className="document-header-actions">
              {editMode && (
                <button
                  type="button"
                  className="document-save-btn"
                  onClick={handleSaveDocument}
                  disabled={!hasDocUnsavedChanges || docSaving}
                >
                  {docSaving ? "Saving…" : "Save document"}
                </button>
              )}
              <button
                type="button"
                className="document-edit-toggle"
                onClick={async () => {
                  if (editMode && hasDocUnsavedChanges) {
                    const ok = window.confirm(
                      "You have unsaved changes to this document. Discard them?"
                    );
                    if (!ok) {
                      return;
                    }
                    setInitialDocSnapshot(null);
                    await loadDoc();
                  }

                  setEditMode((m) => !m);
                  setEditingSectionId(null);
                  setEditingLinkId(null);
                  setSectionError(null);
                  setLinkError(null);
                  setEditSectionImage(null);
                  setNewSectionImage(null);
                }}
              >
                {editMode ? "Done editing" : "Edit document"}
              </button>
            </div>
          )}
        </div>

        <div className="document-header-meta">
          {collectionCount > 0 && (
            <span className="document-collections-pill">
              In {collectionCount} collection
              {collectionCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </header>

      {docError && <p className="document-error">{docError}</p>}

      {/* VISIBILITY / META EDIT (everyone toggle) */}
      {editMode && canEdit && (
        <section className="doc-meta-edit">
          <h3>Document visibility</h3>
          <div className="doc-visibility-block">
            <label className="doc-toggle-line">
              <input
                type="checkbox"
                checked={!!doc.everyone}
                onChange={(e) =>
                  setDoc((prev: any) =>
                    prev ? { ...prev, everyone: e.target.checked } : prev
                  )
                }
              />
              <span>Visible to everyone in this organization</span>
            </label>

            {!doc.everyone && (
              <p className="doc-visibility-note">
                Restricted: this document will only be visible to members of its
                departments. It must belong to at least one department (via
                department tags).
              </p>
            )}
          </div>
        </section>
      )}

      {/* TAG BAR (VIEW) */}
      {!!(
        grouped.deptsOrCols.length ||
        grouped.docLinks.length ||
        grouped.externals.length
      ) && (
        <div className="doc-tagbar">
          {!!grouped.deptsOrCols.length && (
            <div className="tag-group">
              <div className="tag-group-label">Related Areas</div>
              <div className="tag-chips">
                {grouped.deptsOrCols.map((t) => (
                  <button
                    key={t.id}
                    className={`tag-chip ${
                      t.target_kind === "department" ? "is-dept" : "is-col"
                    }`}
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
      )}

      {/* TAG & COLLECTION EDIT SECTIONS */}
      {editMode && canEdit && (
        <section className="doc-tags-edit">
          <h3>Tags</h3>
          <p className="doc-tags-text">
            Tags always link somewhere (document, department, collection, or URL).
            Structural tags from departments/collections are auto-applied and
            can't be removed here.{" "}
            <strong>
              Changes to tags are saved immediately and do not depend on the
              “Save document” button.
            </strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setIsTagModalOpen(true);
            }}
          >
            Manage tags…
          </button>

          <hr className="doc-separator" />

          <h3>Collections</h3>
          <p className="doc-tags-text">
            Collections group documents into curated sets. Use the collections
            manager to add this document to existing collections or create new
            ones.{" "}
            <strong>Changes to collections are saved immediately.</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setIsCollectionsModalOpen(true);
            }}
          >
            Manage collections…
          </button>
        </section>
      )}

      {/* RELEVANT LINKS (VIEW & EDIT) */}
      {!!doc.links?.length && (
        <>
          <h3>Relevant Links</h3>
          <ul className="doc-links">
            {doc.links.map((l: any) => (
              <li key={l.id}>
                {editMode && canEdit && editingLinkId === l.id ? (
                  <form onSubmit={handleUpdateLink} className="doc-link-edit-form">
                    <div className="doc-link-edit-grid">
                      <input
                        type="text"
                        placeholder="Title"
                        value={editLinkTitle}
                        onChange={(e) => setEditLinkTitle(e.target.value)}
                      />
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={editLinkUrl}
                        onChange={(e) => setEditLinkUrl(e.target.value)}
                      />
                      <textarea
                        placeholder="Note"
                        value={editLinkNote}
                        onChange={(e) => setEditLinkNote(e.target.value)}
                        rows={2}
                      />
                      <div className="doc-inline-buttons">
                        <button type="submit" disabled={linkSaving}>
                          {linkSaving ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={cancelEditLink}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.title}
                    </a>
                    {l.note ? ` — ${l.note}` : ""}
                    {editMode && canEdit && (
                      <button
                        type="button"
                        className="doc-inline-edit-btn"
                        onClick={() => startEditLink(l)}
                      >
                        Edit
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {editMode && canEdit && (
        <div className="doc-links-add-block">
          <h4>Add Link</h4>
          {linkError && <p className="doc-error-text">{linkError}</p>}
          <form onSubmit={handleCreateLink} className="doc-link-add-form">
            <input
              type="text"
              placeholder="Title"
              value={newLinkTitle}
              onChange={(e) => setNewLinkTitle(e.target.value)}
            />
            <input
              type="url"
              placeholder="https://example.com"
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
            />
            <textarea
              placeholder="Optional note"
              value={newLinkNote}
              onChange={(e) => setNewLinkNote(e.target.value)}
              rows={2}
            />
            <button type="submit" disabled={linkSaving}>
              {linkSaving ? "Saving..." : "Add link"}
            </button>
          </form>
        </div>
      )}

      {/* SECTIONS */}
      {doc.sections?.map((s: any) => (
        <section className="doc-contents" key={s.id}>
          <div className="doc-left">
            {editMode && canEdit && editingSectionId === s.id ? (
              <form
                onSubmit={handleUpdateSection}
                className="doc-section-edit-form"
              >
                <input
                  type="text"
                  placeholder="Section header"
                  value={editSectionHeader}
                  onChange={(e) => setEditSectionHeader(e.target.value)}
                />
                <textarea
                  placeholder="Section body (markdown/plain)"
                  value={editSectionBody}
                  onChange={(e) => setEditSectionBody(e.target.value)}
                  rows={6}
                />
                <label className="doc-image-label">
                  Image (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEditSectionImage(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                {sectionError && <p className="doc-error-text">{sectionError}</p>}
                <div className="doc-inline-buttons">
                  <button type="submit" disabled={sectionSaving}>
                    {sectionSaving ? "Saving..." : "Save section"}
                  </button>
                  <button type="button" onClick={cancelEditSection}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h3 className="doc-section-title">
                  {s.header}
                  {editMode && canEdit && (
                    <button
                      type="button"
                      className="doc-inline-edit-btn"
                      onClick={() => startEditSection(s)}
                    >
                      Edit
                    </button>
                  )}
                </h3>
                <pre className="doc-section-pre">{s.body_md}</pre>
              </>
            )}
          </div>
          <div className="doc-right">
            {s.image ? (
              <div className="doc-section-image-wrapper">
                <img
                  className="doc-sec-img"
                  src={s.image}
                  alt={s.header || "section image"}
                />
              </div>
            ) : null}
          </div>
        </section>
      ))}

      {editMode && canEdit && (
        <section className="doc-contents doc-add-section-block">
          <div className="doc-left">
            <h3>Add Section</h3>
            {sectionError && !editingSectionId && (
              <p className="doc-error-text">{sectionError}</p>
            )}
            <form
              onSubmit={handleCreateSection}
              className="doc-section-add-form"
            >
              <input
                type="text"
                placeholder="Section header"
                value={newSectionHeader}
                onChange={(e) => setNewSectionHeader(e.target.value)}
              />
              <textarea
                placeholder="Section body (markdown/plain)"
                value={newSectionBody}
                onChange={(e) => setNewSectionBody(e.target.value)}
                rows={6}
              />
              <label className="doc-image-label">
                Image (optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setNewSectionImage(e.target.files?.[0] ?? null)
                  }
                />
              </label>
              <button type="submit" disabled={sectionSaving}>
                {sectionSaving ? "Saving..." : "Add section"}
              </button>
            </form>
          </div>
          <div className="doc-right" />
        </section>
      )}

      {/* MANAGE TAGS + COLLECTIONS MODALS (only while editing) */}
      {editMode && canEdit && (
        <>
          <ManageTagsModal
            doc={doc}
            canEdit={canEdit}
            isOpen={isTagModalOpen}
            onClose={() => setIsTagModalOpen(false)}
            onDocUpdated={setDoc}
          />
          <ManageCollectionsModal
            doc={doc}
            canEdit={canEdit}
            isOpen={isCollectionsModalOpen}
            onClose={() => setIsCollectionsModalOpen(false)}
            onDocUpdated={setDoc}
          />
        </>
      )}
    </div>
  );
}
