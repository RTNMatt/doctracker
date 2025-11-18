from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from docs.models import Organization, Membership, Department, Document, Section, Collection, Tile

class Command(BaseCommand):
    help = "Seed demo org, user, docs, collections, and tiles"

    def handle(self, *args, **opts):
        # Org
        org, _ = Organization.objects.get_or_create(
            slug="default",
            defaults={"name": "Default Org"},
        )

        # User + membership
        user, created = User.objects.get_or_create(
            username="admin",
            defaults={"email": "admin@example.com"}
        )
        if created:
            user.set_password("admin123")
            user.save()
        Membership.objects.get_or_create(org=org, user=user, defaults={"role": "admin"})

        # Department
        dept, _ = Department.objects.get_or_create(org=org, slug="it", defaults={"name": "IT"})

        # Document
        doc, _ = Document.objects.get_or_create(
            org=org,
            title="Welcome to Knowledge Stack",
            defaults={"everyone": True}
        )

        # Section (inherits org from document)
        Section.objects.get_or_create(
            document=doc,
            header="Getting Started",
            defaults={"body_md": "This is your first document."},
        )

        # Collection
        col, _ = Collection.objects.get_or_create(
            org=org,
            slug="onboarding",
            defaults={"name": "New Hire Onboarding"}
        )
        col.documents.add(doc)

        # Tiles
        Tile.objects.get_or_create(org=org, title="Welcome Doc", kind="document", document=doc, order=1, is_active=True)
        Tile.objects.get_or_create(org=org, title="Onboarding", kind="collection", collection=col, order=2, is_active=True)
        Tile.objects.get_or_create(org=org, title="Company Website", kind="external", href="https://example.com", order=3, is_active=True)

        self.stdout.write(self.style.SUCCESS("Seeded demo data.\nLogin: admin / admin123 (org: default)"))
