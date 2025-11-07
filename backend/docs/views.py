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
    lookup_url_kwarg = "slug"     # <-- make URL kwarg explicit

    @action(detail=True, methods=["get"])
    def documents(self, request, *args, **kwargs):  # <-- keep *args, **kwargs
        col = self.get_object()
        docs = col.documents.all().prefetch_related("tags", "sections", "links", "departments")
        page = self.paginate_queryset(docs)
        ser = DocumentSerializer(page or docs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=True, methods=["get"])
    def subcollections(self, request, *args, **kwargs):  # <-- keep *args, **kwargs
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
