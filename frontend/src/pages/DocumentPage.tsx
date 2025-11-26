import { useParams, useNavigate } from "react-router-dom";
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

type InfoKey = "visibility" | "collections" | "tags";

type LightboxImage = {
  src: string;
  alt: string;
};

function normalizeTag(t: RawTag): NormalizedTag {
  if (t.target_kind && t.target_value) return t as NormalizedTag;

  if (t.link_department) {
    return {
      ...t,
      target_kind: "department",
      target_value: { slug: t.slug },
    };
  }
  if (t.link_collection) {
    return {
      ...t,
      target_kind: "collection",
      target_value: { slug: t.slug },
    };
  }
  if (t.link_document) {
    return {
      ...t,
      target_kind: "document",
      target_value: { id: t.link_document },
    };
  }
  if (t.link_url) {
    return {
      ...t,
      target_kind: "external",
      target_value: { url: t.link_url ?? undefined },
    };
  }
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
  const navigate = useNavigate();
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

  // sidebar tag collapse
  const [areTagsOpen, setAreTagsOpen] = useState(true);

  // info bubbles for sidebar headings
  const [activeInfo, setActiveInfo] = useState<InfoKey | null>(null);
  const [lockedInfo, setLockedInfo] = useState<InfoKey | null>(null);

  // lightbox for section images
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(
    null
  );

  // ----- COLLAPSIBLE FORMS -----
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);

  // ----- DELETION TRACKING -----
  const [deletedSectionIds, setDeletedSectionIds] = useState<number[]>([]);
  const [deletedLinkIds, setDeletedLinkIds] = useState<number[]>([]);

  // ----- LOAD DOCUMENT -----
  const loadDoc = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/documents/${id}/`);
      const data = res.data;
      setDoc(data);

      if (!initialDocSnapshot) {
        setInitialDocSnapshot(data);
      }

      // Reset deletion tracking on load
      setDeletedSectionIds([]);
      setDeletedLinkIds([]);

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
  // We need a deep comparison now because sections/links change locally
  const hasDocUnsavedChanges = useMemo(() => {
    if (!doc || !initialDocSnapshot) return false;
    try {
      // Simple deep compare of relevant fields
      // We need to strip out things that might change irrelevantly or order
      // But for now, let's just compare the JSON stringification of the whole object
      // This is expensive but safe for small docs.
      // Better: compare specific fields.

      const current = {
        title: doc.title,
        status: doc.status,
        everyone: doc.everyone,
        sections: doc.sections, // Order and content matters
        links: doc.links,
      };

      const initial = {
        title: initialDocSnapshot.title,
        status: initialDocSnapshot.status,
        everyone: initialDocSnapshot.everyone,
        sections: initialDocSnapshot.sections,
        links: initialDocSnapshot.links,
      };

      return JSON.stringify(current) !== JSON.stringify(initial);
    } catch {
      return true;
    }
  }, [doc, initialDocSnapshot]);

  const hasInlineDrafts = useMemo(() => {
    if (!editMode) return false;

    const hasEditingSectionDraft =
      editingSectionId !== null &&
      (editSectionHeader.trim() !== "" ||
        editSectionBody.trim() !== "" ||
        editSectionImage !== null);

    const hasEditingLinkDraft =
      editingLinkId !== null &&
      (editLinkTitle.trim() !== "" ||
        editLinkUrl.trim() !== "" ||
        editLinkNote.trim() !== "");

    const hasNewSectionDraft =
      newSectionHeader.trim() !== "" ||
      newSectionBody.trim() !== "" ||
      newSectionImage !== null;

    const hasNewLinkDraft =
      newLinkTitle.trim() !== "" ||
      newLinkUrl.trim() !== "" ||
      newLinkNote.trim() !== "";

    return (
      hasEditingSectionDraft ||
      hasEditingLinkDraft ||
      hasNewSectionDraft ||
      hasNewLinkDraft
    );
  }, [
    editMode,
    editingSectionId,
    editSectionHeader,
    editSectionBody,
    editSectionImage,
    editingLinkId,
    editLinkTitle,
    editLinkUrl,
    editLinkNote,
    newSectionHeader,
    newSectionBody,
    newSectionImage,
    newLinkTitle,
    newLinkUrl,
    newLinkNote,
  ]);


  // Warn on full page unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!editMode) return;
      if (!hasDocUnsavedChanges && !hasInlineDrafts) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [editMode, hasDocUnsavedChanges, hasInlineDrafts]);

  useEffect(() => {
    if (!editMode) return;

    const handleClick = (event: MouseEvent) => {
      if (!editMode) return;
      if (!hasDocUnsavedChanges && !hasInlineDrafts) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Allow external links / new tabs / hash links
      if (anchor.target === "_blank") return;
      if (/^https?:\/\//i.test(href)) return;
      if (href.startsWith("#")) return;

      // This looks like an in-app navigation; intercept it
      event.preventDefault();

      const ok = window.confirm(
        "You have unsaved changes to this document. Leave this page and discard them?"
      );

      if (ok) {
        navigate(href);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [editMode, hasDocUnsavedChanges, hasInlineDrafts, navigate]);

  // Close locked info popovers when clicking outside
  useEffect(() => {
    if (!lockedInfo) return;

    const handleDocClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".doc-info-bubble")) {
        setLockedInfo(null);
        setActiveInfo(null);
      }
    };

    document.addEventListener("mousedown", handleDocClick);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
    };
  }, [lockedInfo]);

  const handleSaveDocument = async () => {
    if (!doc?.id) return;

    try {
      setDocSaving(true);
      setDocError(null);

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

      // 1. Handle Deletions
      if (deletedSectionIds.length > 0) {
        await Promise.all(
          deletedSectionIds.map(id => api.delete(`/sections/${id}/`))
        );
      }
      if (deletedLinkIds.length > 0) {
        await Promise.all(
          deletedLinkIds.map(id => api.delete(`/links/${id}/`))
        );
      }

      // 2. Update Document Metadata
      const payload: any = {
        title: doc.title,
        status: doc.status,
        everyone: doc.everyone,
      };
      await api.patch(`/documents/${doc.id}/`, payload);

      // 3. Handle Sections (Create & Update & Reorder)
      // We need to send updates for ALL sections to ensure order is correct.
      // New sections have negative IDs.
      if (doc.sections) {
        for (let i = 0; i < doc.sections.length; i++) {
          const s = doc.sections[i];
          const form = new FormData();
          form.append("order", String(i)); // Ensure order is set

          // If it's a new section (id < 0) or modified, we send data.
          // For simplicity in this "save all" model, we can just send everything for modified/new.
          // But for existing unmodified ones, we only need to update 'order' if it changed.
          // To be safe and simple:
          // - If ID < 0: POST
          // - If ID > 0: PATCH (always, to catch edits + order)

          if (s.id < 0) {
            // CREATE
            form.append("document", String(doc.id));
            form.append("header", s.header);
            form.append("body_md", s.body_md);
            if (s.imageFile) { // We stored the file object in state
              form.append("image", s.imageFile);
            }
            await api.post("/sections/", form);
          } else {
            // UPDATE
            form.append("header", s.header);
            form.append("body_md", s.body_md);
            if (s.imageFile) {
              form.append("image", s.imageFile);
            }
            await api.patch(`/sections/${s.id}/`, form);
          }
        }
      }

      // 4. Handle Links
      if (doc.links) {
        for (const l of doc.links) {
          if (l.id < 0) {
            // CREATE
            await api.post("/links/", {
              document: doc.id,
              title: l.title,
              url: l.url,
              note: l.note,
            });
          } else {
            // UPDATE
            await api.patch(`/links/${l.id}/`, {
              title: l.title,
              url: l.url,
              note: l.note,
            });
          }
        }
      }

      // Reload to get fresh state (real IDs, etc)
      const res = await api.get(`/documents/${doc.id}/`);
      setDoc(res.data);
      setInitialDocSnapshot(res.data);

      // Reset deletion tracking
      setDeletedSectionIds([]);
      setDeletedLinkIds([]);

    } catch (e: any) {
      setDocError(e?.message ?? "Failed to save document");
    } finally {
      setDocSaving(false);
    }
  };

  // ----- SECTION REORDERING -----
  const handleMoveSection = async (index: number, direction: "up" | "down") => {
    if (!doc?.sections) return;
    const sections = [...doc.sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= sections.length) return;

    // Swap in local state ONLY
    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;

    setDoc((prev: any) => ({ ...prev, sections }));
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

    // Local update only
    setDoc((prev: any) => {
      const newSections = prev.sections.map((s: any) => {
        if (s.id === editingSectionId) {
          return {
            ...s,
            header: editSectionHeader.trim() || "(Untitled section)",
            body_md: editSectionBody,
            imageFile: editSectionImage || s.imageFile, // Keep existing if not replaced, or new
            // Note: We can't easily preview the new image without creating a URL, 
            // but for now let's just store the file. 
            // If we wanted preview, we'd createObjectURL here.
          };
        }
        return s;
      });
      return { ...prev, sections: newSections };
    });

    cancelEditSection();
  };

  const handleCreateSection = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;
    if (!newSectionHeader.trim() && !newSectionBody.trim() && !newSectionImage)
      return;

    // Local create only (negative ID)
    const tempId = -1 * (Date.now()); // Simple temp ID
    const newSection = {
      id: tempId,
      header: newSectionHeader.trim() || "(Untitled section)",
      body_md: newSectionBody,
      imageFile: newSectionImage,
      image: null, // No URL yet
      order: doc.sections.length,
    };

    setDoc((prev: any) => ({
      ...prev,
      sections: [...(prev.sections || []), newSection]
    }));

    setNewSectionHeader("");
    setNewSectionBody("");
    setNewSectionImage(null);
    setIsAddingSection(false);
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

    // Local update only
    setDoc((prev: any) => {
      const newLinks = prev.links.map((l: any) => {
        if (l.id === editingLinkId) {
          return {
            ...l,
            title: editLinkTitle.trim() || editLinkUrl.trim() || "(Untitled link)",
            url: editLinkUrl,
            note: editLinkNote,
          };
        }
        return l;
      });
      return { ...prev, links: newLinks };
    });

    cancelEditLink();
  };

  const handleCreateLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;
    if (!newLinkTitle.trim() && !newLinkUrl.trim()) return;

    // Local create only
    const tempId = -1 * (Date.now());
    const newLink = {
      id: tempId,
      title: newLinkTitle.trim() || newLinkUrl.trim() || "(Untitled link)",
      url: newLinkUrl,
      note: newLinkNote,
    };

    setDoc((prev: any) => ({
      ...prev,
      links: [...(prev.links || []), newLink]
    }));

    setNewLinkTitle("");
    setNewLinkUrl("");
    setNewLinkNote("");
    setIsAddingLink(false);
  };

  if (loading) return <p>Loading...</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;
  if (!doc) return null;

  const hasAnyTags =
    grouped.deptsOrCols.length ||
    grouped.docLinks.length ||
    grouped.externals.length;

  return (
    <div className="document-page">
      <div className="document-grid">
        {/* HEADER: title + status centered across all 4 columns */}
        <header className="document-header document-grid-full">
          <div className="document-header-main">
            {editMode && canEdit ? (
              <input
                type="text"
                className="document-title-input"
                value={doc.title}
                onChange={(e) =>
                  setDoc((prev: any) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Document Title"
              />
            ) : (
              <h1 className="document-title">{doc.title}</h1>
            )}
            {doc.status && (
              <span
                className={`document-status document-status--${doc.status}`}
              >
                {doc.status}
              </span>
            )}
          </div>
        </header>

        {/* DOC ERROR (if save failed) */}
        {docError && (
          <div className="document-grid-full">
            <p className="document-error">{docError}</p>
          </div>
        )}

        {/* LEFT COLUMN: tags + visibility + collections */}
        <aside className="document-left-column">
          {/* TAGS PANEL (collapsible) */}
          <div className="doc-sidebar-panel">
            <button
              type="button"
              className="doc-sidebar-toggle"
              onClick={() => setAreTagsOpen((open: boolean) => !open)}
              disabled={!hasAnyTags}
            >
              <span className="doc-sidebar-title">Tags</span>
              <span className="doc-sidebar-toggle-indicator">
                {!hasAnyTags ? "No tags yet" : areTagsOpen ? "Hide" : "Show"}
              </span>
            </button>

            {areTagsOpen && hasAnyTags && (
              <div className="doc-sidebar-body">
                <div className="doc-tagbar">
                  {!!grouped.deptsOrCols.length && (
                    <div className="tag-group">
                      <div className="tag-group-label">Related Areas</div>
                      <div className="tag-chips">
                        {grouped.deptsOrCols.map((t) => (
                          <button
                            key={t.id}
                            className={`tag-chip ${t.target_kind === "department"
                              ? "is-dept"
                              : "is-col"
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
              </div>
            )}

            {editMode && canEdit && (
              <>
                <div className="doc-sidebar-manage-block">
                  <button
                    type="button"
                    className="ks-btn-primary"
                    onClick={() => {
                      setIsTagModalOpen(true);
                    }}
                  >
                    Manage tags
                  </button>
                </div>

                {/* TAGS HELP BUBBLE (bottom-right) */}
                <div
                  className="doc-info-bubble"
                  onMouseEnter={() => {
                    if (!lockedInfo) setActiveInfo("tags");
                  }}
                  onMouseLeave={() => {
                    if (!lockedInfo) setActiveInfo(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLockedInfo((current: InfoKey | null) =>
                      current === "tags" ? null : "tags"
                    );
                    setActiveInfo((current: InfoKey | null) =>
                      current === "tags" ? null : "tags"
                    );
                  }}
                >
                  <button
                    type="button"
                    className={
                      "doc-info-icon" +
                      (lockedInfo === "tags" ? " doc-info-icon--active" : "")
                    }
                    aria-label="Tags help"
                  >
                    ?
                  </button>
                  {(activeInfo === "tags" || lockedInfo === "tags") && (
                    <div className="doc-info-popover">
                      <p>
                        Tags always link somewhere: a department, a collection,
                        another document, or an external URL.
                      </p>
                      <p>
                        Department and collection tags are structural — they’re
                        applied automatically from those objects and can’t be
                        removed directly here.
                      </p>
                      <p>
                        Changes in the tag manager are saved immediately and do
                        not depend on “Save document”.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* VISIBILITY (edit mode only) */}
          {editMode && canEdit && (
            <>
              <section className="doc-sidebar-section">
                <div className="doc-sidebar-heading-row">
                  <h3 className="doc-sidebar-heading">Visibility</h3>
                </div>

                <div className="doc-visibility-block">
                  <label className="doc-toggle-line">
                    <input
                      type="checkbox"
                      checked={!!doc.everyone}
                      onChange={(e) =>
                        setDoc((prev: any) =>
                          prev
                            ? { ...prev, everyone: e.target.checked }
                            : prev
                        )
                      }
                    />
                    <span>Visible to everyone in this organization</span>
                  </label>

                  {!doc.everyone && (
                    <p className="doc-visibility-note">
                      Restricted visibility — see the (?) for details.
                    </p>
                  )}
                </div>

                {/* VISIBILITY HELP BUBBLE (bottom-right) */}
                <div
                  className="doc-info-bubble"
                  onMouseEnter={() => {
                    if (!lockedInfo) setActiveInfo("visibility");
                  }}
                  onMouseLeave={() => {
                    if (!lockedInfo) setActiveInfo(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLockedInfo((current: InfoKey | null) =>
                      current === "visibility" ? null : "visibility"
                    );
                    setActiveInfo((current: InfoKey | null) =>
                      current === "visibility" ? null : "visibility"
                    );
                  }}
                >
                  <button
                    type="button"
                    className={
                      "doc-info-icon" +
                      (lockedInfo === "visibility"
                        ? " doc-info-icon--active"
                        : "")
                    }
                    aria-label="Visibility help"
                  >
                    ?
                  </button>
                  {(activeInfo === "visibility" ||
                    lockedInfo === "visibility") && (
                      <div className="doc-info-popover">
                        <p>
                          Visibility controls whether this document is visible to
                          everyone in the organization or only to members of its
                          departments.
                        </p>
                        <p>
                          When visibility is restricted, the document must belong
                          to at least one department via its department tags.
                        </p>
                      </div>
                    )}
                </div>
              </section>

              {/* COLLECTIONS (edit mode only) */}
              <section className="doc-sidebar-section">
                <div className="doc-sidebar-heading-row">
                  <h3 className="doc-sidebar-heading">Collections</h3>
                </div>

                <button
                  type="button"
                  className="ks-btn-primary"
                  onClick={() => {
                    setIsCollectionsModalOpen(true);
                  }}
                >
                  Manage collections
                </button>

                {/* COLLECTIONS HELP BUBBLE (bottom-right) */}
                <div
                  className="doc-info-bubble"
                  onMouseEnter={() => {
                    if (!lockedInfo) setActiveInfo("collections");
                  }}
                  onMouseLeave={() => {
                    if (!lockedInfo) setActiveInfo(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLockedInfo((current: InfoKey | null) =>
                      current === "collections" ? null : "collections"
                    );
                    setActiveInfo((current: InfoKey | null) =>
                      current === "collections" ? null : "collections"
                    );
                  }}
                >
                  <button
                    type="button"
                    className={
                      "doc-info-icon" +
                      (lockedInfo === "collections"
                        ? " doc-info-icon--active"
                        : "")
                    }
                    aria-label="Collections help"
                  >
                    ?
                  </button>
                  {(activeInfo === "collections" ||
                    lockedInfo === "collections") && (
                      <div className="doc-info-popover">
                        <p>
                          Collections group documents into curated sets, such as
                          “Onboarding” or “Runbooks”.
                        </p>
                        <p>
                          Use the manager to add this document to existing
                          collections or create new ones. Changes to collections
                          are saved immediately and do not depend on “Save
                          document”.
                        </p>
                      </div>
                    )}
                </div>
              </section>
            </>
          )}
        </aside>

        {/* CENTER TWO COLUMNS: “paper” with links + sections */}
        <main className="document-main">
          <div className="doc-paper">
            <div className="doc-paper-inner">
              {/* RELEVANT LINKS (VIEW & EDIT) */}
              {!!doc.links?.length && (
                <>
                  <h3 className="doc-paper-subtitle">Relevant Links</h3>
                  <ul className="doc-links">
                    {doc.links.map((l: any) => (
                      <li key={l.id}>
                        {editMode && canEdit && editingLinkId === l.id ? (
                          <form
                            onSubmit={handleUpdateLink}
                            className="doc-link-edit-form"
                          >
                            <div className="doc-link-edit-grid">
                              <input
                                type="text"
                                placeholder="Title"
                                value={editLinkTitle}
                                onChange={(e) =>
                                  setEditLinkTitle(e.target.value)
                                }
                              />
                              <input
                                type="url"
                                placeholder="https://example.com"
                                value={editLinkUrl}
                                onChange={(e) =>
                                  setEditLinkUrl(e.target.value)
                                }
                              />
                              <textarea
                                placeholder="Note"
                                value={editLinkNote}
                                onChange={(e) =>
                                  setEditLinkNote(e.target.value)
                                }
                                rows={2}
                              />
                              <div className="doc-inline-buttons">
                                <button
                                  type="submit"
                                  className="ks-btn-primary"
                                  disabled={linkSaving}
                                >
                                  {linkSaving ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  className="ks-btn-secondary"
                                  onClick={cancelEditLink}
                                >
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
                  {!isAddingLink ? (
                    <button
                      className="ks-btn-primary doc-add-trigger-btn"
                      onClick={() => setIsAddingLink(true)}
                    >
                      + Add Link
                    </button>
                  ) : (
                    <div className="doc-add-form-wrapper">
                      <h4>Add Link</h4>
                      {linkError && (
                        <p className="doc-error-text">{linkError}</p>
                      )}
                      <form
                        onSubmit={handleCreateLink}
                        className="doc-link-add-form"
                      >
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
                        <div className="doc-inline-buttons">
                          <button
                            type="submit"
                            className="ks-btn-primary"
                            disabled={linkSaving}
                          >
                            {linkSaving ? "Saving..." : "Add link"}
                          </button>
                          <button
                            type="button"
                            className="ks-btn-secondary"
                            onClick={() => setIsAddingLink(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* SECTIONS: headers/body on left, images on right */}
              {doc.sections?.map((s: any, index: number) => (
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
                          onChange={(e) =>
                            setEditSectionHeader(e.target.value)
                          }
                        />
                        <textarea
                          placeholder="Section body (markdown/plain)"
                          value={editSectionBody}
                          onChange={(e) =>
                            setEditSectionBody(e.target.value)
                          }
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
                        {sectionError && (
                          <p className="doc-error-text">{sectionError}</p>
                        )}
                        <div className="doc-inline-buttons">
                          <button
                            type="submit"
                            className="ks-btn-primary"
                            disabled={sectionSaving}
                          >
                            {sectionSaving ? "Saving..." : "Save section"}
                          </button>
                          <button
                            type="button"
                            className="ks-btn-secondary"
                            onClick={cancelEditSection}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="doc-section-header-row">
                          {editMode && canEdit && (
                            <div className="doc-section-reorder-controls">
                              <button
                                type="button"
                                className="doc-reorder-btn"
                                disabled={index === 0}
                                onClick={() => handleMoveSection(index, "up")}
                                title="Move up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                className="doc-reorder-btn"
                                disabled={index === (doc.sections?.length || 0) - 1}
                                onClick={() => handleMoveSection(index, "down")}
                                title="Move down"
                              >
                                ▼
                              </button>
                            </div>
                          )}
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
                        </div>
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
                          onClick={() =>
                            setLightboxImage({
                              src: s.image,
                              alt: s.header || "section image",
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                </section>
              ))}

              {editMode && canEdit && (
                <section className="doc-contents doc-add-section-block">
                  <div className="doc-left">
                    {!isAddingSection ? (
                      <div style={{ textAlign: "center", padding: "20px 0" }}>
                        <button
                          className="ks-btn-primary doc-add-trigger-btn"
                          onClick={() => setIsAddingSection(true)}
                        >
                          + Add Section
                        </button>
                      </div>
                    ) : (
                      <div className="doc-add-form-wrapper">
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
                            onChange={(e) =>
                              setNewSectionHeader(e.target.value)
                            }
                          />
                          <textarea
                            placeholder="Section body (markdown/plain)"
                            value={newSectionBody}
                            onChange={(e) =>
                              setNewSectionBody(e.target.value)
                            }
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
                          <div className="doc-inline-buttons">
                            <button
                              type="submit"
                              className="ks-btn-primary"
                              disabled={sectionSaving}
                            >
                              {sectionSaving ? "Saving..." : "Add section"}
                            </button>
                            <button
                              type="button"
                              className="ks-btn-secondary"
                              onClick={() => setIsAddingSection(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                  <div className="doc-right" />
                </section>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN reserved (empty for now) */}
        <aside className="document-right-column" />

        {/* FOOTER BAR ACROSS ALL 4 COLUMNS */}
        <footer className="document-footer document-grid-full">
          <div className="document-footer-meta">
            {editMode && canEdit && (hasDocUnsavedChanges || hasInlineDrafts) && (
              <span className="doc-unsaved-pill">Unsaved changes</span>
            )}
          </div>
          <div className="document-footer-actions">
            {canEdit && (
              <>
                {editMode && (
                  <button
                    type="button"
                    className="document-save-btn ks-btn-primary"
                    onClick={handleSaveDocument}
                    disabled={!hasDocUnsavedChanges || docSaving}
                  >
                    {docSaving ? "Saving…" : "Save document"}
                  </button>
                )}
                <button
                  type="button"
                  className="document-edit-toggle ks-btn-secondary"
                  onClick={async () => {
                    if (editMode && (hasDocUnsavedChanges || hasInlineDrafts)) {
                      const ok = window.confirm(
                        "You have unsaved changes to this document. Discard them?"
                      );
                      if (!ok) {
                        return;
                      }
                      setInitialDocSnapshot(null);
                      await loadDoc();
                    }

                    setEditMode((m: boolean) => !m);
                    setEditingSectionId(null);
                    setEditingLinkId(null);
                    setSectionError(null);
                    setLinkError(null);
                    setEditSectionImage(null);
                    setNewSectionImage(null);
                    setActiveInfo(null);
                    setLockedInfo(null);
                    setIsAddingSection(false);
                    setIsAddingLink(false);
                  }}
                >
                  {editMode ? "Done editing" : "Edit document"}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>

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

      {/* IMAGE LIGHTBOX OVERLAY */}
      {lightboxImage && (
        <div
          className="doc-image-lightbox-backdrop"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="doc-image-lightbox"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="doc-image-lightbox-close"
              onClick={() => setLightboxImage(null)}
              aria-label="Close image preview"
            >
              ×
            </button>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="doc-image-lightbox-img"
            />
            {lightboxImage.alt && (
              <div className="doc-image-lightbox-caption">
                {lightboxImage.alt}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
