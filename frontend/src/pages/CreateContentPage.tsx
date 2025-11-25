// src/pages/CreateContentPage.tsx
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "../components/KSModal.css";
import "./CreateContentPage.css";

type ModalProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  children: React.ReactNode;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
};

function SimpleModal({
  title,
  isOpen,
  onClose,
  onSubmit,
  children,
  submitLabel,
  submitting,
  error,
}: ModalProps) {
  if (!isOpen) return null;

  const handleRequestClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <div className="ks-modal-backdrop">
      <div className="ks-modal create-content-modal">
        <header className="ks-modal-header">
          <h3 className="ks-modal-title">{title}</h3>
          <button
            type="button"
            className="ks-modal-close-btn"
            onClick={handleRequestClose}
          >
            Close
          </button>
        </header>

        {error && <p className="ks-modal-error">{error}</p>}

        <form onSubmit={onSubmit}>
          <section className="ks-modal-body">{children}</section>

          <footer className="ks-modal-footer">
            <button
              type="button"
              className="ks-btn-secondary"
              onClick={handleRequestClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ks-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving…" : submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default function CreateContentPage() {
  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;
  const navigate = useNavigate();

  // Document modal state
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Collection modal state
  const [colOpen, setColOpen] = useState(false);
  const [colName, setColName] = useState("");
  const [colDescription, setColDescription] = useState("");
  const [colSubmitting, setColSubmitting] = useState(false);
  const [colError, setColError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <div className="page-wrapper create-content-page">
        <div className="page-header">
          <h1>Create content</h1>
        </div>

        <div className="info-card">
          <h2>Read-only access</h2>
          <p>
            You currently have read-only access in this organization. Ask an
            admin to grant you editor or admin permissions if you need to
            create documents or collections.
          </p>
        </div>
      </div>
    );
  }

  // Document handlers
  const handleOpenDoc = () => {
    setDocTitle("");
    setDocError(null);
    setDocOpen(true);
  };

  const handleSubmitDoc = async (e: FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      setDocError("Title is required.");
      return;
    }

    setDocSubmitting(true);
    setDocError(null);

    try {
      const res = await api.post("/documents/", {
        title: docTitle.trim(),
        status: "draft",
        everyone: true,
      });

      const doc = res.data;
      setDocOpen(false);

      if (doc && typeof doc.id === "number") {
        navigate(`/documents/${doc.id}`);
      } else {
        setDocError("Document created but response did not include an ID.");
      }
    } catch (err: any) {
      console.error("Failed to create document", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to create document.";
      setDocError(msg);
    } finally {
      setDocSubmitting(false);
    }
  };

  // Collection handlers
  const handleOpenCollection = () => {
    setColName("");
    setColDescription("");
    setColError(null);
    setColOpen(true);
  };

  const handleSubmitCollection = async (e: FormEvent) => {
    e.preventDefault();
    if (!colName.trim()) {
      setColError("Name is required.");
      return;
    }

    setColSubmitting(true);
    setColError(null);

    try {
      const res = await api.post("/collections/", {
        name: colName.trim(),
        description: colDescription.trim(),
      });

      const col = res.data;
      setColOpen(false);

      if (col && col.slug) {
        navigate(`/collections/${col.slug}`);
      } else if (col && col.id) {
        navigate(`/collections/${col.id}`);
      } else {
        navigate("/collections");
      }
    } catch (err: any) {
      console.error("Failed to create collection", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to create collection.";
      setColError(msg);
    } finally {
      setColSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper create-content-page">
      <div className="page-header">
        <h1>Create content</h1>
        <p className="page-subtitle">
          Start a new document or group existing docs into a collection so your
          team can find what they need.
        </p>
      </div>

      <div className="card-grid">
        <div className="tool-card">
          <h2>Create a document</h2>
          <p>
            Draft a new guide, SOP, or knowledge article. You can attach it to
            departments and collections after you create it.
          </p>
          <button className="ks-btn-primary" onClick={handleOpenDoc}>
            + New document
          </button>
        </div>

        <div className="tool-card">
          <h2>Create a collection</h2>
          <p>
            Group related documents into an onboarding flow, playbook, or
            project runbook.
          </p>
          <button className="ks-btn-primary" onClick={handleOpenCollection}>
            + New collection
          </button>
        </div>
      </div>

      {/* Document modal */}
      <SimpleModal
        title="Create a new document"
        isOpen={docOpen}
        onClose={() => setDocOpen(false)}
        onSubmit={handleSubmitDoc}
        submitLabel="Create document"
        submitting={docSubmitting}
        error={docError}
      >
        <div className="create-content-field">
          <span>Title</span>
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            autoFocus
          />
        </div>
      </SimpleModal>

      {/* Collection modal */}
      <SimpleModal
        title="Create a new collection"
        isOpen={colOpen}
        onClose={() => setColOpen(false)}
        onSubmit={handleSubmitCollection}
        submitLabel="Create collection"
        submitting={colSubmitting}
        error={colError}
      >
        <div className="create-content-field">
          <span>Name</span>
          <input
            type="text"
            value={colName}
            onChange={(e) => setColName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="create-content-field">
          <span>Description (optional)</span>
          <textarea
            rows={3}
            value={colDescription}
            onChange={(e) => setColDescription(e.target.value)}
            placeholder="Short summary of what this collection is for."
          />
        </div>
      </SimpleModal>
    </div>
  );
}
