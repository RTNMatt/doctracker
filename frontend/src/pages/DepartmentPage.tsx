import { useParams, Link } from "react-router-dom";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { api } from "../lib/api";
import { usePathTree } from "../state/PathTree";
import { useAuth } from "../context/AuthContext";
import "./DepartmentPage.css";

type Department = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type Collection = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type Doc = {
  id: number;
  title: string;
  status?: string | null;
  summary?: string | null;
};

type Member = {
  user: {
    id: number;
    username: string;
  };
  preferred_name?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  departments: number[];
};

export default function DepartmentPage() {
  const { slug } = useParams();
  const { enter } = usePathTree();
  const { isAdmin } = useAuth();
  const canManageDept = isAdmin;

  const [dept, setDept] = useState<Department | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // description editing
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descSaving, setDescSaving] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);

  // member editing
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(true);

  // scrollers
  const collectionsScrollerRef = useRef<HTMLDivElement | null>(null);
  const docsScrollerRef = useRef<HTMLDivElement | null>(null);
  const membersScrollerRef = useRef<HTMLDivElement | null>(null);

  const [collectionsCanScrollLeft, setCollectionsCanScrollLeft] = useState(false);
  const [collectionsCanScrollRight, setCollectionsCanScrollRight] = useState(false);

  const [docsCanScrollLeft, setDocsCanScrollLeft] = useState(false);
  const [docsCanScrollRight, setDocsCanScrollRight] = useState(false);

  const [membersCanScrollUp, setMembersCanScrollUp] = useState(false);
  const [membersCanScrollDown, setMembersCanScrollDown] = useState(false);

  const [collectionSearch, setCollectionSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");

  // -----------------
  // Load department + related
  // -----------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug) return;
      setLoading(true);
      setErr(null);

      try {
        const [deptRes, docsRes, colRes, memRes] = await Promise.all([
          api.get(`/departments/${slug}/`),
          api.get(`/departments/${slug}/documents/`),
          api.get(`/departments/${slug}/collections/`),
          api.get(`/departments/${slug}/members/`),
        ]);

        if (cancelled) return;

        const deptData = deptRes.data as Department;
        setDept(deptData);
        setDescriptionDraft(deptData.description || "");

        setDocs((docsRes.data.results ?? docsRes.data) as Doc[]);
        setCollections((colRes.data.results ?? colRes.data) as Collection[]);
        setMembers((memRes.data.results ?? memRes.data) as Member[]);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? "Failed to load department");
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

  // breadcrumbs
  useEffect(() => {
    if (dept) {
      enter({
        kind: "department",
        name: dept.name,
        url: `/departments/${dept.slug}`,
      });
    }
  }, [dept, enter]);

  // -----------------
  // Scroll arrow helpers
  // -----------------
  const updateHorizontalArrows = useCallback(
    (
      ref: { current: HTMLDivElement | null },
      setLeft: (v: boolean) => void,
      setRight: (v: boolean) => void
    ) => {
      const el = ref.current;
      if (!el) {
        setLeft(false);
        setRight(false);
        return;
      }
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setLeft(scrollLeft > 0);
      setRight(scrollLeft + clientWidth < scrollWidth - 1);
    },
    []
  );

  useEffect(() => {
    updateHorizontalArrows(
      collectionsScrollerRef,
      setCollectionsCanScrollLeft,
      setCollectionsCanScrollRight
    );
  }, [collections, updateHorizontalArrows]);

  useEffect(() => {
    updateHorizontalArrows(
      docsScrollerRef,
      setDocsCanScrollLeft,
      setDocsCanScrollRight
    );
  }, [docs, updateHorizontalArrows]);

  const updateVerticalArrows = useCallback(
    (
      ref: { current: HTMLDivElement | null },
      setUp: (v: boolean) => void,
      setDown: (v: boolean) => void
    ) => {
      const el = ref.current;
      if (!el) {
        setUp(false);
        setDown(false);
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = el;
      setUp(scrollTop > 0);
      setDown(scrollTop + clientHeight < scrollHeight - 1);
    },
    []
  );

  useEffect(() => {
    const handleResize = () => {
      updateHorizontalArrows(
        collectionsScrollerRef,
        setCollectionsCanScrollLeft,
        setCollectionsCanScrollRight
      );
      updateHorizontalArrows(
        docsScrollerRef,
        setDocsCanScrollLeft,
        setDocsCanScrollRight
      );
      updateVerticalArrows(
        membersScrollerRef,
        setMembersCanScrollUp,
        setMembersCanScrollDown
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateHorizontalArrows, updateVerticalArrows]);

  useEffect(() => {
    const colEl = collectionsScrollerRef.current;
    const docsEl = docsScrollerRef.current;
    const memEl = membersScrollerRef.current;

    const handleColScroll = () =>
      updateHorizontalArrows(
        collectionsScrollerRef,
        setCollectionsCanScrollLeft,
        setCollectionsCanScrollRight
      );
    const handleDocsScroll = () =>
      updateHorizontalArrows(
        docsScrollerRef,
        setDocsCanScrollLeft,
        setDocsCanScrollRight
      );
    const handleMembersScroll = () =>
      updateVerticalArrows(
        membersScrollerRef,
        setMembersCanScrollUp,
        setMembersCanScrollDown
      );

    if (colEl) colEl.addEventListener("scroll", handleColScroll);
    if (docsEl) docsEl.addEventListener("scroll", handleDocsScroll);
    if (memEl) memEl.addEventListener("scroll", handleMembersScroll);

    return () => {
      if (colEl) colEl.removeEventListener("scroll", handleColScroll);
      if (docsEl) docsEl.removeEventListener("scroll", handleDocsScroll);
      if (memEl) memEl.removeEventListener("scroll", handleMembersScroll);
    };
  }, [updateHorizontalArrows, updateVerticalArrows]);

  const scrollHorizontal = (
    ref: { current: HTMLDivElement | null },
    direction: "left" | "right"
  ) => {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const makeHorizontalWheelHandler = (
    ref: { current: HTMLDivElement | null }
  ) => (e: React.WheelEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;

    // If user mostly scrolls vertically, use that to scroll horizontally
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollBy({
        left: e.deltaY,
        behavior: "auto",
      });
      e.preventDefault();
    }
  };

  const scrollVertical = (
    ref: { current: HTMLDivElement | null },
    direction: "up" | "down"
  ) => {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientHeight * 0.8;
    el.scrollBy({
      top: direction === "up" ? -amount : amount,
      behavior: "smooth",
    });
  };

  // -----------------
  // Description editing
  // -----------------
  const startEditDescription = () => {
    if (!dept) return;
    setDescriptionDraft(dept.description || "");
    setDescError(null);
    setIsEditingDescription(true);
  };

  const cancelEditDescription = () => {
    setIsEditingDescription(false);
    setDescError(null);
    if (dept) {
      setDescriptionDraft(dept.description || "");
    }
  };

  const handleSaveDescription = async (e: FormEvent) => {
    e.preventDefault();
    if (!dept || !slug) return;

    try {
      setDescSaving(true);
      setDescError(null);
      const { data } = await api.patch(`/departments/${slug}/`, {
        description: descriptionDraft,
      });
      setDept((prev) => (prev ? { ...prev, description: data.description } : prev));
      setIsEditingDescription(false);
    } catch (error: any) {
      setDescError(error?.message ?? "Failed to save description");
    } finally {
      setDescSaving(false);
    }
  };

  // -----------------
  // Member editing
  // -----------------
  const handleRemoveMember = async (member: Member) => {
    if (!slug || !canManageDept) return;
    try {
      setMembersError(null);
      await api.post(`/departments/${slug}/members/`, {
        action: "remove",
        user_id: member.user.id,
      });
      setMembers((prev) =>
        prev.filter((m) => m.user.id !== member.user.id)
      );
    } catch (error: any) {
      setMembersError(error?.message ?? "Failed to update members");
    }
  };

  const handleAddMemberSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!slug || !canManageDept) return;
    if (!addUsername.trim()) return;

    try {
      setAddSaving(true);
      setMembersError(null);
      const { data } = await api.post(`/departments/${slug}/members/`, {
        action: "add",
        username: addUsername.trim(),
      });
      // If this user is already present, replace; otherwise append
      setMembers((prev) => {
        const idx = prev.findIndex((m) => m.user.id === data.user.id);
        if (idx === -1) return [...prev, data];
        const copy = [...prev];
        copy[idx] = data;
        return copy;
      });
      setAddUsername("");
      setIsAddingMember(false);
    } catch (error: any) {
      setMembersError(error?.response?.data?.detail ?? error?.message ?? "Failed to add member");
    } finally {
      setAddSaving(false);
    }
  };

  // -----------------
  // Searching / filtering
  // -----------------
  const normalizedCollectionSearch = collectionSearch.trim().toLowerCase();
  const normalizedDocSearch = docSearch.trim().toLowerCase();

  const filteredCollections = collections.filter((c) => {
    if (!normalizedCollectionSearch) return true;
    const haystack = `${c.name ?? ""} ${c.description ?? ""}`;
    return haystack.toLowerCase().includes(normalizedCollectionSearch);
  });

  const filteredDocs = docs.filter((d) => {
    if (!normalizedDocSearch) return true;
    const parts = [d.title ?? "", d.summary ?? "", d.status ?? ""];
    return parts.some((part) =>
      part.toLowerCase().includes(normalizedDocSearch)
    );
  });

  // -----------------
  // Render
  // -----------------
  if (loading) {
    return <p>Loading department…</p>;
  }

  if (err) {
    return <p style={{ color: "red" }}>{err}</p>;
  }

  if (!dept) {
    return <p>Department not found.</p>;
  }

  return (
  <div className="department-page">
      <div className="department-layout">
        {/* LEFT / MAIN COLUMN */}
        <main className="department-main">
          <header className="department-header department-header--main">
            <h1 className="department-title">{dept.name}</h1>
          </header>

          <section className="department-description-card">
            <div className="department-description-header-row">
              {canManageDept && !isEditingDescription && (
                <button
                  type="button"
                  className="ks-btn-secondary dept-edit-desc-btn"
                  onClick={startEditDescription}
                >
                  Edit description
                </button>
              )}
            </div>

            {isEditingDescription ? (
              <form onSubmit={handleSaveDescription}>
                <textarea
                  className="department-description-input"
                  placeholder="Describe what this department owns and who it's for…"
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={4}
                />
                {descError && (
                  <p className="dept-error-text">{descError}</p>
                )}
                <div className="dept-inline-buttons">
                  <button
                    type="submit"
                    className="ks-btn-primary"
                    disabled={descSaving}
                  >
                    {descSaving ? "Saving…" : "Save description"}
                  </button>
                  <button
                    type="button"
                    className="ks-btn-secondary"
                    onClick={cancelEditDescription}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p
                className={
                  "department-description-text" +
                  (!dept.description ? " department-description-empty" : "")
                }
              >
                {dept.description
                  ? dept.description
                  : "No description has been added for this department yet."}
              </p>
            )}
          </section>

          {/* Collections carousel in a big tile */}
          <section className="department-section">
            <div className="department-section-header">
              <h2 className="department-section-title">Collections</h2>
            </div>
            <div className="department-section-search">
              <input
                type="text"
                className="department-section-search-input"
                placeholder="Search collections…"
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
              />
            </div>
            <div className="department-carousel-wrapper">
              {collectionsCanScrollLeft && (
                <button
                  type="button"
                  className="dept-scroll-arrow dept-scroll-arrow-left"
                  onClick={() =>
                    scrollHorizontal(collectionsScrollerRef, "left")
                  }
                  aria-label="Scroll collections left"
                >
                  ‹
                </button>
              )}
              <div
                className="dept-carousel"
                ref={collectionsScrollerRef}
                onWheel={makeHorizontalWheelHandler(collectionsScrollerRef)}
              >
                {filteredCollections.length ? (
                  <div className="dept-card-grid">
                    {filteredCollections.map((c) => (
                      <Link
                        key={c.id}
                        to={`/collections/${c.slug}`}
                        className="dept-card"
                      >
                        <div className="dept-card-title">{c.name}</div>
                        {c.description && (
                          <div className="dept-card-body">
                            {c.description}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="dept-empty-state">
                    <p>No collections found.</p>
                  </div>
                )}
              </div>
              {collectionsCanScrollRight && (
                <button
                  type="button"
                  className="dept-scroll-arrow dept-scroll-arrow-right"
                  onClick={() =>
                    scrollHorizontal(collectionsScrollerRef, "right")
                  }
                  aria-label="Scroll collections right"
                >
                  ›
                </button>
              )}
            </div>
          </section>

          {/* Documents carousel in a big tile */}
          <section className="department-section">
            <div className="department-section-header">
              <h2 className="department-section-title">Documents</h2>
            </div>
            <div className="department-section-search">
              <input
                type="text"
                className="department-section-search-input"
                placeholder="Search documents…"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
              />
            </div>
            <div className="department-carousel-wrapper">
              {docsCanScrollLeft && (
                <button
                  type="button"
                  className="dept-scroll-arrow dept-scroll-arrow-left"
                  onClick={() => scrollHorizontal(docsScrollerRef, "left")}
                  aria-label="Scroll documents left"
                >
                  ‹
                </button>
              )}
              <div
                className="dept-carousel"
                ref={docsScrollerRef}
                onWheel={makeHorizontalWheelHandler(docsScrollerRef)}
              >
                {filteredDocs.length ? (
                  <div className="dept-card-grid">
                    {filteredDocs.map((d) => (
                      <Link
                        key={d.id}
                        to={`/documents/${d.id}`}
                        className="dept-card"
                      >
                        <div className="dept-card-title">{d.title}</div>
                        {d.summary && (
                          <div className="dept-card-body">{d.summary}</div>
                        )}
                        {d.status && (
                          <div className="dept-card-meta">
                            <span className="dept-doc-status">
                              {d.status.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="dept-empty-state">
                    <p>No documents found.</p>
                  </div>
                )}
              </div>
              {docsCanScrollRight && (
                <button
                  type="button"
                  className="dept-scroll-arrow dept-scroll-arrow-right"
                  onClick={() => scrollHorizontal(docsScrollerRef, "right")}
                  aria-label="Scroll documents right"
                >
                  ›
                </button>
              )}
            </div>
          </section>
        </main>

        {/* RIGHT COLUMN: MEMBERS */}
        <aside className="department-members-column">
          <div className="department-members-header">
            <h2 className="department-section-title">Team members</h2>
            {canManageDept && (
              <button
                type="button"
                className="ks-btn-secondary dept-add-member-toggle"
                onClick={() => setIsAddingMember((v) => !v)}
              >
                {isAddingMember ? "Cancel" : "Add member"}
              </button>
            )}
          </div>

          {isAddingMember && canManageDept && (
            <form
              className="department-add-member-form"
              onSubmit={handleAddMemberSubmit}
            >
              <input
                type="text"
                className="department-add-member-input"
                placeholder="Username to add to this department"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
              />
              <button
                type="submit"
                className="ks-btn-primary"
                disabled={addSaving}
              >
                {addSaving ? "Adding…" : "Add"}
              </button>
            </form>
          )}

          {membersError && (
            <p className="dept-error-text dept-error-text-members">
              {membersError}
            </p>
          )}

          <div className="department-members-wrapper">
            {membersCanScrollUp && (
              <button
                type="button"
                className="dept-vertical-arrow dept-vertical-arrow-top"
                onClick={() => scrollVertical(membersScrollerRef, "up")}
                aria-label="Scroll members up"
              >
                ▲
              </button>
            )}
            <div className="department-members-list" ref={membersScrollerRef}>
              {members.length ? (
                members.map((m) => {
                  const displayName =
                    m.preferred_name || m.user.username || "Unknown user";
                  const initials =
                    displayName
                      .split(" ")
                      .filter(Boolean)
                      .map((part) => part[0]?.toUpperCase())
                      .slice(0, 2)
                      .join("") || "U";

                  return (
                    <div className="department-member-card" key={m.user.id}>
                      <div className="department-member-avatar">
                        {initials}
                      </div>
                      <div className="department-member-info">
                        <div className="department-member-name">
                          {displayName}
                        </div>
                        {m.job_title && (
                          <div className="department-member-role">
                            {m.job_title}
                          </div>
                        )}
                      </div>
                      {canManageDept && (
                        <button
                          type="button"
                          className="ks-btn-secondary dept-remove-member-btn"
                          onClick={() => handleRemoveMember(m)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="dept-empty-state dept-empty-state--members">
                  <p>No members have been added to this department yet.</p>
                </div>
              )}
            </div>
            {membersCanScrollDown && (
              <button
                type="button"
                className="dept-vertical-arrow dept-vertical-arrow-bottom"
                onClick={() => scrollVertical(membersScrollerRef, "down")}
                aria-label="Scroll members down"
              >
                ▼
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
