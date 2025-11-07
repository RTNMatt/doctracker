
from django.core.exceptions import ValidationError
from django.db.models.signals import m2m_changed
from django.dispatch import receiver

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
