# docs/models.py
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from django.db.models import Q
from django.conf import settings


# -----------------------------
# Core: Organization & Membership
# -----------------------------
class Organization(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    # basic branding; logo can be added later
    brand_primary = models.CharField(max_length=7, default="#3a7bfa", help_text="Hex color like #3a7bfa")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.slug})"


class Membership(models.Model):
    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("editor", "Editor"),
        ("viewer", "Viewer"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default="viewer")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "org"], name="uniq_membership_user_org"),
        ]
        indexes = [
            models.Index(fields=["org", "role"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.org} ({self.role})"

class UserTheme(models.Model):
    """
    Per-user theme preferences (mode + custom colors).
    This is global per user (not org-scoped).
    """
    MODE_CHOICES = (
        ("light", "Light"),
        ("dark", "Dark"),
        ("custom", "Custom"),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="theme",
    )
    mode = models.CharField(
        max_length=20,
        choices=MODE_CHOICES,
        default="light",
    )
    # Stores your CustomTheme shape:
    # {
    #   "sidebarBg": "#...",
    #   "sidebarText": "#...",
    #   ...
    # }
    custom = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Theme for {self.user}"


# -----------------------------
# Departments
# -----------------------------
class Department(models.Model):
    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["org", "slug"], name="uniq_department_org_slug"),
        ]
        indexes = [
            models.Index(fields=["org", "slug"]),
            models.Index(fields=["org", "name"]),
        ]

    def __str__(self) -> str:
        return f"{self.name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:200]
        super().save(*args, **kwargs)


# -----------------------------
# Templates
# -----------------------------
class Template(models.Model):
    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="templates")
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # allow multiple NULL/blank slugs, but enforce uniqueness when provided
            models.UniqueConstraint(
                fields=["org", "slug"],
                name="uniq_template_org_slug",
                condition=Q(slug__isnull=False) & ~Q(slug=""),
            ),
        ]
        indexes = [
            models.Index(fields=["org", "name"]),
            models.Index(fields=["org", "slug"]),
        ]

    def __str__(self) -> str:
        return self.name


# -----------------------------
# Tags
# -----------------------------
class Tag(models.Model):
    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="tags")
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    description = models.TextField(blank=True)

    # optional link targets
    link_document = models.ForeignKey("Document", null=True, blank=True, on_delete=models.SET_NULL, related_name="linked_tags")
    link_department = models.ForeignKey("Department", null=True, blank=True, on_delete=models.SET_NULL, related_name="linked_tags")
    link_collection = models.ForeignKey("Collection", null=True, blank=True, on_delete=models.SET_NULL, related_name="linked_tags")
    link_url = models.URLField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["org", "slug"], name="uniq_tag_org_slug"),
        ]
        indexes = [
            models.Index(fields=["org", "slug"]),
            models.Index(fields=["org", "name"]),
        ]

    def __str__(self) -> str:
        return self.name

    def clean(self):
    # If linked to objects, they must belong to the same org
        for field_name in ("link_document", "link_department", "link_collection"):
            obj = getattr(self, field_name, None)
            if obj is None:
                continue

            # Prefer org_id on the related object; fall back to obj.org.id if needed
            obj_org_id = getattr(obj, "org_id", None)
            if obj_org_id is None:
                obj_org = getattr(obj, "org", None)
                obj_org_id = getattr(obj_org, "id", None)

            if self.org_id and obj_org_id and obj_org_id != self.org_id:
                from django.core.exceptions import ValidationError
                raise ValidationError({field_name: "Linked object must belong to the same organization."})



