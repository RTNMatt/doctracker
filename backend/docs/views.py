from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db.models import Q

from .models import (
    Department, Template, Document, Section, ResourceLink, Tag,
    RequirementSnippet, Collection
)
from .serializers import (
    DepartmentSerializer, TemplateSerializer, DocumentSerializer,
    SectionSerializer, ResourceLinkSerializer, TagSerializer,
    RequirementSnippetSerializer, RenderedRequirementsSerializer,
    CollectionSerializer
)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    lookup_field = "slug"

    @action(detail=True, methods=["get"], url_path="documents", url_name="documents")
    def documents(self, request, *args, **kwargs):
        """
        List documents that belong to this department.
        """
        dept = self.get_object()
        qs = Document.objects.filter(departments=dept).prefetch_related("tags", "sections", "links", "departments")
        page = self.paginate_queryset(qs)
        ser = DocumentSerializer(page or qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)


class TemplateViewSet(viewsets.ModelViewSet):
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer


class RequirementSnippetViewSet(viewsets.ModelViewSet):
    queryset = RequirementSnippet.objects.select_related("tag").all()
    serializer_class = RequirementSnippetSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all().prefetch_related("tags", "sections", "links", "departments")
    serializer_class = DocumentSerializer

    @action(detail=True, methods=["get"])
    def requirements(self, request, pk=None):
        """
        Returns only the auto-generated requirements derived from tags.
        """
        doc = self.get_object()
        serializer = RenderedRequirementsSerializer(doc)
        return Response(serializer.data)


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.select_related("document").all()
    serializer_class = SectionSerializer


class ResourceLinkViewSet(viewsets.ModelViewSet):
    queryset = ResourceLink.objects.select_related("document").all()
    serializer_class = ResourceLinkSerializer


class CollectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Curated groupings of documents (e.g., 'New Hire Onboarding').
    """
    queryset = Collection.objects.all().prefetch_related("documents", "subcollections")
    serializer_class = CollectionSerializer
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    @action(detail=True, methods=["get"])
    def documents(self, request, *args, **kwargs):
        col = self.get_object()
        docs = col.documents.all().prefetch_related("tags", "sections", "links", "departments")
        page = self.paginate_queryset(docs)
        ser = DocumentSerializer(page or docs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=True, methods=["get"])
    def subcollections(self, request, *args, **kwargs):
        col = self.get_object()
        subs = col.subcollections.all()
        page = self.paginate_queryset(subs)
        ser = CollectionSerializer(page or subs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)


@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "service": "DocTracker API"})


@api_view(["GET"])
def tiles(request):
    """
    Return active tiles in configured order.
    """
    from .models import Tile
    tiles = Tile.objects.filter(is_active=True).order_by("order", "id")

    payload = []
    for t in tiles:
        base = {
            "id": t.id,
            "title": t.title,
            "kind": t.kind,
            "description": t.description or "",
        }
        if t.icon:
            base["icon"] = t.icon

        if t.kind == "external" and t.href:
            base["href"] = t.href
        elif t.kind == "document" and t.document_id:
            base["documentId"] = t.document_id
        elif t.kind == "department" and t.department_id:
            base["departmentSlug"] = t.department.slug
        elif t.kind == "collection" and t.collection_id:
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

    Returns a normalized list; you can group client-side by 'kind'.
    """
    q = (request.GET.get("q") or "").strip()
    if not q:
        return Response({"results": []})

    # --- Documents: joined query across title, sections, and links
    documents = (
        Document.objects.filter(
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
    collections = Collection.objects.filter(
        Q(name__icontains=q) | Q(description__icontains=q)
    )[:25]

    # --- Departments
    departments = Department.objects.filter(
        Q(name__icontains=q) | Q(slug__icontains=q)
    )[:25]

    # --- Tags
    tags = Tag.objects.filter(
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
