from rest_framework import serializers
from .models import (
    Department, Template, Document, Section, ResourceLink, Tag, RequirementSnippet, Collection, Tile,
    assemble_requirements_from_tags
)

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"

class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = "__all__"

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = "__all__"

class RequirementSnippetSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequirementSnippet
        fields = "__all__"

class SectionSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, allow_null=True)
    class Meta:
        model = Section
        fields = ["id", "order", "header", "body_md", "image", "document"]

class ResourceLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceLink
        fields = ["id", "order", "title", "url", "note", "document"]

class DocumentSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    links = ResourceLinkSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = [
            "id", "title", "template",
            "everyone", "departments", "status",
            "last_reviewed", "review_interval_days",
            "created_at", "updated_at",
            "tags",
            "sections", "links",
        ]

class RenderedRequirementsSerializer(serializers.ModelSerializer):
    requirements = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "title", "tags",
            "requirements",
        ]

    def get_requirements(self, obj):
        return assemble_requirements_from_tags(obj)

class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = ["id", "name", "slug", "description", "documents", "subcollections","order"]

        def validate_subcollections(self, subs):
            """
            Validates on create/update via API:
            - no self-nesting
            - no cycles
            """
            instance = getattr(self, "instance", None)

            if instance and instance.pk and subs.filter(pk=instance.pk).exists():
                raise serializers.ValidationError("A collection cannot include itself.")

            def would_create_cycle(parent_pk, child: Collection) -> bool:
                seen = set()
                stack = [child]
                while stack:
                    node = stack.pop()
                    if node.pk == parent_pk:
                        return True
                    if node.pk in seen:
                        continue
                    seen.add(node.pk)
                    stack.extend(node.subcollections.all())
                return False
            if instance and instance.pk:
                for child in subs:
                    if would_create_cycle(instance.pk, child):
                        raise serializers.ValidationError(f"Adding '{child.name}' would create a circular collection chain.")

            return subs

class TileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tile
        fields = [
            "id", "title", "kind",
            "href", "document", "department", "collection",
            "description", "icon", "order", "is_active",
        ]