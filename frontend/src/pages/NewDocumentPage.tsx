import { useParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import {
  api,
  listTags,
  createTag,
  setDocumentTags,
  listCollections,
  setDocumentCollections,
  listDocuments,
  listDepartments,
} from "../lib/api";
import "./DocumentPage.css";
import { usePathTree } from "../state/PathTree";
import { useAuth } from "../context/AuthContext";

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

type SimpleCollection = {
  id: number;
  name: string;
  slug: string;
};

type SimpleDoc = {
  id: number;
  title: string;
};

type SimpleDept = {
  id: number;
  name: string;
  slug: string;
};

type NewTagLinkType = "document" | "department" | "collection" | "url";

function normalizeTag(t: RawTag): NormalizedTag {
  if (t.target_kind && t.target_value) return t as NormalizedTag;
  if (t.link_department)
    return { ...t, target_kind: "department", target_value: { slug: t.slug } };
  if (t.link_collection)
    return { ...t, target_kind: "collection", target_value: { slug: t.slug } };
  if (t.link_document)
    return { ...t, target_kind: "document", target_value: { id: t.link_document } };
  if (t.link_url)
    return { ...t, target_kind: "external", target_value: { url: t.link_url ?? undefined } };
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
  else if (k === "document" && typeof v.id === "number") url = `/documents/${v.id}`;
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);

  // ----- tags / manage-tags modal -----
  const [allTags, setAllTags] = useState<RawTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagSearchExisting, setTagSearchExisting] = useState("");
  const [tagSearchCurrent, setTagSearchCurrent] = useState("");

  // new-tag fields
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [newTagLinkType, setNewTagLinkType] =
    useState<NewTagLinkType>("document");
  const [newTagTargetDocId, setNewTagTargetDocId] = useState<number | null>(
    null
  );
  const [newTagDepartmentId, setNewTagDepartmentId] = useState<number | null>(
    null
  );
  const [newTagCollectionId, setNewTagCollectionId] = useState<number | null>(
    null
  );
  const [newTagUrl, setNewTagUrl] = useState("");

  // ----- collections -----
  const [allCollections, setAllCollections] = useState<SimpleCollection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>(
    []
  );
  const [collectionSearch, setCollectionSearch] = useState("");
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  // documents / departments for linking tags
  const [allDocuments, setAllDocuments] = useState<SimpleDoc[]>([]);
  const [allDepartments, setAllDepartments] = useState<SimpleDept[]>([]);
  const [linkDocSearch, setLinkDocSearch] = useState("");
  const [linkDeptSearch, setLinkDeptSearch] = useState("");
  const [linkCollectionSearch, setLinkCollectionSearch] = useState("");

  // ----- sections -----
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editSectionHeader, setEditSectionHeader] = useState("");
  const [editSectionBody, setEditSectionBody] = useState("");
  const [editSectionImage, setEditSectionImage] = useState<File | null>(null);

  const [newSectionHeader, setNewSectionHeader] = useState("");
  const [newSectionBody, setNewSectionBody] = useState("");
  const [newSectionImage, setNewSectionImage] = useState<File | null>(null);

  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // ----- links -----
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [editLinkTitle, setEditLinkTitle] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editLinkNote, setEditLinkNote] = useState("");

  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkNote, setNewLinkNote] = useState("");

  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadDoc = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/documents/${id}/`);
      setDoc(res.data);
      setErr(null);
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

  // initialize manual tags & collections whenever doc changes
  useEffect(() => {
    if (!doc) {
      setSelectedTagIds([]);
      setSelectedCollectionIds([]);
      return;
    }

    // manual tags = no dept/collection link
    const manualTagIds = (doc.tags ?? [])
      .filter((t: RawTag) => !t.link_department && !t.link_collection)
      .map((t: RawTag) => t.id);
    setSelectedTagIds(manualTagIds);

    // collections = list of ids from serializer
    setSelectedCollectionIds((doc.collections ?? []) as number[]);
  }, [doc]);

  // load tags + collections + docs + depts when manage-tags modal opens
  useEffect(() => {
    if (!isTagModalOpen || !canEdit) return;

    (async () => {
      try {
        setTagLoading(true);
        setTagError(null);
        const res = await listTags();
        const tags = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        setAllTags(tags);
      } catch (e: any) {
        setTagError(e?.message ?? "Failed to load tags");
      } finally {
        setTagLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await listDocuments();
        const raw = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        const docsSimple: SimpleDoc[] = raw.map((d: any) => ({
          id: d.id,
          title: d.title,
        }));
        setAllDocuments(docsSimple);
      } catch {
        // swallow for now
      }
    })();

    (async () => {
      try {
        const res = await listDepartments();
        const raw = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        const deptsSimple: SimpleDept[] = raw.map((d: any) => ({
          id: d.id,
          name: d.name,
          slug: d.slug,
        }));
        setAllDepartments(deptsSimple);
      } catch {
        // swallow for now
      }
    })();

    (async () => {
      try {
        setCollectionLoading(true);
        setCollectionError(null);
        const res = await listCollections();
        const raw = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        const cols: SimpleCollection[] = raw.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        }));
        setAllCollections(cols);
      } catch (e: any) {
        setCollectionError(e?.message ?? "Failed to load collections");
      } finally {
        setCollectionLoading(false);
      }
    })();
  }, [isTagModalOpen, canEdit]);

  const manualTagsOnDoc = useMemo(
    () =>
      (doc?.tags ?? []).filter(
        (t: RawTag) => !t.link_department && !t.link_collection
      ),
    [doc?.tags]
  );

  const structuralTagsOnDoc = useMemo(
    () =>
      (doc?.tags ?? []).filter(
        (t: RawTag) => t.link_department || t.link_collection
      ),
    [doc?.tags]
  );

  const availableExistingTags = useMemo(() => {
    const q = tagSearchExisting.trim().toLowerCase();
    const src = Array.isArray(allTags) ? allTags : [];
    return src
      .filter((t) => !selectedTagIds.includes(t.id)) // not already attached as manual
      .filter((t) =>
        q ? t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) : true
      );
  }, [allTags, selectedTagIds, tagSearchExisting]);

  const filteredCurrentTags = useMemo(() => {
    const q = tagSearchCurrent.trim().toLowerCase();
    const src = manualTagsOnDoc;
    if (!q) return src;
    return src.filter((t: RawTag) =>
      t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
    );
  }, [manualTagsOnDoc, tagSearchCurrent]);

  const filteredCollectionsForDoc = useMemo(() => {
    const q = collectionSearch.trim().toLowerCase();
    if (!q) return allCollections;
    return allCollections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    );
  }, [allCollections, collectionSearch]);

  const filteredDocsForLink = useMemo(() => {
    const q = linkDocSearch.trim().toLowerCase();
    if (!q) return allDocuments;
    return allDocuments.filter((d) =>
      d.title.toLowerCase().includes(q)
    );
  }, [allDocuments, linkDocSearch]);

  const filteredDeptsForLink = useMemo(() => {
    const q = linkDeptSearch.trim().toLowerCase();
    if (!q) return allDepartments;
    return allDepartments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.slug.toLowerCase().includes(q)
    );
  }, [allDepartments, linkDeptSearch]);

  const filteredCollectionsForLink = useMemo(() => {
    const q = linkCollectionSearch.trim().toLowerCase();
    if (!q) return allCollections;
    return allCollections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    );
  }, [allCollections, linkCollectionSearch]);

  // ----- tag attach/detach -----
  const applyTagSelection = async (manualIds: number[]) => {
    if (!doc?.id) return;
    try {
      setTagLoading(true);
      setTagError(null);
      const res = await setDocumentTags(doc.id, manualIds);
      setDoc(res.data);
      setSelectedTagIds(manualIds);
    } catch (e: any) {
      setTagError(e?.message ?? "Failed to update tags");
    } finally {
      setTagLoading(false);
    }
  };

  const handleAttachExistingTag = async (tagId: number) => {
    if (selectedTagIds.includes(tagId)) return;
    const next = [...selectedTagIds, tagId];
    await applyTagSelection(next);
  };

  const handleDetachManualTag = async (tagId: number) => {
    const next = selectedTagIds.filter((id) => id !== tagId);
    await applyTagSelection(next);
  };

  const handleCreateTag = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;

    const name = newTagName.trim();
    if (!name) {
      setTagError("Name is required");
      return;
    }

    // enforce "must link to something"
    if (newTagLinkType === "document" && !newTagTargetDocId) {
      setTagError("Select a document to link to.");
      return;
    }
    if (newTagLinkType === "department" && !newTagDepartmentId) {
      setTagError("Select a department to link to.");
      return;
    }
    if (newTagLinkType === "collection" && !newTagCollectionId) {
      setTagError("Select a collection to link to.");
      return;
    }
    if (newTagLinkType === "url" && !newTagUrl.trim()) {
      setTagError("Enter a URL to link to.");
      return;
    }

    try {
      setTagLoading(true);
      setTagError(null);

      const payload: any = { name };
      if (newTagDescription.trim()) {
        payload.description = newTagDescription.trim();
      }

      if (newTagLinkType === "document" && newTagTargetDocId) {
        payload.link_document = newTagTargetDocId;
      } else if (newTagLinkType === "department" && newTagDepartmentId) {
        payload.link_department = newTagDepartmentId;
      } else if (newTagLinkType === "collection" && newTagCollectionId) {
        payload.link_collection = newTagCollectionId;
      } else if (newTagLinkType === "url" && newTagUrl.trim()) {
        payload.link_url = newTagUrl.trim();
      }

      const res = await createTag(payload);
      const tag: RawTag = res.data;

      // add to available tags
      setAllTags((prev) => [...prev, tag]);

      // attach to THIS document as manual tag
      const nextManual = selectedTagIds.includes(tag.id)
        ? selectedTagIds
        : [...selectedTagIds, tag.id];
      await applyTagSelection(nextManual);

      // reset new-tag fields
      setNewTagName("");
      setNewTagDescription("");
      setNewTagTargetDocId(null);
      setNewTagDepartmentId(null);
      setNewTagCollectionId(null);
      setNewTagUrl("");
      setNewTagLinkType("document");
    } catch (e: any) {
      setTagError(e?.message ?? "Failed to create tag");
    } finally {
      setTagLoading(false);
    }
  };

  const handleSaveCollections = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;

    try {
      setCollectionLoading(true);
      setCollectionError(null);
      const res = await setDocumentCollections(doc.id, selectedCollectionIds);
      setDoc(res.data);
    } catch (e: any) {
      setCollectionError(e?.message ?? "Failed to save collections");
    } finally {
      setCollectionLoading(false);
    }
  };

  const toggleCollectionSelection = (cid: number) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  // ----- section handlers -----
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

  // ----- link handlers -----
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
  if (err) return <p style={{ color: "red" }}>{err}</p>;
  if (!doc) return null;

  return (
    <div className="document-page">
      <header className="document-header">
        <div className="document-header-main">
          <h1 className="document-title">{doc.title}</h1>
          {doc.status && (
            <span className={`document-status document-status--${doc.status}`}>
              {doc.status}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            className="document-edit-toggle"
            onClick={() => {
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
        )}
      </header>

      {/* TAG BAR (view) */}
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

      {/* TAG & COLLECTION EDITORS (edit mode) */}
      {editMode && canEdit && (
        <section className="doc-tags-edit" style={{ marginBottom: 24 }}>
          <h3>Tags</h3>
          <p style={{ fontSize: "0.9rem", marginBottom: 8 }}>
            Tags can link to another document, department, collection, or external URL.
            Structural tags from departments/collections may be auto-applied and
            cannot be removed here.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsTagModalOpen(true);
              setTagError(null);
            }}
          >
            Manage tags…
          </button>

          <hr style={{ margin: "20px 0" }} />

          <h3>Collections</h3>
          {collectionError && <p style={{ color: "red" }}>{collectionError}</p>}
          <form onSubmit={handleSaveCollections}>
            <input
              type="text"
              placeholder="Search collections…"
              value={collectionSearch}
              onChange={(e) => setCollectionSearch(e.target.value)}
              style={{ marginBottom: 8, width: "100%", maxWidth: 320 }}
            />
            {collectionLoading && <p>Loading collections…</p>}
            {!collectionLoading && allCollections.length === 0 && (
              <p>No collections yet.</p>
            )}
            {!collectionLoading && allCollections.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {filteredCollectionsForDoc.map((c) => {
                  const selected = selectedCollectionIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCollectionSelection(c.id)}
                      className={
                        "tag-chip " + (selected ? "tag-chip--selected" : "")
                      }
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            <button type="submit" disabled={collectionLoading}>
              {collectionLoading ? "Saving…" : "Save collections"}
            </button>
          </form>
        </section>
      )}

      {/* RELEVANT LINKS */}
      {!!doc.links?.length && (
        <>
          <h3>Relevant Links</h3>
          <ul className="doc-links">
            {doc.links.map((l: any) => (
              <li key={l.id}>
                {editMode && canEdit && editingLinkId === l.id ? (
                  <form
                    onSubmit={handleUpdateLink}
                    style={{ display: "inline-block", width: "100%", maxWidth: 600 }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
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
                      <div style={{ display: "flex", gap: 8 }}>
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
                        style={{ marginLeft: 8, fontSize: "0.8rem" }}
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
        <div style={{ marginTop: 16, marginBottom: 24 }}>
          <h4>Add Link</h4>
          {linkError && <p style={{ color: "red" }}>{linkError}</p>}
          <form
            onSubmit={handleCreateLink}
            style={{ maxWidth: 600, display: "grid", gap: 6 }}
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
                style={{ display: "grid", gap: 8 }}
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
                <label style={{ fontSize: "0.9rem" }}>
                  Image (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEditSectionImage(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                {sectionError && <p style={{ color: "red" }}>{sectionError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
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
                      style={{ marginLeft: 8, fontSize: "0.8rem" }}
                      onClick={() => startEditSection(s)}
                    >
                      Edit
                    </button>
                  )}
                </h3>
                <pre style={{ whiteSpace: "pre-wrap" }}>{s.body_md}</pre>
              </>
            )}
          </div>
          <div className="doc-right">
            {s.image ? (
              <div style={{ margin: "8px 0" }}>
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
        <section className="doc-contents" style={{ marginBlock: 24 }}>
          <div className="doc-left">
            <h3>Add Section</h3>
            {sectionError && !editingSectionId && (
              <p style={{ color: "red" }}>{sectionError}</p>
            )}
            <form
              onSubmit={handleCreateSection}
              style={{ display: "grid", gap: 8 }}
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
              <label style={{ fontSize: "0.9rem" }}>
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

      {/* MANAGE TAGS MODAL */}
      {isTagModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--surface, #fff)",
              padding: 16,
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 720,
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Manage tags</h3>
            {tagError && <p style={{ color: "red" }}>{tagError}</p>}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr)",
                gap: 16,
              }}
            >
              {/* CURRENT TAGS ON THIS DOC */}
              <section>
                <h4>Current tags on this document</h4>
                <p style={{ fontSize: "0.85rem" }}>
                  Manual tags can be removed here. Tags inherited from
                  departments/collections are locked.
                </p>

                <input
                  type="text"
                  placeholder="Search current tags…"
                  value={tagSearchCurrent}
                  onChange={(e) => setTagSearchCurrent(e.target.value)}
                  style={{ marginBottom: 8, width: "100%", maxWidth: 320 }}
                />

                {tagLoading && <p>Loading…</p>}

                {filteredCurrentTags.length === 0 &&
                  structuralTagsOnDoc.length === 0 && (
                    <p>No tags on this document yet.</p>
                  )}

                {filteredCurrentTags.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    {filteredCurrentTags.map((t: RawTag) => (
                      <span key={t.id} className="tag-chip tag-chip--selected">
                        {t.name}
                        <button
                          type="button"
                          style={{
                            marginLeft: 4,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                          onClick={() => handleDetachManualTag(t.id)}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {structuralTagsOnDoc.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Structural (auto-applied)
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {structuralTagsOnDoc.map((t: RawTag) => (
                        <span
                          key={t.id}
                          className="tag-chip"
                          style={{
                            opacity: 0.7,
                            cursor: "default",
                          }}
                          title="Auto-applied from department/collection"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* ATTACH EXISTING TAG */}
              <section>
                <h4>Attach existing tag</h4>
                <input
                  type="text"
                  placeholder="Search tags…"
                  value={tagSearchExisting}
                  onChange={(e) => setTagSearchExisting(e.target.value)}
                  style={{ marginBottom: 8, width: "100%", maxWidth: 320 }}
                />
                {tagLoading && <p>Loading tags…</p>}
                {!tagLoading && availableExistingTags.length === 0 && (
                  <p>No matching tags.</p>
                )}
                {!tagLoading && availableExistingTags.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    {availableExistingTags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="tag-chip"
                        onClick={() => handleAttachExistingTag(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* CREATE NEW TAG */}
              <section>
                <h4>Create new tag</h4>
                <form
                  onSubmit={handleCreateTag}
                  style={{ display: "grid", gap: 8 }}
                >
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Name</span>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      required
                    />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Description (optional)</span>
                    <textarea
                      rows={2}
                      value={newTagDescription}
                      onChange={(e) => setNewTagDescription(e.target.value)}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Link type</span>
                    <select
                      value={newTagLinkType}
                      onChange={(e) => {
                        const v = e.target.value as NewTagLinkType;
                        setNewTagLinkType(v);
                        // reset targets when switching type
                        setNewTagTargetDocId(null);
                        setNewTagDepartmentId(null);
                        setNewTagCollectionId(null);
                        setNewTagUrl("");
                      }}
                    >
                      <option value="document">Document</option>
                      <option value="department">Department</option>
                      <option value="collection">Collection</option>
                      <option value="url">External URL</option>
                    </select>
                  </label>

                  {newTagLinkType === "document" && (
                    <div style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: "0.9rem" }}>
                        Search & select document
                      </span>
                      <input
                        type="text"
                        placeholder="Search documents…"
                        value={linkDocSearch}
                        onChange={(e) => setLinkDocSearch(e.target.value)}
                      />
                      <select
                        value={newTagTargetDocId ?? ""}
                        onChange={(e) =>
                          setNewTagTargetDocId(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">Choose a document…</option>
                        {filteredDocsForLink.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {newTagLinkType === "department" && (
                    <div style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: "0.9rem" }}>
                        Search & select department
                      </span>
                      <input
                        type="text"
                        placeholder="Search departments…"
                        value={linkDeptSearch}
                        onChange={(e) => setLinkDeptSearch(e.target.value)}
                      />
                      <select
                        value={newTagDepartmentId ?? ""}
                        onChange={(e) =>
                          setNewTagDepartmentId(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">Choose a department…</option>
                        {filteredDeptsForLink.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {newTagLinkType === "collection" && (
                    <div style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: "0.9rem" }}>
                        Search & select collection
                      </span>
                      <input
                        type="text"
                        placeholder="Search collections…"
                        value={linkCollectionSearch}
                        onChange={(e) =>
                          setLinkCollectionSearch(e.target.value)
                        }
                      />
                      <select
                        value={newTagCollectionId ?? ""}
                        onChange={(e) =>
                          setNewTagCollectionId(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">Choose a collection…</option>
                        {filteredCollectionsForLink.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {newTagLinkType === "url" && (
                    <label style={{ display: "grid", gap: 4 }}>
                      <span>External URL</span>
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={newTagUrl}
                        onChange={(e) => setNewTagUrl(e.target.value)}
                      />
                    </label>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsTagModalOpen(false);
                        setTagError(null);
                      }}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={tagLoading || !newTagName.trim()}
                    >
                      {tagLoading ? "Creating…" : "Create & attach"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
