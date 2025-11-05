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
    # Readable related data
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
        fields = ["id", "name", "slug", "description", "documents", "order"]

class TileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tile
        fields = [
            "id", "title", "kind",
            "href", "document", "department", "collection",
            "description", "icon", "order", "is_active",
        ]