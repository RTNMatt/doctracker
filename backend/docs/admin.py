# docs/admin.py
from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Organization, Membership,
    Department, Template, Document, Section, ResourceLink,
    Tag, RequirementSnippet,
    Collection, Tile,
)
from .services.tags import sync_structural_tags, ensure_department_tag


# -----------------------------
# Helpers
# -----------------------------
def get_request_org(request):
    # Provided by your OrgMiddleware (None in plain localhost/admin without subdomain or header)
    return getattr(request, "org", None)


class OrgScopedAdmin(admin.ModelAdmin):
    """
    Base admin that:
      - Filters queryset by request.org when present
      - Auto-sets instance.org on save if missing
      - Limits FK/M2M choices to same org
    """
    readonly_fields = tuple()

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        org = get_request_org(request)
        if org and hasattr(self.model, "org_id"):
            return qs.filter(org=org)
        return qs

    def save_model(self, request, obj, form, change):
        if hasattr(obj, "org_id"):
            org = get_request_org(request)
            if org and obj.org_id is None:
                obj.org = org
        super().save_model(request, obj, form, change)

    # Limit FK choices to same org when possible
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        org = get_request_org(request)
        if org:
            qs = kwargs.get("queryset")
            if qs is not None and hasattr(qs.model, "org_id"):
                kwargs["queryset"] = qs.model.objects.filter(org=org)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    # Limit M2M choices to same org when possible
    def formfield_for_manytomany(self, db_field, request, **kwargs):
        org = get_request_org(request)
        if org:
            qs = kwargs.get("queryset")
            if qs is not None and hasattr(qs.model, "org_id"):
                kwargs["queryset"] = qs.model.objects.filter(org=org)
        return super().formfield_for_manytomany(db_field, request, **kwargs)


# -----------------------------
# Core: Organization & Membership
# -----------------------------
@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "brand_primary")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "org", "role")
    list_filter = ("org", "role")
    search_fields = ("user__username", "user__email", "org__name", "org__slug")
    autocomplete_fields = ("user", "org")


# -----------------------------
# Departments
# -----------------------------
class DepartmentAdmin(OrgScopedAdmin):
    list_display = ("name", "slug", "org")
    list_filter = ("org",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        # Ensure structural tag after save
        ensure_department_tag(obj)

admin.site.register(Department, DepartmentAdmin)


# -----------------------------
# Templates
# -----------------------------
class TemplateAdmin(OrgScopedAdmin):
    list_display = ("name", "slug", "org")
    list_filter = ("org",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}

admin.site.register(Template, TemplateAdmin)


# -----------------------------
# Documents (+ inlines)
# -----------------------------
class SectionInline(admin.TabularInline):
    model = Section
    extra = 0
    fields = ("header", "body_md", "image")


class ResourceLinkInline(admin.TabularInline):
    model = ResourceLink
    extra = 0
    fields = ("title", "url", "note")


class DocumentAdmin(OrgScopedAdmin):
    list_display = ("title", "status", "everyone", "org")
    list_filter = ("org", "status", "everyone", "departments")
    search_fields = ("title", "sections__body_md", "links__title", "links__url", "links__note")
    autocomplete_fields = ("departments", "tags")
    inlines = (SectionInline, ResourceLinkInline)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        # Keep auto-tag sync behavior consistent with views
        sync_structural_tags(obj)

admin.site.register(Document, DocumentAdmin)


# -----------------------------
# Tags
# -----------------------------
class TagAdmin(OrgScopedAdmin):
    list_display = ("name", "slug", "org", "linked_target")
    list_filter = ("org",)
    search_fields = ("name", "slug", "description")
    autocomplete_fields = ("link_document", "link_department", "link_collection")

    def linked_target(self, obj):
        if obj.link_document_id:
            return format_html("📄 Document #{}", obj.link_document_id)
        if obj.link_department_id:
            return format_html("🗂️ Dept: {}", obj.link_department.slug if obj.link_department else "")
        if obj.link_collection_id:
            return format_html("🏷️ Collection: {}", obj.link_collection.slug if obj.link_collection else "")
        if obj.link_url:
            return "↗ External"
        return "—"

    linked_target.short_description = "Target"

admin.site.register(Tag, TagAdmin)


# -----------------------------
# Requirement Snippets (hidden)
# -----------------------------
# You’re moving requirements to “a document linked to a tag”, so don’t register this model.
# If you later need it visible (read-only), we can add a read-only admin.
# class RequirementSnippetAdmin(OrgScopedAdmin):
#     list_display = ("title", "tag", "org")
#     list_filter = ("org", "tag")
#     search_fields = ("title", "content_md", "tag__name")
# admin.site.register(RequirementSnippet, RequirementSnippetAdmin)


# -----------------------------
# Collections
# -----------------------------
class CollectionAdmin(OrgScopedAdmin):
    list_display = ("name", "slug", "order", "org")
    list_filter = ("org",)
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ("documents", "subcollections")

    def save_model(self, request, obj, form, change):
        if not obj.pk:  # new collection
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


admin.site.register(Collection, CollectionAdmin)


# -----------------------------
# Tiles
# -----------------------------
class TileAdmin(OrgScopedAdmin):
    list_display = ("title", "kind", "is_active", "order", "org")
    list_filter = ("org", "kind", "is_active")
    search_fields = ("title", "description", "href")
    autocomplete_fields = ("document", "department", "collection")

admin.site.register(Tile, TileAdmin)


# -----------------------------
# Sections / ResourceLinks as standalone pages (hidden)
# -----------------------------
# Do NOT register Section/ResourceLink as top-level admin models; manage them via inlines only.
# admin.site.register(Section, SectionAdmin)        # removed
# admin.site.register(ResourceLink, ResourceLinkAdmin)  # removed
