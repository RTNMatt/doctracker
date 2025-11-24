# docs/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
#from .auth_views import LoginView, LogoutView, MeView, RefreshView

from .views import (
    DepartmentViewSet, TemplateViewSet, TagViewSet, RequirementSnippetViewSet,
    DocumentViewSet, SectionViewSet, ResourceLinkViewSet,
    CollectionViewSet,
    health, tiles, search,
    UserThemeView
)

# NEW: import auth views
from .auth import LoginView, LogoutView, MeView, RefreshView

router = DefaultRouter()

# Explicit basenames because our viewsets don't define .queryset
router.register(r"departments", DepartmentViewSet, basename="department")
router.register(r"templates", TemplateViewSet, basename="template")
router.register(r"tags", TagViewSet, basename="tag")
router.register(r"snippets", RequirementSnippetViewSet, basename="snippet")
router.register(r"documents", DocumentViewSet, basename="document")
router.register(r"sections", SectionViewSet, basename="section")
router.register(r"links", ResourceLinkViewSet, basename="resourcelink")
router.register(r"collections", CollectionViewSet, basename="collection")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", health, name="health"),
    path("tiles/", tiles, name="tiles"),
    path("search/", search, name="search"),

    path("theme/", UserThemeView.as_view(), name="user-theme"),

    # NEW: auth endpoints (added, not replacing anything)
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
]
