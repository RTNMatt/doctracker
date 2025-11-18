# docs/serializers.py
from typing import Iterable, Optional

from rest_framework import serializers
from django.utils.text import slugify

from .models import (
    Organization,  # usually not exposed, but imported for typing completeness
    Department,
    Template,
    Tag,
    Document,
    Section,
    ResourceLink,
    Collection,
    Tile,
    RequirementSnippet,
    assemble_requirements_from_tags,
)


# -------------------------------------------------------------------
# Mixin: constrain selectable relations to request.org + validate orgs
# -------------------------------------------------------------------
class OrgScopedSerializerMixin:
    """
    Limit FK/M2M choices to request.org and validate cross-org submissions.
    Works for serializers that are used under org-scoped ViewSets.
    """

    def _current_org(self):
        req = self.context.get("request")
        return getattr(req, "org", None)

    def limit_queryset_to_org(self, field_name: str):
        """
        Restrict a related field's queryset to objects with org == request.org,
        when that model has org_id.
        """
        field = self.fields.get(field_name)
        if not field or not hasattr(field, "queryset") or field.queryset is None:
            return
        org = self._current_org()
        if org is None:
            return
        model = field.queryset.model
        if hasattr(model, "org_id"):
            field.queryset = model.objects.filter(org=org)

    def _check_obj_org(self, obj, name: str, org_id: Optional[int]):
        if obj is None or org_id is None:
            return
        # Prefer direct org_id attribute; fall back to obj.org.id
        obj_org_id = getattr(obj, "org_id", None)
        if obj_org_id is None:
            obj_org = getattr(obj, "org", None)
            obj_org_id = getattr(obj_org, "id", None)
        if obj_org_id is not None and obj_org_id != org_id:
            raise serializers.ValidationError({name: "Object must belong to current organization."})

    def validate(self, attrs):
        """
        Generic FK/M2M org checks on incoming attrs + instance org consistency.
        """
        org = self._current_org()
        if org is None:
            return super().validate(attrs)
        org_id = getattr(org, "id", None)

        # Check FK/M2M values in attrs
        for name, val in list(attrs.items()):
            # Single FK objects come through as model instances
            self._check_obj_org(val, name, org_id)

            # PrimaryKeyRelatedField(many=True) delivers a list of model instances
            if isinstance(val, (list, tuple)):
                for idx, item in enumerate(val):
                    self._check_obj_org(item, f"{name}[{idx}]", org_id)

        # If updating an instance that has org, it must match request.org
        inst = getattr(self, "instance", None)
        if inst is not None and hasattr(inst, "org_id"):
            if inst.org_id != org_id:
                raise serializers.ValidationError("Object belongs to a different organization.")

        return super().validate(attrs)


