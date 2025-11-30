# docs/views.py
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import (
    Department, Template, Document, Section, ResourceLink, Tag,
    RequirementSnippet, Collection, Tile, DocumentVersion, UserTheme,
    UserProfile,
)
from .serializers import (
    DepartmentSerializer, TemplateSerializer, DocumentSerializer,
    SectionSerializer, ResourceLinkSerializer, TagSerializer,
    RequirementSnippetSerializer, RenderedRequirementsSerializer,
    CollectionSerializer, UserThemeSerializer, UserProfileSerializer
)
from .services.tags import sync_structural_tags, ensure_department_tag
from .permissions import IsOrgMember, IsAdminOrEditor, IsDocumentVisible


# -----------------------------
# Departments
# -----------------------------
class DepartmentViewSet(viewsets.ModelViewSet):
    """
    CRUD for Departments, scoped to the current organization.
    Viewers may read; writes require Admin/Editor.
    """
    serializer_class = DepartmentSerializer
    lookup_field = "slug"
    permission_classes = [IsAuthenticated, IsOrgMember, IsAdminOrEditor]

    def get_queryset(self):
        org = getattr(self.request, "org", None)
        return Department.objects.filter(org=org)

    def perform_create(self, serializer):
        dept = serializer.save(org=self.request.org)
        ensure_department_tag(dept)

    def perform_update(self, serializer):
        dept = serializer.save(org=self.request.org)
        ensure_department_tag(dept)

    @action(
        detail=True, methods=["get"], url_path="documents", url_name="documents",
        permission_classes=[IsAuthenticated, IsOrgMember]
    )
    def documents(self, request, *args, **kwargs):
        dept = self.get_object()  # already org-scoped
        qs = (
            Document.objects
            .filter(org=request.org, departments=dept)
            .prefetch_related("tags", "sections", "links", "departments")
        )
        page = self.paginate_queryset(qs)
        ser = DocumentSerializer(page or qs, many=True, context={"request": request})
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)
    @action(
        detail=True,
        methods=["get"],
        url_path="collections",
        url_name="collections",
        permission_classes=[IsAuthenticated, IsOrgMember],
    )
    def collections(self, request, *args, **kwargs):
        """
        Collections that include documents from this department.
        """
        dept = self.get_object()  # already org-scoped

        qs = (
            Collection.objects
            .filter(org=request.org, documents__departments=dept)
            .prefetch_related("documents", "subcollections")
            .distinct()
        )

        page = self.paginate_queryset(qs)
        serializer = CollectionSerializer(
            page or qs,
            many=True,
            context={"request": request},
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


# -----------------------------
# Templates
# -----------------------------
class TemplateViewSet(viewsets.ModelViewSet):
    serializer_class = TemplateSerializer
    permission_classes = [IsAuthenticated, IsOrgMember, IsAdminOrEditor]

    def get_queryset(self):
        return Template.objects.filter(org=getattr(self.request, "org", None))

    def perform_create(self, serializer):
        serializer.save(org=self.request.org)

    def perform_update(self, serializer):
        serializer.save(org=self.request.org)


# -----------------------------
# Tags
# -----------------------------
class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated, IsOrgMember, IsAdminOrEditor]

    def get_queryset(self):
        return Tag.objects.filter(org=getattr(self.request, "org", None))

    def perform_create(self, serializer):
        serializer.save(org=self.request.org)

    def perform_update(self, serializer):
        serializer.save(org=self.request.org)


# -----------------------------
# Requirement Snippets
# -----------------------------
class RequirementSnippetViewSet(viewsets.ModelViewSet):
    serializer_class = RequirementSnippetSerializer
    permission_classes = [IsAuthenticated, IsOrgMember, IsAdminOrEditor]

    def get_queryset(self):
        return RequirementSnippet.objects.select_related("tag").filter(
            org=getattr(self.request, "org", None)
        )

    def perform_create(self, serializer):
        serializer.save(org=self.request.org)

    def perform_update(self, serializer):
        serializer.save(org=self.request.org)


