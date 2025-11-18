from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import Membership, Document

class IsOrgMember(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request, "org", None))

class IsAdminOrEditor(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        org = getattr(request, "org", None)
        if not org or not request.user.is_authenticated:
            return False
        return Membership.objects.filter(org=org, user=request.user, role__in=["admin", "editor"]).exists()

class IsDocumentVisible(BasePermission):
    """Read: everyone=True OR membership required. Write: admin/editor only."""
    def has_object_permission(self, request, view, obj):
        org = getattr(request, "org", None)
        if not org:
            return False
        # org match
        if getattr(obj, "org_id", None) != org.id:
            return False
        if request.method in SAFE_METHODS:
            if hasattr(obj, "everyone") and obj.everyone:
                return True
            # require membership for private docs
            return Membership.objects.filter(org=org, user=request.user).exists()
        # writes
        return Membership.objects.filter(org=org, user=request.user, role__in=["admin", "editor"]).exists()


class IsObjectInRequestOrg(BasePermission):
    def has_object_permission(self, request, view, obj):
        req_org = getattr(request, "org", None)
        obj_org = getattr(obj, "org", None)
        if obj_org is None:
            # For child models like Section/ResourceLink, derive org from their parent document
            obj_org = getattr(getattr(obj, "document", None), "org", None)
        return (req_org is None and obj_org is None) or (req_org and obj_org and req_org.id == obj_org.id)


class IsViewer(BasePermission):
    def has_permission(self, request, view):
        org = getattr(request, "org", None)
        if not org or not request.user.is_authenticated:
            return False
        return Membership.objects.filter(org=org, user=request.user, role="viewer").exists()
