from django.contrib import admin
from django import forms
from .models import (
    Department, Template, Document, Section, ResourceLink, Tag, RequirementSnippet, Collection, Tile,
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
    fields = ("order", "header", "body_md", "image")


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


@admin.register(Tile)
class TileAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "order", "is_active")
    list_filter = ("kind", "is_active")
    search_fields = ("title", "description", "href")
    autocomplete_fields = ("document", "department", "collection")

class CollectionAdminForm(forms.ModelForm):
    class Meta:
        model = Collection
        fields = "__all__"

    def clean_subcollections(self):
        subs = self.cleaned_data.get("subcollections")
        instance = self.instance

        # Self-nesting
        if instance.pk and subs.filter(pk=instance.pk).exists():
            raise forms.ValidationError("A collection cannot include itself.")

        # Cycle detection: child -> ... -> instance
        if instance.pk:
            target_pk = instance.pk

            def has_path_to_target(start):
                seen = set()
                stack = [start]
                while stack:
                    node = stack.pop()
                    if node.pk == target_pk:
                        return True
                    if node.pk in seen:
                        continue
                    seen.add(node.pk)
                    stack.extend(node.subcollections.all())
                return False

            for child in subs.all():
                if has_path_to_target(child):
                    raise forms.ValidationError(
                        f"Adding '{child.name}' would create a circular collection chain."
                    )

        return subs

@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    form = CollectionAdminForm
    list_display = ("name", "slug", "order")
    search_fields = ("name", "slug")
    filter_horizontal = ("documents", "subcollections")
