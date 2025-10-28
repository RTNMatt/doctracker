from rest_framework import serializers
from .models import (
    Department, Template, Document, Section, ResourceLink, Tag, RequirementSnippet,
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
    class Meta:
        model = Section
        fields = ["id", "order", "header", "body_md", "document"]

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
