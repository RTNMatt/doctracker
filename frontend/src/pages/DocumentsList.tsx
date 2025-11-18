import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DocumentsList() {
  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>Content</h1>
      </div>

      {!canEdit && (
        <div className="info-card">
          <h2>Browse Knowledge</h2>
          <p>
            You currently have read-only access in this organization.
            Use <strong>Departments</strong>, <strong>Collections</strong>, or{" "}
            <strong>Search</strong> to find the documentation you need.
          </p>
        </div>
      )}

      {canEdit && (
        <div className="card-grid">
          <div className="tool-card">
            <h2>Create a new document</h2>
            <p>
              Start a new guide, SOP, or knowledge article. You can later attach it
              to departments and collections.
            </p>
            <Link to="/documents/new" className="button-primary">
              + New Document
            </Link>
          </div>

          {/* Placeholder for when you’re ready to add collection creation */}
          <div className="tool-card tool-card--disabled">
            <h2>Create a new collection</h2>
            <p>
              Group documents into an onboarding flow, playbook, or project guide.
              (Coming soon)
            </p>
            <button className="button-secondary" disabled>
              Coming soon
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
