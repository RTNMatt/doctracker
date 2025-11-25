import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function NewDocumentPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createDocument() {
      try {
        setCreating(true);
        setError(null);

        // Minimal, safe defaults – user will edit on the normal Document page
        const res = await api.post("/documents/", {
          title: "Untitled document",
          status: "draft",
          everyone: true, // avoids department visibility validation issues
        });

        if (cancelled) return;
        const doc = res.data;

        if (doc && typeof doc.id === "number") {
          // Jump straight into the normal document view
          navigate(`/documents/${doc.id}`, { replace: true });
        } else {
          setError("Created a document, but did not receive an ID.");
          setCreating(false);
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error("Failed to create document", e);
        setError(e?.message ?? "Failed to create a new document.");
        setCreating(false);
      }
    }

    createDocument();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>Create a new document</h1>
      </div>

      {creating && !error && (
        <div className="info-card">
          <p>Creating a new draft document…</p>
          <p>This should only take a moment.</p>
        </div>
      )}

      {error && (
        <div className="info-card">
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => navigate("/documents")}
          >
            Back to documents
          </button>
        </div>
      )}
    </div>
  );
}
