
from django.core.exceptions import ValidationError
from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver
from .models import Collection, Document, Tag

from .models import Collection

def _would_create_cycle(parent: Collection, child: Collection) -> bool:
    """
    Returns True if adding child under parent would create a cycle.
    Detects self and deeper cycles (e.g., A->B->...->A).
    """
    if parent.pk == child.pk:
        return True

    # BFS/DFS over subcollections
    seen = set()
    stack = [child]
    while stack:
        node = stack.pop()
        if node.pk == parent.pk:
            return True
        if node.pk in seen:
            continue
        seen.add(node.pk)
        stack.extend(node.subcollections.all())

    return False

@receiver(m2m_changed, sender=Collection.subcollections.through)
def guard_subcollections(sender, instance: Collection, action, reverse, pk_set, **kwargs):
    """
    Prevent self-inclusion and cycles when editing Collection.subcollections.
    Triggers for admin/API edits.
    """
    if action not in ("pre_add", "pre_set"):
        return

    # Self-inclusion quick check
    if instance.pk in pk_set:
        raise ValidationError("A collection cannot include itself.")

    # Cycle check for each candidate child
    children = Collection.objects.filter(pk__in=pk_set)
    for child in children:
        if _would_create_cycle(instance, child):
            raise ValidationError("This nesting would create a circular collection chain.")

def _auto_tags_for_doc(doc: Document):
    """Compute structural tags implied by doc's departments/collections."""
    dept_ids = list(doc.departments.values_list("id", flat=True))
    col_ids  = list(doc.collections.values_list("id", flat=True))  # reverse M2M from Collection.documents
    tags_qs = Tag.objects.none()

    if dept_ids:
        tags_qs = tags_qs.union(Tag.objects.filter(link_department_id__in=dept_ids))
    if col_ids:
        tags_qs = tags_qs.union(Tag.objects.filter(link_collection_id__in=col_ids))

    return list(tags_qs)

def _sync_structural_tags(doc: Document):
    """Add missing structural tags; remove obsolete structural tags only."""
    want = set(_auto_tags_for_doc(doc))
    have = set(doc.tags.all())

    # Add any missing structural tags
    to_add = [t for t in want if t not in have]
    if to_add:
        doc.tags.add(*to_add)

    # Remove structural tags that no longer apply
    obsolete = [t for t in have
                if (t.link_department_id or t.link_collection_id) and t not in want]
    if obsolete:
        doc.tags.remove(*obsolete)

@receiver(m2m_changed, sender=Document.departments.through)
def doc_departments_changed(sender, instance: Document, action, **kwargs):
    if action in ("post_add", "post_remove", "post_clear"):
        _sync_structural_tags(instance)

@receiver(m2m_changed, sender=Collection.documents.through)
def collection_documents_changed(sender, instance: Collection, action, pk_set, **kwargs):
    if action in ("post_add", "post_remove", "post_clear"):
        # instance is the Collection; affected docs are in pk_set (except clear)
        if action == "post_clear":
            for doc in instance.documents.all():
                _sync_structural_tags(doc)
        else:
            for doc_id in pk_set:
                try:
                    doc = Document.objects.get(pk=doc_id)
                    _sync_structural_tags(doc)
                except Document.DoesNotExist:
                    pass

@receiver(post_save, sender=Tag)
def tag_saved_backfill(sender, instance: Tag, created, **kwargs):
    if not (instance.link_department_id or instance.link_collection_id):
        return
    # Find all matching docs and ensure they have the tag
    if instance.link_department_id:
        docs = Document.objects.filter(departments=instance.link_department_id)
    else:
        docs = Document.objects.filter(collections=instance.link_collection_id)
    for d in docs:
        d.tags.add(instance)