# DocTracker

A lightweight documentation tracker for technical teams.  
It helps create consistent documentation (colors, fonts, headers), tag docs by service, search them easily, and track how up-to-date they are.

---

## 🚀 Features (planned)
- Create documentation from templates with consistent layout and style  
- Tag documents by service or product  
- Search through titles, tags, and content  
- Track when documents become stale or need review  
- Export documents as HTML or PDF

---

## 🧱 Stack
- **Backend:** Django + Django REST Framework  
- **Database:** SQLite (for local dev; can switch to MySQL/Postgres later)  
- **Frontend:** React (Vite) — to be added later  
- **Search:** Simple DB search (future: OpenSearch or Elasticsearch)

---

## 💻 Local Setup (Windows 11)

```powershell
# Create a virtual environment
py -3 -m venv .venv

# Activate it
.\.venv\Scripts\Activate.ps1

# Install dependencies
py -m pip install --upgrade pip
py -m pip install django djangorestframework

# Start the backend
cd backend
py manage.py migrate
py manage.py runserver
