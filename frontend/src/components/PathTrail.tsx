import { useNavigate, useLocation } from "react-router-dom";
import { usePathTree } from "../state/PathTree";

export default function PathTrail() {
  const { path, trimTo } = usePathTree();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (path.length === 0) return null;

  return (
    <div className="pathtrail">
      {path.map((n, i) => {
        const active = n.url === pathname || i === path.length - 1;
        return (
          <div key={n.url} className={`pt-item ${active ? "is-active" : ""}`}>
            <button
              className="pt-chip"
              onClick={() => { trimTo(n.url); navigate(n.url); }}
              title={n.name}
              aria-current={active ? "page" : undefined}
            >
              <span className={`pt-dot kind-${n.kind}`} />
              <span className="pt-label">{n.name}</span>
            </button>
            {i < path.length - 1 && <div className="pt-connector" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
