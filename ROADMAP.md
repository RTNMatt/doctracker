# Knowledge Stack — Roadmap & Development Plan

This document outlines the major feature areas for Knowledge Stack and the recommended order of implementation to minimize rework and ensure a scalable, maintainable product foundation.

---

## 🧱 Backlog (Feature Groups)

### A) Foundations & Architecture
- Remove unused screens / dead code (ex: Requirements page)
- Seed demo data for testing + marketing screenshots
- Standardize loading / empty / error states
- Add basic smoke tests (models, serializers, API)

---

### B) Auth, Users, Roles, Access Control
- User authentication (session or JWT in HttpOnly cookie)
- User roles: **Admin**, **Editor**, **Viewer**
- Enforce document visibility (`everyone=false` → restricted)
- Organization / tenant structure (enables custom branding)
- Two-Factor Authentication (TOTP)
- Email verification & password reset flows

---

### C) Content Management (In-App Authoring)
- Create / Edit / Delete:
  - Documents
  - Departments
  - Collections
  - Document Templates
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
- Search filters (type / department / collection / tag)
- Improved search UI + sorting options
- Keyboard shortcuts (quick search)
- Client-side caching and pagination polish

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

## ✅ Recommended Build Order (Minimizing Rework)

1. **Auth + Roles + Document Visibility**
2. **In-App Authoring UI + Draft/Publish + Versioning**
3. **Staleness / Review Workflow + Audit Logging**
4. **Theme Token System + Org Branding Controls**
5. **Search Filtering & Navigation Polishing**
6. **Security Hardening + Password Reset + 2FA**
7. **Drive/OneDrive Import Integrations**
8. **Deployment Infrastructure + Staging Environment**
9. **Marketing Website**
10. **Comments / @mentions / Share Links**
11. **Templates + PDF Export**
12. **Analytics + Accessibility + i18n**

---

## 🎯 Current Next Step
Begin **Step 1: Auth & RBAC Foundation**
- Add user login + roles
- Enforce document visibility rules in the API
- Add frontend session awareness (sign in / sign out)

---