# -----------------------------
# Documents (+ children)
# -----------------------------
class Document(models.Model):
    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("published", "Published"),
        ("archived", "Archived"),
    )

    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    everyone = models.BooleanField(default=False)

    template = models.ForeignKey(Template, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents")
    departments = models.ManyToManyField(Department, blank=True, related_name="documents")
    tags = models.ManyToManyField(Tag, blank=True, related_name="documents")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # enforce per-org uniqueness only when slug is provided
            models.UniqueConstraint(
                fields=["org", "slug"],
                name="uniq_document_org_slug",
                condition=Q(slug__isnull=False) & ~Q(slug=""),
            ),
        ]
        indexes = [
            models.Index(fields=["org", "slug"]),
            models.Index(fields=["org", "title"]),
            models.Index(fields=["org", "status"]),
            models.Index(fields=["org", "updated_at"]),
        ]

    def __str__(self) -> str:
        return self.title

    def clean(self):
        # FK orgs must match
        if self.template and self.template.org_id != self.org_id:
            raise ValidationError({"template": "Template must belong to the same organization."})

        # M2M org checks — during clean() we only validate if the instance has a pk and m2m are accessible
        # (full enforcement also happens in serializers/views)
        if self.pk:
            for dept in self.departments.all():
                if dept.org_id != self.org_id:
                    raise ValidationError({"departments": "All departments must belong to the same organization."})
            for tag in self.tags.all():
                if tag.org_id != self.org_id:
                    raise ValidationError({"tags": "All tags must belong to the same organization."})

    def save(self, *args, **kwargs):
        if not self.slug:
            # optional convenience; keeps slug unique per org when provided
            self.slug = slugify(self.title)[:200]
        super().save(*args, **kwargs)


class DocumentVersion(models.Model):
    """
    Snapshot of a document's structural metadata and visibility
    at a point in time. This sets us up for a simple version history.
    """
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="document_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # Who made the change (optional)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="document_versions",
    )

    # Core fields
    title = models.CharField(max_length=200)
    status = models.CharField(
        max_length=16,
        choices=Document.STATUS_CHOICES,
    )
    everyone = models.BooleanField(default=False)

    # Structural metadata snapshots (id lists)
    tag_ids = models.JSONField(default=list, blank=True)
    collection_ids = models.JSONField(default=list, blank=True)
    department_ids = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["org", "created_at"]),
            models.Index(fields=["document", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.document_id} @ {self.created_at:%Y-%m-%d %H:%M:%S}"



class Section(models.Model):
    # org is inherited via document.org
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="sections")
    header = models.CharField(max_length=200)
    body_md = models.TextField(blank=True)
    image = models.ImageField(upload_to="sections/", null=True, blank=True)

    # NEW: explicit ordering within a document
    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["document", "id"]),
            models.Index(fields=["document", "order"]),
        ]
        ordering = ["order", "id"]  # ensures stable ordering

    def __str__(self) -> str:
        return f"{self.header} @ {self.document_id}"



class ResourceLink(models.Model):
    # org is inherited via document.org
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="links")
    title = models.CharField(max_length=200)
    url = models.URLField(blank=True)
    note = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["document", "id"]),
            models.Index(fields=["title"]),
        ]

    def __str__(self) -> str:
        return self.title


# -----------------------------
# Collections (self-nesting allowed, self-cycles prevented)
# -----------------------------
class Collection(models.Model):
    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="collections")
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    documents = models.ManyToManyField(Document, blank=True, related_name="collections")
    subcollections = models.ManyToManyField(
        "self",
        symmetrical=False,
        blank=True,
        related_name="parent_collections",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["org", "slug"], name="uniq_collection_org_slug"),
        ]
        indexes = [
            models.Index(fields=["org", "slug"]),
            models.Index(fields=["org", "name"]),
            models.Index(fields=["org", "order"]),
        ]

    def __str__(self) -> str:
        return self.name

    def clean(self):
        # prevent self-nesting and cross-org links
        if self.pk and self.subcollections.filter(pk=self.pk).exists():
            raise ValidationError({"subcollections": "A collection cannot include itself."})
        # Cross-org checks where possible (only for already-related rows)
        if self.pk:
            for c in self.subcollections.all():
                if c.org_id != self.org_id:
                    raise ValidationError({"subcollections": "All subcollections must belong to the same organization."})
            for d in self.documents.all():
                if d.org_id != self.org_id:
                    raise ValidationError({"documents": "All documents must belong to the same organization."})

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:160]
        super().save(*args, **kwargs)


