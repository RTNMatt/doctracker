# Knowledge Stack — Roadmap & Development Plan

This document outlines the major feature areas for Knowledge Stack and the recommended order of implementation to minimize rework and ensure a scalable, maintainable product foundation.

---

## 🧱 Backlog (Feature Groups)

### A) Foundations & Architecture
- Remove unused screens / dead code (ex: Requirements page)
- Seed demo data for testing + marketing screenshots
- Standardize loading / empty / error states
- Add basic smoke tests (models, serializers, API)
- **Refine UI layout & spacing for documents, tags, collections** (new)
- **Improve modal UX consistency (tags, collections, future editors)** (new)

---

### B) Auth, Users, Roles, Access Control
- User authentication (session or JWT in HttpOnly cookie)
- User roles: **Admin**, **Editor**, **Viewer**
- **Visibility toggle (`everyone=true/false`) on documents** — *partially implemented*
- **Require at least one department when `everyone=false`** — *planned next*
- Organization / tenant structure (enables custom branding)
- Two-Factor Authentication (TOTP)
- Email verification & password reset flows

---

### C) Content Management (In-App Authoring)
- Create / Edit / Delete:
  - **Documents (sections, images, links)** — *completed*
  - **Departments** — *completed*
  - **Collections** — *completed*
  - Document Templates
- **Unified document metadata saving (title/status/visibility)** — *implemented*
- **Manage Tags modal (full CRUD except structural)** — *completed*
- **Manage Collections modal (+ create & attach)** — *completed*
- **Autosave warnings for unsaved metadata** — *implemented*
- Rich Text / Markdown editing
- Draft → Publish workflow
- Version history & change tracking
- Soft delete / archive & restore

---

### D) Review & Governance
- Staleness indicator (ex: “Needs Review” after 180 days)
- Review queue dashboard
- “Mark Reviewed” action
- Audit log (who changed what & when)
- Optional approval step before publishing

---

### E) Discovery & Navigation Enhancements
- **Unified search across documents/departments/collections** — *completed*
- Search filters (type / department / collection / tag)
- Improved search UI + sorting options
- Keyboard shortcuts (quick search)
- Client-side caching and pagination polish
- **Sidebar Path Tree for breadcrumb-like navigation** — *completed*

---

### F) Theming & Branding
- Token-based theme system (light/dark + primary accent)
- User-selectable theme presets
- Per-organization branding support:
  - Logo
  - Color palette
  - Possibly favicon / email theme
- Guardrails for accessibility (contrast, WCAG AA)

---

### G) Integrations
- Import from:
  - Google Drive (read-only at first)
  - OneDrive / SharePoint
- Link metadata preview (title/snippet)
- Webhooks for document updates (future)

---

### H) Security & Compliance
- Rate limiting & brute-force protection
- Session / device management UI (logout per device)
- Secure permissions on media file access
- Error logging / monitoring (Sentry, etc.)

---

### I) Ops & Deployment
- CI pipeline (lint, typecheck, tests)
- Staging environment
- Static & media storage (S3, DigitalOcean Spaces, etc.)
- Database backups & migration checklist

---

### J) Marketing Website (Separate Site)
- Landing page explaining:
  - Value proposition
  - Feature tour
  - Screenshots / demo video
- “Try Demo” button linking to a sandbox org
- Pricing tiers (Solo / Team / Enterprise)
- Email capture or waitlist

---

### K) Collaboration & Social Features *(Later Phase)*
- Comments on documents
- @mentions with notifications
- Public “view-only” document share links (with expiry)

---

### L) Authoring Quality & Export
- Document templates + “Create from Template”
- Export to PDF / print-friendly layout

---

### M) Insights & Quality Assurance
- Analytics: document views, search terms, stale rate
- Accessibility & keyboard navigation pass
- I18n / multi-language support (optional)

---

