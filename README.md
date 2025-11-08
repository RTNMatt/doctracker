# Knowledge Stack (formerly DocTracker)
A modern, fast, and structured knowledge management app for teams.

Knowledge Stack makes documentation easy to create, organize, search, and browse — without digging through shared drives, SharePoint jungles, or scattered notes.

---

## 🌐 Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | **React** + **Vite** (TypeScript) |
| Backend API | **Django** + **Django REST Framework** |
| Database | SQLite (local), **PostgreSQL recommended** for production |
| Styling | Custom CSS with theme variables (light-neutral UI) |
| Images | Handled with `Pillow` on backend |
| Search | Unified search across Documents, Collections, Departments, and Tags |

---

## 🧠 Core Concepts

| Entity | Description |
|-------|-------------|
| **Documents** | Content pages with rich text sections, optional images, and resource links. |
| **Collections** | Curated groups of documents. Collections can nest other collections (self-nesting prevented). Useful for onboarding sequences, playbooks, knowledge guides. |
| **Departments** | High-level organizational grouping (e.g., Network, HR, IT Service Desk). |
| **Tags** | Used for visual grouping and navigation. Includes automatic *structural tags*. |
| **Search** | Finds documents, collections, departments, or tags with relevance-scored snippets. |

---

## 🔖 Tags (Automatic + Manual)

Knowledge Stack uses a **smart tag system**:

| Tag Type | How It’s Created | Used For | Behavior |
|---------|------------------|---------|---------|
| **Department Tags** | Automatically created + maintained | Show which department a document belongs to | Added/removed when department membership changes |
| **Collection Tags** | Automatically created + maintained | Show collection membership | Added/removed when collection membership changes |
| **Document Link Tags** | Manually added | Quick jump to related internal documents | Clicking opens another document internally |
| **External Link Tags** | Manually added | Point to resources like vendor docs / URLs | Clicking opens a new tab |

### Display Behavior
Tags are grouped on the document page into:

- **Related Areas** (Departments & Collections)
- **Related Documents**
- **External Resources**

Each group uses **distinct colors and matching outlines** for readability.

---

## 🖥️ UI Layout

- **Left Sidebar**
  - Search
  - Navigation
  - Department / Collection access
  - User avatar & settings (avatar upload planned)

- **Main Content**
  - Tile-based browsing
  - Clean and responsive document layout:
    - One-column when no images
    - Two-column when images are present
  - Tag chips displayed at the top with color-coded grouping

- **Brand**
  - Name: **Knowledge Stack**
  - Palette: soft corporate light-mode theme
  - Easily themeable via CSS variables

---

## 🚀 Getting Started (Development)

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
| Feature                                            | Status               |
| -------------------------------------------------- | -------------------- |
| Nested collections (self-nesting prevented)        | ✅ Done               |
| Unified search across all knowledge objects        | ✅ Done               |
| Clean light corporate UI theme                     | ✅ Done               |
| Sidebar + tile-based navigation                    | ✅ Done               |
| **Automatic department & collection tag creation** | ✅ Done               |
| **Auto tag add/remove based on membership**        | ✅ Done               |
| Tag grouping + color-coded chips                   | ✅ Done               |
| User profile uploads                               | 🔜 Planned           |
| Dark mode themes                                   | 🔜 Planned           |
| Access control & sharing modes                     | 🔜 Planned           |
| Multi-tenant support                               | Future consideration |


## 🏢 Intended Use Cases

Internal IT knowledge base

Employee onboarding & training

Customer support runbooks

SOP / operating procedures

Team playbooks and project guides

## 📄 License

Internal/Personal use for now — license model TBD.