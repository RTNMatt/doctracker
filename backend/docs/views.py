from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    Department, Template, Document, Section, ResourceLink, Tag,
    RequirementSnippet, Collection
)
from .serializers import (
    DepartmentSerializer, TemplateSerializer, DocumentSerializer,
    SectionSerializer, ResourceLinkSerializer, TagSerializer,
    RequirementSnippetSerializer, RenderedRequirementsSerializer,
    # new
    # You'll need to add CollectionSerializer to serializers.py as shown earlier.
    CollectionSerializer
)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    @action(detail=True, methods=["get"], url_path="documents", url_name="documents")
    def documents(self, request, pk=None):
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
    queryset = Collection.objects.all().prefetch_related("documents")
    serializer_class = CollectionSerializer

    @action(detail=True, methods=["get"])
    def documents(self, request, pk=None):
        col = self.get_object()
        docs = col.documents.all().prefetch_related("tags", "sections", "links", "departments")
        page = self.paginate_queryset(docs)
        ser = DocumentSerializer(page or docs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)


@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "service": "DocTracker API"})


@api_view(["GET"])
def tiles(request):
    """
    Server-driven home tiles. Compose this from DB/config as needed.
    Example payload includes:
    - One known collection (if present)
    - A few departments
    - A few recent published documents
    - One or more external links
    """
    payload = []

    # Example: known collection
    col = Collection.objects.filter(slug="new-hire-onboarding").first()
    if col:
        payload.append({
            "id": f"col-{col.id}",
            "title": col.name,
            "kind": "collection",
            "collectionSlug": col.slug,
            "description": (col.description or "")[:120],
        })

    # Example: a few departments
    for dept in Department.objects.all()[:3]:
        payload.append({
            "id": f"dept-{dept.id}",
            "title": dept.name,
            "kind": "department",
            "departmentSlug": dept.slug,
        })

    # Example: recent published documents
    recent_docs = Document.objects.filter(status="published").order_by("-updated_at")[:3]
    for d in recent_docs:
        payload.append({
            "id": f"doc-{d.id}",
            "title": d.title,
            "kind": "document",
            "documentId": d.id,
        })

    # Example: external link
    payload.append({
        "id": "ext-1",
        "title": "Company Portal",
        "kind": "external",
        "href": "https://intranet.example.com/portal",
        "description": "HR, benefits, forms",
    })

    return Response(payload)
