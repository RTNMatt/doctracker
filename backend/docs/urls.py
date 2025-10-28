from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DepartmentViewSet, TemplateViewSet, TagViewSet,
    RequirementSnippetViewSet, DocumentViewSet,
    SectionViewSet, ResourceLinkViewSet
)
from rest_framework.decorators import api_view
from rest_framework.response import Response

router = DefaultRouter()
router.register(r"departments", DepartmentViewSet)
router.register(r"templates", TemplateViewSet)
router.register(r"tags", TagViewSet)
router.register(r"snippets", RequirementSnippetViewSet)
router.register(r"documents", DocumentViewSet)
router.register(r"sections", SectionViewSet)
router.register(r"links", ResourceLinkViewSet)

@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "service": "DocTracker API"})

urlpatterns = [
    path("health/", health, name="health"),
    path("", include(router.urls)),
]