# -----------------------
# Basic model serializers
# -----------------------
class DepartmentSerializer(OrgScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # no FK fields that need limiting here


class TemplateSerializer(OrgScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # no FK fields that need limiting here


# ----------------
# Tag + Link shape
# ----------------
class TagSerializer(OrgScopedSerializerMixin, serializers.ModelSerializer):
    """
    Exposes legacy link_* fields and also normalized target_kind/target_value
    so the frontend can open correct locations without guessing.
    """
    target_kind = serializers.SerializerMethodField()
    target_value = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = [
            "id", "name", "slug", "description",
            "link_document", "link_department", "link_collection", "link_url",
            "target_kind", "target_value",
        ]
        # 👇 allow creating tags without explicitly supplying slug
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
        }

    def create(self, validated_data):
        # Auto-slugify if slug not provided
        name = validated_data.get("name")
        if name and not validated_data.get("slug"):
            validated_data["slug"] = slugify(name)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # If name changes and no explicit slug given, update slug to match
        name = validated_data.get("name")
        if name and "slug" not in validated_data:
            validated_data["slug"] = slugify(name)
        return super().update(instance, validated_data)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Limit link targets to org
        for fname in ("link_document", "link_department", "link_collection"):
            if fname in self.fields:
                self.limit_queryset_to_org(fname)

    def get_target_kind(self, obj):
        if obj.link_department_id:
            return "department"
        if obj.link_collection_id:
            return "collection"
        if obj.link_document_id:
            return "document"
        if obj.link_url:
            return "external"
        return "none"

    def get_target_value(self, obj):
        if obj.link_department_id and obj.link_department:
            return {"slug": obj.link_department.slug}
        if obj.link_collection_id and obj.link_collection:
            return {"slug": obj.link_collection.slug}
        if obj.link_document_id:
            return {"id": obj.link_document_id}
        if obj.link_url:
            return {"url": obj.link_url}
        return {}


# ----------------------------
# Section / ResourceLink (child of Document)
# ----------------------------
class SectionSerializer(OrgScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.limit_queryset_to_org("document")


class ResourceLinkSerializer(OrgScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = ResourceLink
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.limit_queryset_to_org("document")


# -----------------------------
# Document with nested children
# -----------------------------
class DocumentSerializer(OrgScopedSerializerMixin, serializers.ModelSerializer):
    # Read-only nested children
    sections = SectionSerializer(many=True, read_only=True)
    links = ResourceLinkSerializer(many=True, read_only=True)
    # Tags as objects, because your frontend groups/opens them
    tags = TagSerializer(many=True, read_only=True)
    # Collections: just primary keys for now
    collections = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "slug",
            "status",
            "everyone",
            "template",
            "departments",
            "tags",
            "collections",   # 👈 add this line
            "created_at",
            "updated_at",
            "sections",
            "links",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Limit selectable relations to same org when writable
        for fname in ("template", "departments",):
            if fname in self.fields:
                self.limit_queryset_to_org(fname)

    def validate(self, attrs):
        """
        Enforce: if a document is not visible to everyone (everyone=False),
        it must belong to at least one department.
        """
        attrs = super().validate(attrs)

        # everyone flag: prefer incoming attrs, fallback to instance value
        everyone = attrs.get(
            "everyone",
            getattr(self.instance, "everyone", False),
        )

        # departments can be passed in attrs (for writes) or already on instance
        departments = attrs.get("departments", None)
        if departments is None and self.instance is not None:
          departments = self.instance.departments.all()

        dept_count = 0
        if departments is not None:
            if hasattr(departments, "exists"):
                dept_count = 1 if departments.exists() else 0
            else:
                dept_count = len(departments)

        if not everyone and dept_count == 0:
            raise serializers.ValidationError(
                {
                    "departments": (
                        "Restricted documents (everyone=False) must belong to "
                        "at least one department."
                    )
                }
            )

        return attrs


# -----------------------------------------------
# "Rendered requirements" helper serializer (opt)
# -----------------------------------------------
class RequirementSnippetSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequirementSnippet
        fields = "__all__"


class RenderedRequirementsSerializer(serializers.ModelSerializer):
    """
    Returns computed requirements (list of dicts) for the document's tags.
    """
    requirements = serializers.SerializerMethodField()
    # keep tags in case the UI needs context
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = ["id", "title", "tags", "requirements"]

    def get_requirements(self, obj):
        return assemble_requirements_from_tags(obj.tags.all())


# -----------
# Collections
# -----------
class CollectionSerializer(OrgScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = ["id", "name", "slug", "description", "documents", "subcollections", "order"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for fname in ("documents", "subcollections"):
            if fname in self.fields:
                self.limit_queryset_to_org(fname)

    def validate(self, attrs):
        """
        Prevent self-nesting and obvious cycles on incoming payloads.
        (Deep cycle checks also exist in model.clean; this is a friendly API guard.)
        """
        instance = getattr(self, "instance", None)
        self_id = getattr(instance, "pk", None)

        subs = attrs.get("subcollections")
        if subs is not None:
            # prevent self-references
            if self_id and any(getattr(s, "pk", None) == self_id for s in subs):
                raise serializers.ValidationError({"subcollections": "A collection cannot include itself."})
        return super().validate(attrs)


# ----
# Tile
# ----
class TileSerializer(OrgScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Tile
        fields = [
            "id",
            "title",
            "kind",
            "href",
            "document",
            "department",
            "collection",
            "description",
            "order",
            "is_active",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for fname in ("document", "department", "collection"):
            if fname in self.fields:
                self.limit_queryset_to_org(fname)

    def validate(self, attrs):
        """
        Enforce that target matches kind & belongs to request.org.
        (Model.clean also enforces this; this keeps API errors friendlier.)
        """
        org = self._current_org()
        org_id = getattr(org, "id", None)

        kind = attrs.get("kind", getattr(self.instance, "kind", None))

        def gid(name):
            obj = attrs.get(name, getattr(self.instance, name, None))
            if obj is None:
                return None
            return getattr(obj, "org_id", None) or getattr(getattr(obj, "org", None), "id", None)

        if kind == "document":
            if attrs.get("document", getattr(self.instance, "document", None)) is None:
                raise serializers.ValidationError({"document": "Document tile requires a document."})
            if org_id is not None and gid("document") not in (None, org_id):
                raise serializers.ValidationError({"document": "Target document must belong to this organization."})

        elif kind == "department":
            if attrs.get("department", getattr(self.instance, "department", None)) is None:
                raise serializers.ValidationError({"department": "Department tile requires a department."})
            if org_id is not None and gid("department") not in (None, org_id):
                raise serializers.ValidationError({"department": "Target department must belong to this organization."})

        elif kind == "collection":
            if attrs.get("collection", getattr(self.instance, "collection", None)) is None:
                raise serializers.ValidationError({"collection": "Collection tile requires a collection."})
            if org_id is not None and gid("collection") not in (None, org_id):
                raise serializers.ValidationError({"collection": "Target collection must belong to this organization."})

        elif kind == "url":
            if not attrs.get("href", getattr(self.instance, "href", "")):
                raise serializers.ValidationError({"href": "URL tile requires an href."})

        return super().validate(attrs)
