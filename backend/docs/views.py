from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Department, Template, Document, Section, ResourceLink, Tag, RequirementSnippet
)
from .serializers import (
    DepartmentSerializer, TemplateSerializer, DocumentSerializer,
    SectionSerializer, ResourceLinkSerializer, TagSerializer, RequirementSnippetSerializer,
    RenderedRequirementsSerializer
)

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

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
