
import './Sidebar.css';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <aside className="site-sidebar">
      <div className="sidebar-inner">

        {/* --- Search Bar at Top --- */}
        <form onSubmit={onSubmit} className="sidebar-search">
          <input
            type="search"
            placeholder="Search docs, tags, collections…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
          />
        </form>

        <h3>Sections</h3>
        <ul>
          <li><a href="/">Hold 1</a></li>
          <li><a href="/">Hold 2</a></li>
          <li><a href="/">Hold 3</a></li>
        </ul>

        <h3>Related</h3>
        <ul>
          <li><a href="/">Related 1</a></li>
          <li><a href="/">Related 2</a></li>
          <li><a href="/">Related 3</a></li>
        </ul>
      </div>
    </aside>
  );
}
