// src/components/ManageTagsModal.tsx
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  listTags,
  createTag,
  setDocumentTags,
  listDocuments,
  listDepartments,
} from "../lib/api";
import "./KSModal.css";
import "./ManageTagsModal.css";

type RawTag = {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  link_document?: number | null;
  link_url?: string | null;
  link_department?: number | null;
  link_collection?: number | null;
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

type NewTagLinkType = "document" | "department" | "url";

interface ManageTagsModalProps {
  doc: any;
  isOpen: boolean;
  canEdit: boolean;
  onClose: () => void;
  onDocUpdated: (doc: any) => void;
}

export default function ManageTagsModal({
  doc,
  isOpen,
  canEdit,
  onClose,
  onDocUpdated,
}: ManageTagsModalProps) {
  // ------------- MODE TOGGLE (manage vs create) -------------
  const [mode, setMode] = useState<"manage" | "create">("manage");

  // ------------- TAG STATE -------------
  const [allTags, setAllTags] = useState<RawTag[]>([]);

  // Manual tags = tags without link_department / link_collection
  const manualTagsOnDoc = useMemo(
    () =>
      (doc?.tags ?? []).filter(
        (t: RawTag) => !t.link_department && !t.link_collection
      ),
    [doc?.tags]
  );

  // Department structural tags on the doc
  const departmentTagsOnDoc = useMemo(
    () =>
      (doc?.tags ?? []).filter(
        (t: RawTag) => !!t.link_department && !t.link_collection
      ),
    [doc?.tags]
  );

  // Selection (works as local working copy)
  const [selectedManualTagIds, setSelectedManualTagIds] = useState<number[]>([]);
  const [selectedDeptTagIds, setSelectedDeptTagIds] = useState<number[]>([]);

  // Snapshots to compare for "unsaved changes"
  const [initialManualTagIds, setInitialManualTagIds] = useState<number[]>([]);
  const [initialDeptTagIds, setInitialDeptTagIds] = useState<number[]>([]);

  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const [tagSearchCurrent, setTagSearchCurrent] = useState("");
  const [tagSearchExisting, setTagSearchExisting] = useState("");

  // ------------- CREATE TAG STATE -------------
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
  const [newTagUrl, setNewTagUrl] = useState("");

  const [allDocuments, setAllDocuments] = useState<SimpleDoc[]>([]);
  const [allDepartments, setAllDepartments] = useState<SimpleDept[]>([]);
  const [linkDocSearch, setLinkDocSearch] = useState("");
  const [linkDeptSearch, setLinkDeptSearch] = useState("");

  // ------------- INITIALIZE SELECTION WHEN DOC/MODAL CHANGES -------------
  useEffect(() => {
    if (!doc) {
      setSelectedManualTagIds([]);
      setSelectedDeptTagIds([]);
      setInitialManualTagIds([]);
      setInitialDeptTagIds([]);
      return;
    }
    const manualIds = manualTagsOnDoc.map((t: RawTag) => t.id);
    const deptIds = departmentTagsOnDoc.map((t: RawTag) => t.id);

    setSelectedManualTagIds(manualIds);
    setSelectedDeptTagIds(deptIds);
    setInitialManualTagIds(manualIds);
    setInitialDeptTagIds(deptIds);
  }, [doc, manualTagsOnDoc, departmentTagsOnDoc]);

  // Reset mode when opening/closing
  useEffect(() => {
    if (isOpen) {
      setMode("manage");
      setTagError(null);
    }
  }, [isOpen]);

  const filteredCurrentManualTags = useMemo(() => {
    const q = tagSearchCurrent.trim().toLowerCase();
    const selectedSet = new Set(selectedManualTagIds);
    const current = manualTagsOnDoc.filter((t: RawTag) =>
      selectedSet.has(t.id)
    );
    if (!q) return current;
    return current.filter(
      (t: RawTag) =>
        t.name.toLowerCase().includes(q) ||
        (t.slug ?? "").toLowerCase().includes(q)
    );
  }, [manualTagsOnDoc, selectedManualTagIds, tagSearchCurrent]);

  // ------------- AVAILABLE TAGS, SPLIT BY CATEGORY -------------
  const availableTagsBase = useMemo(() => {
    const q = tagSearchExisting.trim().toLowerCase();
    const selectedSet = new Set([
      ...selectedManualTagIds,
      ...selectedDeptTagIds,
    ]);
    const src = Array.isArray(allTags) ? allTags : [];

    return src
      .filter((t) => !selectedSet.has(t.id))
      .filter((t) =>
        q
          ? t.name.toLowerCase().includes(q) ||
            (t.slug ?? "").toLowerCase().includes(q)
          : true
      );
  }, [allTags, selectedManualTagIds, selectedDeptTagIds, tagSearchExisting]);

  const documentTagsAvailable = useMemo(
    () =>
      availableTagsBase.filter((t) => {
        const isDept = !!t.link_department;
        const isCollection = !!t.link_collection;
        const isDoc = !!t.link_document;
        const hasLink =
          isDept || isCollection || isDoc || !!(t.link_url ?? "").trim();

        if (isDept || isCollection) return false;
        if (isDoc) return true; // Doc-linked
        if (!hasLink) return true; // Pure "manual" tag
        return false;
      }),
    [availableTagsBase]
  );

  const departmentTagsAvailable = useMemo(
    () => availableTagsBase.filter((t) => !!t.link_department),
    [availableTagsBase]
  );

  const externalTagsAvailable = useMemo(
    () =>
      availableTagsBase.filter((t) => {
        const isDept = !!t.link_department;
        const isCollection = !!t.link_collection;
        const isDoc = !!t.link_document;
        const hasUrl = !!(t.link_url ?? "").trim();
        return hasUrl && !isDept && !isCollection && !isDoc;
      }),
    [availableTagsBase]
  );

  // ------------- FILTERED DOCS/DEPTS FOR CREATE MODE -------------
  const filteredDocsForLink = useMemo(() => {
    const q = linkDocSearch.trim().toLowerCase();
    if (!q) return allDocuments;
    return allDocuments.filter((d) => d.title.toLowerCase().includes(q));
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

  // ------------- LOAD TAG/DOC/DEPT DATA WHEN OPEN -------------
  useEffect(() => {
    if (!isOpen || !canEdit || !doc?.id) return;

    (async () => {
      try {
        setTagLoading(true);
        setTagError(null);
        const res = await listTags();
        const data = res.data;
        const tags = Array.isArray(data) ? data : data?.results ?? [];
        setAllTags(tags);
      } catch (e: any) {
        setTagError(e?.message ?? "Failed to load tags");
      } finally {
        setTagLoading(false);
      }
    })();

    (async () => {
      try {
        const docs = await listDocuments();
        const simpleDocs: SimpleDoc[] = docs.map((d: any) => ({
          id: d.id,
          title: d.title,
        }));
        setAllDocuments(simpleDocs);
      } catch {
        // ignore
      }
    })();

    (async () => {
      try {
        const depts = await listDepartments();
        const simpleDepts: SimpleDept[] = depts.map((d: any) => ({
          id: d.id,
          name: d.name,
          slug: d.slug,
        }));
        setAllDepartments(simpleDepts);
      } catch {
        // ignore
      }
    })();
  }, [isOpen, canEdit, doc?.id]);

  // ------------- HELPERS FOR CHANGE DETECTION -------------
  const normalizeIds = (ids: number[]) => [...ids].sort((a, b) => a - b);

  const arraysEqual = (a: number[], b: number[]) => {
    const na = normalizeIds(a);
    const nb = normalizeIds(b);
    if (na.length !== nb.length) return false;
    return na.every((v, idx) => v === nb[idx]);
  };

  const hasUnsavedChanges = useMemo(
    () =>
      !arraysEqual(selectedManualTagIds, initialManualTagIds) ||
      !arraysEqual(selectedDeptTagIds, initialDeptTagIds),
    [selectedManualTagIds, initialManualTagIds, selectedDeptTagIds, initialDeptTagIds]
  );

  // NEW: close handler that warns about unsaved changes
  const handleRequestClose = () => {
    if (canEdit && hasUnsavedChanges) {
      const shouldClose = window.confirm(
        "You have unsaved tag changes. Close without saving?"
      );
      if (!shouldClose) return;
    }
    onClose();
  };

  // ------------- APPLY SELECTION TO BACKEND -------------
  const applyTagSelection = async (
    manualIds: number[],
    deptTagIds: number[]
  ) => {
    if (!doc?.id) return;

    const tagIds = Array.from(new Set([...manualIds, ...deptTagIds]));

    try {
      setTagLoading(true);
      setTagError(null);
      const res = await setDocumentTags(doc.id, tagIds);
      onDocUpdated(res.data);

      // update local + initial snapshots to match what is saved
      setSelectedManualTagIds(manualIds);
      setSelectedDeptTagIds(deptTagIds);
      setInitialManualTagIds(manualIds);
      setInitialDeptTagIds(deptTagIds);
    } catch (e: any) {
      setTagError(e?.message ?? "Failed to update tags");
    } finally {
      setTagLoading(false);
    }
  };

  const handleSaveTagChanges = async () => {
    await applyTagSelection(selectedManualTagIds, selectedDeptTagIds);
  };

  // ------------- HANDLERS: MANUAL + DEPT TAGS (LOCAL ONLY) -------------
  const handleAttachExistingTag = (tagId: number) => {
    const tag = allTags.find((t) => t.id === tagId);
    if (!tag) return;

    if (tag.link_department) {
      const isSelected = selectedDeptTagIds.includes(tagId);
      setSelectedDeptTagIds((prev) =>
        isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]
      );
      return;
    }

    if (selectedManualTagIds.includes(tagId)) return;
    setSelectedManualTagIds((prev) => [...prev, tagId]);
  };

  const handleDetachManualTag = (tagId: number) => {
    if (!selectedManualTagIds.includes(tagId)) return;
    setSelectedManualTagIds((prev) => prev.filter((id) => id !== tagId));
  };

  const handleToggleDeptTag = (tagId: number) => {
    const isSelected = selectedDeptTagIds.includes(tagId);
    setSelectedDeptTagIds((prev) =>
      isSelected ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // ------------- HANDLERS: CREATE TAG MODE -------------
  const resetCreateForm = () => {
    setNewTagName("");
    setNewTagDescription("");
    setNewTagLinkType("document");
    setNewTagTargetDocId(null);
    setNewTagDepartmentId(null);
    setNewTagUrl("");
    setLinkDocSearch("");
    setLinkDeptSearch("");
  };

  const handleCreateTag = async (e: FormEvent) => {
    e.preventDefault();
    if (!doc?.id) return;

    const name = newTagName.trim();
    if (!name) {
      setTagError("Name is required");
      return;
    }

    if (newTagLinkType === "document" && !newTagTargetDocId) {
      setTagError("Select a document to link to.");
      return;
    }
    if (newTagLinkType === "department" && !newTagDepartmentId) {
      setTagError("Select a department to link to.");
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
      } else if (newTagLinkType === "url" && newTagUrl.trim()) {
        payload.link_url = newTagUrl.trim();
      }

      const res = await createTag(payload);
      const tag: RawTag = res.data;

      setAllTags((prev) => [...prev, tag]);

      // Attach to LOCAL selection; persistence happens on Save
      if (tag.link_department) {
        setSelectedDeptTagIds((prev) =>
          prev.includes(tag.id) ? prev : [...prev, tag.id]
        );
      } else {
        setSelectedManualTagIds((prev) =>
          prev.includes(tag.id) ? prev : [...prev, tag.id]
        );
      }

      resetCreateForm();
      setMode("manage");
    } catch (e: any) {
      setTagError(e?.message ?? "Failed to create tag");
    } finally {
      setTagLoading(false);
    }
  };

  // ------------- RENDER -------------
  if (!isOpen) return null;

  return (
    <div className="ks-modal-backdrop">
      <div className="ks-modal manage-tags-modal">
        <div className="ks-modal-header">
          <h3 className="ks-modal-title">
            {mode === "manage" ? "Manage tags" : "Create new tag"}
          </h3>
          <button
            type="button"
            className="ks-modal-close-btn"
            onClick={handleRequestClose}
          >
            Close
          </button>
        </div>

        {tagError && <p className="ks-modal-error">{tagError}</p>}
        {tagLoading && <p className="manage-tags-loading">Working…</p>}

        {mode === "manage" ? (
          <>
            {/* ---------------- MANAGE MODE ---------------- */}
            <div className="manage-tags-body-grid">
              {/* LEFT: CURRENT TAGS */}
              <section className="manage-tags-section">
                <h4>Current tags on this document</h4>
                <p className="manage-tags-help">
                  Manual and external tags can be removed here. Department tags
                  control which departments are associated with this document.
                </p>

                <input
                  type="text"
                  className="ks-modal-search-input"
                  placeholder="Search current tags…"
                  value={tagSearchCurrent}
                  onChange={(e) => setTagSearchCurrent(e.target.value)}
                />

                {filteredCurrentManualTags.length === 0 && (
                  <p className="manage-tags-muted">
                    No manual or external tags on this document yet.
                  </p>
                )}

                {filteredCurrentManualTags.length > 0 && (
                  <div className="ks-modal-chips-row">
                    {filteredCurrentManualTags.map((t: RawTag) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleDetachManualTag(t.id)}
                        className="tag-chip tag-chip--selected"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}

                {departmentTagsOnDoc.length > 0 && (
                  <div className="manage-tags-dept-section">
                    <h5>Department tags</h5>
                    <p className="manage-tags-subhelp">
                      Click to toggle: adding a department tag also adds that
                      department to the document; removing it removes the
                      department.
                    </p>
                    <div className="manage-tags-chips-row">
                      {departmentTagsOnDoc.map((t: RawTag) => {
                        const active = selectedDeptTagIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleToggleDeptTag(t.id)}
                            className={
                              "tag-chip " +
                              (active ? "tag-chip--selected" : "")
                            }
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="ks-btn-primary"
                  onClick={() => {
                    resetCreateForm();
                    setMode("create");
                  }}
                >
                  + Create new tag
                </button>
              </section>

              {/* RIGHT: ATTACH EXISTING TAGS (CATEGORIZED) */}
              <section className="manage-tags-section">
                <h4>Attach existing tags</h4>
                <p className="manage-tags-help">
                  These are tags already defined in this org. Department tags
                  here will also update the document&apos;s departments once you
                  save changes.
                </p>

                <input
                  type="text"
                  className="manage-tags-search"
                  placeholder="Search available tags…"
                  value={tagSearchExisting}
                  onChange={(e) => setTagSearchExisting(e.target.value)}
                />

                <div className="manage-tags-category">
                  <h5>Document tags</h5>
                  {documentTagsAvailable.length === 0 ? (
                    <p className="manage-tags-muted">None available.</p>
                  ) : (
                    <div className="manage-tags-chips-row">
                      {documentTagsAvailable.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleAttachExistingTag(t.id)}
                          className="tag-chip"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="manage-tags-category">
                  <h5>Department tags</h5>
                  {departmentTagsAvailable.length === 0 ? (
                    <p className="manage-tags-muted">None available.</p>
                  ) : (
                    <div className="manage-tags-chips-row">
                      {departmentTagsAvailable.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleAttachExistingTag(t.id)}
                          className="tag-chip"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="manage-tags-category">
                  <h5>External tags</h5>
                  {externalTagsAvailable.length === 0 ? (
                    <p className="manage-tags-muted">None available.</p>
                  ) : (
                    <div className="manage-tags-chips-row">
                      {externalTagsAvailable.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleAttachExistingTag(t.id)}
                          className="tag-chip"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="manage-tags-footer">
              <button
                type="button"
                className="manage-tags-primary-btn"
                onClick={handleSaveTagChanges}
                disabled={!hasUnsavedChanges || tagLoading}
              >
                {tagLoading ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        ) : (
          // ---------------- CREATE MODE ----------------
          <section className="manage-tags-section">
            <p className="manage-tags-help">
              New tags must always link somewhere: another document, a
              department, or an external URL. Department-linked tags will
              update this document&apos;s departments once you save. Collection
              tags are managed through collections themselves.
            </p>

            <form onSubmit={handleCreateTag} className="manage-tags-form">
              <input
                type="text"
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
              <textarea
                placeholder="Tag description (optional)"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                rows={2}
              />

              <label className="manage-tags-field-label">
                <span>Link type</span>
                <select
                  value={newTagLinkType}
                  onChange={(e) =>
                    setNewTagLinkType(e.target.value as NewTagLinkType)
                  }
                >
                  <option value="document">Document</option>
                  <option value="department">Department</option>
                  <option value="url">External URL</option>
                </select>
              </label>

              {newTagLinkType === "document" && (
                <>
                  <input
                    type="text"
                    placeholder="Search documents…"
                    value={linkDocSearch}
                    onChange={(e) => setLinkDocSearch(e.target.value)}
                  />
                  <div className="manage-tags-scroll-list">
                    {filteredDocsForLink.map((d) => (
                      <label key={d.id} className="manage-tags-radio-row">
                        <input
                          type="radio"
                          name="newTagDoc"
                          value={d.id}
                          checked={newTagTargetDocId === d.id}
                          onChange={() => setNewTagTargetDocId(d.id)}
                        />
                        {d.title}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {newTagLinkType === "department" && (
                <>
                  <input
                    type="text"
                    placeholder="Search departments…"
                    value={linkDeptSearch}
                    onChange={(e) => setLinkDeptSearch(e.target.value)}
                  />
                  <div className="manage-tags-scroll-list">
                    {filteredDeptsForLink.map((d) => (
                      <label key={d.id} className="manage-tags-radio-row">
                        <input
                          type="radio"
                          name="newTagDept"
                          value={d.id}
                          checked={newTagDepartmentId === d.id}
                          onChange={() => setNewTagDepartmentId(d.id)}
                        />
                        {d.name} ({d.slug})
                      </label>
                    ))}
                  </div>
                </>
              )}

              {newTagLinkType === "url" && (
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={newTagUrl}
                  onChange={(e) => setNewTagUrl(e.target.value)}
                />
              )}

              <div className="manage-tags-create-actions">
                <button
                  type="button"
                  className="ks-btn-secondary"
                  onClick={() => {
                    resetCreateForm();
                    setMode("manage");
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="manage-tags-primary-btn"
                  disabled={tagLoading}
                >
                  {tagLoading ? "Creating…" : "Create & attach"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
