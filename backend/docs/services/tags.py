from django.db.models import Q
from django.utils.text import slugify
from ..models import Document, Tag, Department, Collection  # keep your imports

def ensure_department_tag(dept: Department) -> Tag:
    """
    Ensure 1 Tag exists pointing at this department, in the same org.
    If a tag exists, keep its name/slug in sync with the department name.
    """
    tag, created = Tag.objects.get_or_create(
        org=dept.org,
        link_department=dept,
        defaults={"name": dept.name, "slug": slugify(dept.name)},
    )
    # Keep tag label/slug aligned with department name
    if not created and tag.name != dept.name:
        tag.name = dept.name
        tag.slug = slugify(dept.name)
        tag.save(update_fields=["name", "slug"])
    return tag

def ensure_collection_tag(col: Collection) -> Tag:
    """
    Ensure 1 Tag exists pointing at this collection, in the same org.
    Keep its name/slug aligned with the collection name.
    """
    tag, created = Tag.objects.get_or_create(
        org=col.org,
        link_collection=col,
        defaults={"name": col.name, "slug": slugify(col.name)},
    )
    if not created and tag.name != col.name:
        tag.name = col.name
        tag.slug = slugify(col.name)
        tag.save(update_fields=["name", "slug"])
    return tag


def _auto_tags_for_doc(doc: Document):
    """
    Structural tags are those that point at any of the doc's departments/collections.
    Avoid union().distinct() — use a single OR filter instead.
    """
    dept_ids = list(doc.departments.values_list("id", flat=True))
    col_ids  = list(doc.collections.values_list("id", flat=True))  # reverse M2M via Collection.documents

    q = Q()
    if dept_ids:
        q |= Q(link_department_id__in=dept_ids)
    if col_ids:
        q |= Q(link_collection_id__in=col_ids)

    if not q:
        return Tag.objects.none()

    # Ensure we only ever pick tags in this org
    return Tag.objects.filter(org=doc.org).filter(q).distinct()


def sync_structural_tags(doc: Document) -> None:
    """
    Add/remove only 'structural' tags (dept/collection) so that they match
    doc.departments / doc.collections. Leave other tags alone.
    """
    want = set(_auto_tags_for_doc(doc))
    have = set(doc.tags.all())

    to_add = [t for t in want if t not in have]
    if to_add:
        doc.tags.add(*to_add)

    to_remove = [
        t for t in have
        if (t.link_department_id or t.link_collection_id) and t not in want
    ]
    if to_remove:
        doc.tags.remove(*to_remove)