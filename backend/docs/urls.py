from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DepartmentViewSet, TemplateViewSet, TagViewSet,
    RequirementSnippetViewSet, DocumentViewSet,
    SectionViewSet, ResourceLinkViewSet,
    CollectionViewSet, tiles, health, search
)

router = DefaultRouter()
router.register(r"departments", DepartmentViewSet)
router.register(r"templates", TemplateViewSet)
router.register(r"tags", TagViewSet)
router.register(r"snippets", RequirementSnippetViewSet)
router.register(r"documents", DocumentViewSet)
router.register(r"sections", SectionViewSet)
router.register(r"links", ResourceLinkViewSet)
router.register(r"collections", CollectionViewSet, basename="collections")

urlpatterns = [
    path("health/", health, name="health"),
    path("tiles/", tiles, name="tiles"),
    path("search/", search, name="search"),
    path("", include(router.urls)),
]
