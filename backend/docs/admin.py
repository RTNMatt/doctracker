from django.contrib import admin
from .models import (
    Department, Template, Document, Section, ResourceLink, Tag, RequirementSnippet
)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    search_fields = ("name", "slug")


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "font_family", "base_font_size_px", "color_accent")
    search_fields = ("name", "slug")


class SectionInline(admin.TabularInline):
    model = Section
    extra = 1
    fields = ("order", "header", "body_md")


class ResourceLinkInline(admin.TabularInline):
    model = ResourceLink
    extra = 1
    fields = ("order", "title", "url", "note")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "everyone", "last_reviewed", "updated_at")
    list_filter = ("status", "everyone", "departments", "tags")
    search_fields = ("title",)
    autocomplete_fields = ("template", "departments", "tags")
    inlines = [SectionInline, ResourceLinkInline]
    readonly_fields = ("id",)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "link_document", "link_url")
    search_fields = ("name", "slug")
    autocomplete_fields = ("link_document",)


@admin.register(RequirementSnippet)
class RequirementSnippetAdmin(admin.ModelAdmin):
    list_display = ("title", "tag", "priority", "active")
    list_filter = ("active", "tag")
    search_fields = ("title", "content_md")
    autocomplete_fields = ("tag",)
