from django.db import models
from django.utils.text import slugify
from django.utils import timezone


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Template(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)

    font_family = models.CharField(max_length=120, default="Inter, Segoe UI, Roboto, Arial, sans-serif")
    base_font_size_px = models.PositiveIntegerField(default=16)
    color_bg = models.CharField(max_length=16, default="#0f172a")
    color_text = models.CharField(max_length=16, default="#94a3b8")
    color_text_strong = models.CharField(max_length=16, default="#e2e8f0")
    color_accent = models.CharField(max_length=16, default="#2dd4bf")

    header_html = models.TextField(blank=True)
    footer_html = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Document(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
        ("archived", "Archived"),
    ]

    title = models.CharField(max_length=200)
    template = models.ForeignKey(Template, on_delete=models.SET_NULL, null=True, blank=True, related_name="documents")

    # visibility
    everyone = models.BooleanField(default=True, help_text="If true, visible to all; if false, restrict by departments.")
    departments = models.ManyToManyField(Department, blank=True, related_name="documents")

    # governance
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    last_reviewed = models.DateField(null=True, blank=True)
    review_interval_days = models.PositiveIntegerField(default=180)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # tags applied to this doc
    # defined below after Tag model (M2M)

    def is_stale(self):
        if not self.last_reviewed:
            return True
        return (timezone.now().date() - self.last_reviewed).days > self.review_interval_days

    def __str__(self):
        return self.title


class Section(models.Model):
    """
    A flexible section (header + body). Orderable per document.
    If you want a dedicated 'Requirements' section, just make one with that header.
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="sections")
    order = models.PositiveIntegerField(default=0)
    header = models.CharField(max_length=160)
    body_md = models.TextField(blank=True, help_text="Markdown content")

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.document.title} :: {self.header} ({self.order})"


class ResourceLink(models.Model):
    """
    External/internal link references for the doc.
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="links")
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=160)
    url = models.URLField()
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.document.title} -> {self.title}"


class Tag(models.Model):
    """
    Tags that drive automatic requirement injection.
    Each tag may link to a specific doc (internal) and/or a URL (external).
    """
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)

    # Auto-link targets (optional)
    link_document = models.ForeignKey("Document", null=True, blank=True, on_delete=models.SET_NULL, related_name="linked_by_tags")
    link_url = models.URLField(blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name


# M2M after Tag is defined
Document.add_to_class("tags", models.ManyToManyField(Tag, blank=True, related_name="documents"))


class RequirementSnippet(models.Model):
    """
    A reusable Markdown piece that represents a 'requirement' block associated with a tag.
    e.g., "How to access Cloud PBX"
    """
    title = models.CharField(max_length=160)
    content_md = models.TextField(help_text="Markdown content")
    active = models.BooleanField(default=True)

    # If tied to a tag, apply when that tag is present
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="snippets")

    priority = models.IntegerField(default=100)  # lower number = higher up

    class Meta:
        ordering = ["priority", "id"]
        unique_together = [("tag", "title")]

    def __str__(self):
        return f"[{self.tag.name}] {self.title}"


# ---------- Helper for 'rendered requirements' ----------
def assemble_requirements_from_tags(doc: Document):
    """
    Build a list of requirements derived from the document's tags.
    Return a normalized structure:
      [{ "title": ..., "content_md": ..., "links": [ ... ] }, ...]
    Where links include tag.link_url or tag.link_document (if present).
    """
    items = []
    tags = doc.tags.all().prefetch_related("snippets")
    for tag in tags:
        for snip in tag.snippets.filter(active=True):
            entry = {
                "title": snip.title,
                "content_md": snip.content_md,
                "links": [],
                "tag": tag.slug,
            }
            if tag.link_url:
                entry["links"].append({"title": f"{tag.name} reference", "url": tag.link_url})
            if tag.link_document_id:
                entry["links"].append({"title": f"{tag.name} doc", "document_id": tag.link_document_id})
            items.append(entry)
    # Already ordered by snippet.priority
    return items