# -----------------------------
# Documents
# -----------------------------
class DocumentViewSet(viewsets.ModelViewSet):
    """
    Documents are org-scoped. Read visibility is further checked
    per-object (everyone=True OR membership) via IsDocumentVisible.
    Writes require Admin/Editor.
    """
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsOrgMember, IsDocumentVisible, IsAdminOrEditor]

    def get_queryset(self):
        org = getattr(self.request, "org", None)
        qs = (
            Document.objects
            .filter(org=org)
            .prefetch_related("tags", "sections", "links", "departments", "collections")
        )

        created_by = self.request.query_params.get("created_by")
        if created_by:
            qs = qs.filter(created_by_id=created_by)

        return qs

    def _create_version_snapshot(self, doc: Document):
        """
        Persist a snapshot of the document after changes.
        """
        org = getattr(self.request, "org", None)
        user = getattr(self.request, "user", None)
        if org is None:
            return

        DocumentVersion.objects.create(
            document=doc,
            org=org,
            created_by=user if getattr(user, "is_authenticated", False) else None,
            title=doc.title,
            status=doc.status,
            everyone=doc.everyone,
            tag_ids=list(doc.tags.values_list("id", flat=True)),
            collection_ids=list(doc.collections.values_list("id", flat=True)),
            department_ids=list(doc.departments.values_list("id", flat=True)),
        )

    def perform_create(self, serializer):
        doc = serializer.save(
            org=self.request.org,
            created_by=self.request.user if self.request.user.is_authenticated else None
        )
        sync_structural_tags(doc)
        self._create_version_snapshot(doc)

    def perform_update(self, serializer):
        doc = serializer.save(org=self.request.org)
        sync_structural_tags(doc)
        self._create_version_snapshot(doc)

    @action(detail=True, methods=["post"])
    def set_tags(self, request, pk=None):
        """
        Replace this document's *manual* tags with the given IDs, and treat any
        department-linked tags in that list as the desired departments for
        this document.

        Body: { "tag_ids": [1, 2, 3] }
        """
        doc = self.get_object()  # org-scoped, visibility already enforced
        org = getattr(request, "org", None)

        tag_ids = request.data.get("tag_ids", [])
        if not isinstance(tag_ids, (list, tuple)):
            return Response({"detail": "tag_ids must be a list"}, status=400)

        # All tags in this org that match requested IDs
        requested_qs = Tag.objects.filter(org=org, id__in=tag_ids)

        # 1) Manual tags = no department/collection link
        manual_qs = requested_qs.filter(
            link_department__isnull=True,
            link_collection__isnull=True,
        )

        # 2) Department tags in the request -> drive doc.departments
        dept_tag_qs = requested_qs.filter(link_department__isnull=False)
        dept_ids = list(
            dept_tag_qs.values_list("link_department_id", flat=True)
        )

        if dept_ids:
            dept_qs = Department.objects.filter(org=org, id__in=dept_ids)
            doc.departments.set(dept_qs)
        else:
            # No department tags passed at all -> clear departments
            doc.departments.clear()

        # 3) Set tags = manual-only; structural tags will be re-added
        doc.tags.set(list(manual_qs))

        # 4) Ensure structural tags (dept/collection) are in sync with
        #    doc.departments / doc.collections
        sync_structural_tags(doc)

        serializer = self.get_serializer(doc, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def set_collections(self, request, pk=None):
        """
        Set which collections this document belongs to.
        Body: { "collection_ids": [1, 2, 3] }
        """
        doc = self.get_object()
        org = getattr(request, "org", None)

        col_ids = request.data.get("collection_ids", [])
        if not isinstance(col_ids, (list, tuple)):
            return Response({"detail": "collection_ids must be a list"}, status=400)

        collections_qs = Collection.objects.filter(org=org, id__in=col_ids)
        # Reverse M2M via related_name="collections"
        doc.collections.set(collections_qs)

        # 👇 ensure department/collection structural tags match membership
        sync_structural_tags(doc)

        serializer = self.get_serializer(doc, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reorder_sections(self, request, pk=None):
        """
        Reorder sections for this document.

        Request body:
          {
            "section_ids": [3, 1, 2, ...]   # ordered list of section IDs
          }

        Notes:
        - Only sections that belong to this document are updated.
        - Unknown / negative IDs are ignored (e.g. unsaved client-side sections).
        - Any sections not mentioned are appended after, preserving their relative order.
        - Creates a DocumentVersion snapshot for edit history.
        """
        doc = self.get_object()

        section_ids = request.data.get("section_ids", [])
        if not isinstance(section_ids, (list, tuple)):
            return Response(
                {"detail": "section_ids must be a list of IDs"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only consider existing sections on this document
        existing_ids = list(
            Section.objects.filter(document=doc, id__in=section_ids)
            .order_by("order", "id")
            .values_list("id", flat=True)
        )

        # If nothing to do, just return current state
        if not existing_ids:
            serializer = self.get_serializer(doc, context={"request": request})
            return Response(serializer.data)

        # Assign new order to the IDs in the order provided
        order = 0
        for sid in section_ids:
            if sid in existing_ids:
                Section.objects.filter(document=doc, id=sid).update(order=order)
                order += 1

        # Any sections not mentioned (e.g. newly created, or omitted) are appended
        remaining = (
            Section.objects.filter(document=doc)
            .exclude(id__in=existing_ids)
            .order_by("order", "id")
            .values_list("id", flat=True)
        )
        for sid in remaining:
            Section.objects.filter(document=doc, id=sid).update(order=order)
            order += 1

        # Refresh + create edit-history snapshot
        doc.refresh_from_db()
        self._create_version_snapshot(doc)

        serializer = self.get_serializer(doc, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def requirements(self, request, pk=None):
        """
        Returns only the auto-generated requirements derived from tags.
        """
        doc = self.get_object()  # guarded by IsDocumentVisible
        serializer = RenderedRequirementsSerializer(doc, context={"request": request})
        return Response(serializer.data)


# -----------------------------
# Sections (child of Document)
# -----------------------------
class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated, IsOrgMember, IsAdminOrEditor]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        # Sections inherit org via their parent document
        return Section.objects.select_related("document").filter(document__org=getattr(self.request, "org", None))

    def perform_create(self, serializer):
        # No org field on Section; parent document enforces org
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


# -----------------------------
# Resource Links (child of Document)
# -----------------------------
class ResourceLinkViewSet(viewsets.ModelViewSet):
    serializer_class = ResourceLinkSerializer
    permission_classes = [IsAuthenticated, IsOrgMember, IsAdminOrEditor]

    def get_queryset(self):
        # ResourceLinks inherit org via their parent document
        return ResourceLink.objects.select_related("document").filter(document__org=getattr(self.request, "org", None))

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


# -----------------------------
# Collections (read-only)
# -----------------------------
class CollectionViewSet(viewsets.ModelViewSet):
    """
    Curated groupings of documents (e.g., 'New Hire Onboarding').

    - Safe methods (GET, HEAD, OPTIONS): any authenticated org member
    - Writes (POST, PATCH, DELETE): admin or editor only
    """
    serializer_class = CollectionSerializer
    lookup_field = "slug"
    lookup_url_kwarg = "slug"
    permission_classes = [IsAuthenticated, IsOrgMember, IsAdminOrEditor]

    def get_queryset(self):
        org = getattr(self.request, "org", None)
        qs = Collection.objects.filter(org=org).prefetch_related(
            "documents",
            "subcollections",
            "linked_tags",  # tags where Tag.link_collection = this collection
        )

        created_by = self.request.query_params.get("created_by")
        if created_by:
            qs = qs.filter(created_by_id=created_by)

        return qs

    def perform_create(self, serializer):
        serializer.save(
            org=self.request.org,
            created_by=self.request.user if self.request.user.is_authenticated else None
        )

    def perform_update(self, serializer):
        serializer.save(org=self.request.org)

    @action(detail=True, methods=["get"])
    def documents(self, request, *args, **kwargs):
        col = self.get_object()  # org-scoped
        docs = col.documents.filter(org=request.org).prefetch_related(
            "tags", "sections", "links", "departments"
        )
        page = self.paginate_queryset(docs)
        serializer = DocumentSerializer(page or docs, many=True, context={"request": request})
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

# -----------------------------
# User theme (per-user settings)
# -----------------------------
class UserThemeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Return the current user's theme settings.
        If not present, return sensible defaults.
        """
        user = request.user
        theme, _ = UserTheme.objects.get_or_create(user=user)

        serializer = UserThemeSerializer(theme)
        return Response(serializer.data)

    def post(self, request):
        """
        Update the current user's theme settings.

        Expected body:
        {
          "mode": "light" | "dark" | "custom",
          "custom": { ...CustomTheme shape... }
        }
        """
        user = request.user
        theme, _ = UserTheme.objects.get_or_create(user=user)

        serializer = UserThemeSerializer(
            theme, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

# -----------------------------
# User Profiles (per-user)
# -----------------------------

class UserProfileMeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user, org=request.org
        )
        return Response(UserProfileSerializer(profile).data)

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user, org=request.org
        )
        serializer = UserProfileSerializer(
            profile, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserProfileDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        profile = UserProfile.objects.filter(
            user__id=user_id, org=request.org
        ).first()

        if not profile:
            return Response({"detail": "Profile not found"}, status=404)

        return Response(UserProfileSerializer(profile).data)


class DepartmentMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        dept = Department.objects.filter(
            org=request.org, slug=slug
        ).first()
        if not dept:
            return Response({"detail": "Department not found"}, status=404)

        profiles = (
            dept.members
            .select_related("user")
            .order_by("preferred_first_name", "preferred_last_name", "user__username")
        )
        return Response(UserProfileSerializer(profiles, many=True).data)

    def post(self, request, slug):
        """
        Admin-only: add or remove a user from this department.

        body: { "action": "add"|"remove", "user_id": <int> } or
              { "action": "add", "username": "<str>" }
        """
        dept = Department.objects.filter(
            org=request.org, slug=slug
        ).first()
        if not dept:
            return Response({"detail": "Department not found"}, status=404)

        # Only org admins/editors can change department membership
        has_role = Membership.objects.filter(
            org=request.org,
            user=request.user,
            role__in=["admin", "editor"],
        ).exists()
        if not has_role:
            return Response({"detail": "Forbidden"}, status=403)

        action = request.data.get("action")
        user_id = request.data.get("user_id")
        username = request.data.get("username")

        if action not in ("add", "remove"):
            return Response({"detail": "Invalid action"}, status=400)

        profile_qs = UserProfile.objects.filter(org=request.org)
        if user_id:
            profile_qs = profile_qs.filter(user__id=user_id)
        elif username:
            profile_qs = profile_qs.filter(user__username=username)
        else:
            return Response({"detail": "user_id or username is required"}, status=400)

        profile = profile_qs.first()
        if not profile:
            return Response({"detail": "Profile not found"}, status=404)

        if action == "add":
            profile.departments.add(dept)
        else:
            profile.departments.remove(dept)

        return Response(UserProfileSerializer(profile, context={"request": request}).data)


# -----------------------------
# Simple endpoints
# -----------------------------
@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "service": "DocTracker API"})


@api_view(["GET"])
def tiles(request):
    """
    Return active tiles in configured order (org-scoped).
    Home page composition is unique per org.
    """
    org = getattr(request, "org", None)
    tiles_qs = (
        Tile.objects
        .filter(org=org, is_active=True)
        .order_by("order", "id")
        .select_related("document", "department", "collection")
    )

    payload = []
    for t in tiles_qs:
        base = {
            "id": t.id,
            "title": t.title,
            # normalize "url" -> "external" to match frontend expectations
            "kind": "external" if t.kind in ("url", "external") and t.href else t.kind,
            "description": t.description or "",
        }

        if hasattr(t, "icon") and getattr(t, "icon"):
            base["icon"] = getattr(t, "icon")

        if t.kind in ("url", "external") and t.href:
            base["href"] = t.href
        elif t.kind == "document" and t.document_id:
            base["documentId"] = t.document_id
        elif t.kind == "department" and t.department_id and t.department:
            base["departmentSlug"] = t.department.slug
        elif t.kind == "collection" and t.collection_id and t.collection:
            base["collectionSlug"] = t.collection.slug
        else:
            # skip misconfigured tile
            continue

        payload.append(base)

    return Response(payload)


@api_view(["GET"])
def search(request):
    """
    Unified search across:
      - Documents (title + sections + links)
      - Collections (name, description)
      - Departments (name, slug)
      - Tags (name, description)
    (All org-scoped)
    """
    org = getattr(request, "org", None)
    q = (request.GET.get("q") or "").strip()
    if not q:
        return Response({"results": []})

    # --- Documents: title, sections, links
    documents = (
        Document.objects.filter(org=org).filter(
            Q(title__icontains=q)
            | Q(sections__body_md__icontains=q)
            | Q(links__title__icontains=q)
            | Q(links__note__icontains=q)
            | Q(links__url__icontains=q)
        )
        .distinct()
        .prefetch_related("sections", "links", "tags", "departments")
    )[:50]

    # --- Collections
    collections = Collection.objects.filter(org=org).filter(
        Q(name__icontains=q) | Q(description__icontains=q)
    )[:25]

    # --- Departments
    departments = Department.objects.filter(org=org).filter(
        Q(name__icontains=q) | Q(slug__icontains=q)
    )[:25]

    # --- Tags
    tags = Tag.objects.filter(org=org).filter(
        Q(name__icontains=q) | Q(description__icontains=q)
    )[:25]

    # ---- helpers
    def snippet(text: str, query: str, width: int = 120):
        if not text:
            return ""
        i = text.lower().find(query.lower())
        if i < 0:
            return text[:width]
        start = max(0, i - width // 2)
        end = min(len(text), i + len(query) + width // 2)
        s = text[start:end].replace("\n", " ")
        if start > 0:
            s = "…" + s
        if end < len(text):
            s = s + "…"
        return s

    results = []

    # Build quick snippet lookups for returned documents only
    doc_ids = list(documents.values_list("id", flat=True))
    section_by_doc = {}
    if doc_ids:
        for ms in (
            Section.objects
            .filter(document_id__in=doc_ids, body_md__icontains=q)
            .values("document_id", "body_md")[:200]
        ):
            section_by_doc.setdefault(ms["document_id"], ms["body_md"])

    link_by_doc = {}
    if doc_ids:
        for ml in (
            ResourceLink.objects
            .filter(document_id__in=doc_ids)
            .filter(Q(title__icontains=q) | Q(url__icontains=q) | Q(note__icontains=q))
            .values("document_id", "title", "note", "url")[:200]
        ):
            s = ml["title"] or ml["note"] or ml["url"] or ""
            link_by_doc.setdefault(ml["document_id"], s)

    # Documents
    for d in documents:
        s = section_by_doc.get(d.id) or link_by_doc.get(d.id) or d.title
        results.append({
            "kind": "document",
            "id": d.id,
            "title": d.title,
            "snippet": snippet(s, q),
        })

    # Collections
    for c in collections:
        results.append({
            "kind": "collection",
            "slug": c.slug,
            "title": c.name,
            "snippet": snippet(c.description or "", q),
        })

    # Departments
    for dep in departments:
        results.append({
            "kind": "department",
            "slug": dep.slug,
            "title": dep.name,
            "snippet": dep.slug,
        })

    # Tags
    for tg in tags:
        results.append({
            "kind": "tag",
            "id": tg.id,
            "slug": tg.slug,
            "title": tg.name,
            "snippet": snippet(tg.description or "", q),
        })

    return Response({"results": results})