# -----------------------------
# Tiles (homepage / navigation)
# -----------------------------
class Tile(models.Model):
    KIND_CHOICES = (
        ("document", "Document"),
        ("department", "Department"),
        ("collection", "Collection"),
        ("url", "URL"),
    )

    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="tiles")
    title = models.CharField(max_length=160)
    kind = models.CharField(max_length=32, choices=KIND_CHOICES)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    # targets
    document = models.ForeignKey(Document, null=True, blank=True, on_delete=models.SET_NULL, related_name="tiles")
    department = models.ForeignKey(Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="tiles")
    collection = models.ForeignKey(Collection, null=True, blank=True, on_delete=models.SET_NULL, related_name="tiles")
    href = models.URLField(blank=True)

    description = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["org", "is_active", "order"]),
            models.Index(fields=["org", "kind"]),
            models.Index(fields=["org", "title"]),
        ]

    def __str__(self) -> str:
        return self.title

    def clean(self):
        # Ensure target matches kind and org
        if self.kind == "document":
            if not self.document:
                raise ValidationError({"document": "Document tile requires a document."})
            if self.document.org_id != self.org_id:
                raise ValidationError({"document": "Target document must belong to the same organization."})
        elif self.kind == "department":
            if not self.department:
                raise ValidationError({"department": "Department tile requires a department."})
            if self.department.org_id != self.org_id:
                raise ValidationError({"department": "Target department must belong to the same organization."})
        elif self.kind == "collection":
            if not self.collection:
                raise ValidationError({"collection": "Collection tile requires a collection."})
            if self.collection.org_id != self.org_id:
                raise ValidationError({"collection": "Target collection must belong to the same organization."})
        elif self.kind == "url":
            if not self.href:
                raise ValidationError({"href": "URL tile requires an href."})


# -----------------------------
# Requirement Snippets (optional; keep for now but likely being removed)
# -----------------------------
class RequirementSnippet(models.Model):
    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="requirement_snippets")
    title = models.CharField(max_length=160)
    content_md = models.TextField(blank=True)
    tag = models.ForeignKey(Tag, null=True, blank=True, on_delete=models.SET_NULL, related_name="requirement_snippets")
    priority = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["org", "priority"]),
            models.Index(fields=["org", "title"]),
        ]

    def __str__(self) -> str:
        return self.title


# --- helpers for serializers -------------------------------------------------

def assemble_requirements_from_tags(tag_or_tags):
    """
    Given a Tag instance or an iterable/queryset of Tag objects, return a simple
    list of requirement snippets (dicts) for those tags, constrained to the
    same org where possible, ordered by (priority, title).
    """
    # Local import is not required (we're in the same module), but kept explicit for clarity.
    # from .models import RequirementSnippet, Tag  # not needed here

    # Normalize input to a list of tags
    try:
        # If single Tag instance was passed
        from .models import Tag as _Tag  # type: ignore
        if isinstance(tag_or_tags, _Tag):
            tags = [tag_or_tags]
        else:
            tags = list(tag_or_tags) if tag_or_tags is not None else []
    except Exception:
        tags = []

    # Determine org (if we can) from the first tag
    org_id = None
    if tags:
        # Prefer org_id attribute when present
        org_id = getattr(tags[0], "org_id", None)
        if org_id is None:
            org = getattr(tags[0], "org", None)
            org_id = getattr(org, "id", None)

    # Build queryset
    qs = RequirementSnippet.objects.all()
    if tags:
        qs = qs.filter(tag__in=tags)
    if org_id:
        qs = qs.filter(org_id=org_id)

    # Shape the payload as simple dicts (friendly for SerializerMethodField)
    qs = qs.order_by("priority", "title")
    return [
        {
            "id": r.id,
            "title": r.title,
            "content_md": r.content_md,
            "tag": r.tag_id,
            "priority": r.priority,
        }
        for r in qs
    ]
