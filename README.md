# Knowledge Stack (formerly DocTracker)
A modern, fast, structured knowledge-management system for teams.

Knowledge Stack makes documentation easy to **create**, **organize**, **search**, **edit**, and **navigate**—without the chaos of shared drives, SharePoint, or outdated wiki tools.

---

## 🌐 Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | **React + Vite** (TypeScript) |
| Backend API | **Django 5** + **Django REST Framework** |
| Database | SQLite (local dev) — **PostgreSQL recommended** for production |
| Styling | Custom CSS with design tokens (`--brand`, `--text`, etc.) |
| Images | Uploaded via Django + Pillow |
| Auth | Session-based auth w/ role support (`Admin`, `Editor`, `Viewer`) |
| Search | Unified cross-entity search (Documents, Collections, Departments, Tags) |

---

## 🧠 Core Concepts

### **Documents**
- Multi-section pages
- Markdown/plain-text body
- Optional images per section
- Inline links (external or internal)
- Tag bar for contextual navigation
- Supports **draft/edit** mode with autosave warning
- Restrict visibility to **everyone** or **specific departments**

### **Collections**
- Group related documents
- Nested collections supported (no self-nesting)
- Auto-created *structural tags*
- Collection membership editable via modal
- Automatically updates the document’s tags

### **Departments**
- Organizational categories (IT, HR, etc.)
- Documents inherit *department tags* automatically
- Department pages list all associated documents

### **Tags**
Two categories:

| Tag Type | Created/Edited | Purpose |
|---------|----------------|---------|
| **Structural tags** | Auto-maintained | Represent department + collection membership |
| **Manual tags** | User-managed | Related documents, URLs, etc. |

Grouped visually on the Document Page as:
- **Related Areas** (Collections + Departments)
- **Related Documents**
- **External Resources**

### **Tag Colors**
- Department: Pale blue
- Collection: Mint green
- Document: Warm gold
- External link: Purple
*(Includes matching outline highlights)*

---

## 🧭 Navigation + Path Tree

The left sidebar includes:
- Search
- Documents
- Collections
- Departments
- Home
- Dynamic Path Tree (click trail)

**Path Tree Behavior**
- Automatically records route chain
- Clicking a previous node rewinds the navigation branch
- Navigating “Home / Departments / Collections / Documents” resets tree

---

## 🧩 Document Editing Mode

Document editing includes:

- Title editing
- Status (“active”, “draft”, etc.)
- Toggle visibility (**everyone** vs restricted)
- Ensure restricted docs have at least **one department**
- Add/edit/remove:
  - Sections (header, body, image)
  - Inline links
- Manage Tags (modal)
  - Manual tags editable
  - Structural tags locked
- Manage Collections (modal)
  - Add/remove collection membership
  - Create collections from modal
- Autosave-warning if closing with unsaved doc-level changes
- “Save Document” only patches top-level metadata

Tags & Collections update live through their modals.

---

## 🚀 Getting Started

### 1. Clone repo
```sh
git clone <repo-url>
cd knowledge-stack
```

### 2. Clone repo
```sh
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Backend Runs at:
http://localhost:8000

### 3. Setup frontend
```sh
cd frontend
npm install
npm run dev
```
### Backend Runs at:
http://localhost:5173


## 🔍 Search

Search supports:

Document titles

Section body text

Resource link title / notes / URLs

Collection names + descriptions

Department names + slugs

Tag names + descriptions

Search returns normalized results with:
```sh
{
  "kind": "document" | "collection" | "department" | "tag",
  "title": "...",
  "snippet": "..."
}
```

## 🔧 Roadmap

| Feature                                                     | Status               |
| ----------------------------------------------------------- | -------------------- |
| Nested collections (self-nesting prevented)                 | ✅ Done               |
| Unified search across all knowledge objects                 | ✅ Done               |
| Clean light corporate UI theme                              | ✅ Done               |
| Sidebar + tile-based navigation                             | ✅ Done               |
| **Automatic department & collection tag creation**          | ✅ Done               |
| **Auto tag add/remove based on membership**                 | ✅ Done               |
| Tag grouping + color-coded chips on document pages          | ✅ Done               |
| **Sidebar Path Tree (context trail navigation)**            | ✅ Done               |
| **Departments & Collections top-level browse pages**        | ✅ Done               |
| **Manage Tags modal (manual tag assignment UI)**            | ✅ Done               |
| **Manage Collections modal (multi-select, create, remove)** | ✅ Done               |
| **Document edit mode with Save/Discard + warnings**         | ✅ Done               |
| **Autosave protection (browser navigation warning)**        | ✅ Done               |
| User profile uploads                                        | 🔜 Planned           |
| Dark mode themes                                            | 🔜 Planned           |
| Access control & sharing modes                              | 🔜 Planned           |
| **Document visibility rules (everyone vs dept-restricted)** | 🔜 In Progress       |
| **Role system (Admin, Editor, Viewer)**                     | 🔜 Planned           |
| Versioning & draft/published states                         | 🔜 Planned           |
| Multi-tenant support                                        | Future consideration |




## 🏢 Intended Use Cases

Internal IT knowledge base

Employee onboarding & training

Customer support runbooks

SOP / operating procedures

Team playbooks and project guides

## 📄 License

Internal/Personal use for now — license model TBD.