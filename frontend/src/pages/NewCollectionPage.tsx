import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { usePathTree } from "../state/PathTree";
import { useAuth } from "../context/AuthContext";

type SimpleCollection = {
  id: number;
  name: string;
  slug: string;
};

export default function NewCollectionPage() {
  const navigate = useNavigate();
  const { resetTo } = usePathTree();
  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);

  const [allCollections, setAllCollections] = useState<SimpleCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // path tree: “Collections / New Collection”
  useEffect(() => {
    resetTo({
      kind: "index",
      name: "Collections",
      url: "/collections",
    });
  }, [resetTo]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingCollections(true);
        const res = await api.get("/collections/");
        if (!alive) return;

        const data = Array.isArray(res.data)
          ? res.data
          : res.data.results ?? [];

        setAllCollections(
          data.map((c: any) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
          }))
        );
      } catch (e: any) {
        // soft-fail: we can still create a collection without a parent
        console.error("Failed to load collections", e);
      } finally {
        if (alive) setLoadingCollections(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!canEdit) {
    return (
      <div className="page-wrapper">
        <div className="page-header">
          <h1>New Collection</h1>
        </div>
        <div className="info-card">
          <h2>Insufficient permissions</h2>
          <p>
            Only admins and editors can create collections. Please contact an
            administrator if you need a new collection.
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
      };

      if (slug.trim()) {
        payload.slug = slug.trim();
      }

      if (parentId != null) {
        payload.parent = parentId;
      }

      const res = await api.post("/collections/", payload);

      const created = res.data;
      if (created && created.slug) {
        navigate(`/collections/${created.slug}`);
      } else if (created && created.id) {
        navigate(`/collections/${created.id}`);
      } else {
        navigate("/collections");
      }
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to create collection.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleNameBlur() {
    if (!slug.trim() && name.trim()) {
      const generated = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setSlug(generated);
    }
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>New Collection</h1>
      </div>

      <div className="info-card">
        <p>
          Collections group related documents into curated flows, like
          onboarding, project runbooks, or playbooks.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="doc-edit-form"
        style={{ maxWidth: 640 }}
      >
        {error && (
          <p style={{ color: "var(--danger, #b00020)", marginBottom: 16 }}>
            {error}
          </p>
        )}

        <label className="doc-field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            required
          />
        </label>

        <label className="doc-field">
          <span>Slug (optional)</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="onboarding-it, project-alpha, etc."
          />
          <small className="doc-help-text">
            Used in the URL. Leave blank to auto-generate from the name.
          </small>
        </label>

        <label className="doc-field">
          <span>Description (optional)</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary of what this collection is for."
          />
        </label>

        <label className="doc-field">
          <span>Parent collection (optional)</span>
          <select
            value={parentId ?? ""}
            onChange={(e) =>
              setParentId(e.target.value ? Number(e.target.value) : null)
            }
            disabled={loadingCollections}
          >
            <option value="">No parent (top-level)</option>
            {allCollections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <small className="doc-help-text">
            Nest this collection under an existing one. Self-nesting and cycles
            are prevented on the backend.
          </small>
        </label>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 12,
            justifyContent: "flex-start",
          }}
        >
          <button
            type="submit"
            className="ks-btn-primary"
            disabled={saving}
          >
            {saving ? "Creating…" : "Create collection"}
          </button>
          <button
            type="button"
            className="ks-btn-secondary"
            onClick={() => navigate("/collections")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
