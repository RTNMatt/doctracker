from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from docs.models import (
    Organization, Membership,
    Department, Template, Tag, RequirementSnippet,
    Document, Section, ResourceLink
)

class Command(BaseCommand):
    help = "Seed initial data for DocTracker (tags + snippets, sample doc)"

    def handle(self, *args, **options):
        # Org + admin
        org, _ = Organization.objects.get_or_create(
            slug="default",
            defaults={"name": "Default Org"}
        )

        user, created = User.objects.get_or_create(
            username="admin",
            defaults={"email": "admin@example.com"}
        )
        if created:
            user.set_password("admin123")
            user.save()

        Membership.objects.get_or_create(
            org=org,
            user=user,
            defaults={"role": "admin"}
        )

        # Departments
        dep_net, _ = Department.objects.get_or_create(org=org, slug="network", defaults={"name": "Network"})
        dep_support, _ = Department.objects.get_or_create(org=org, slug="support", defaults={"name": "Support"})

        # Template
        tpl, _ = Template.objects.get_or_create(
            org=org,
            name="Default",
            defaults={
                "font_family": "Inter, Segoe UI, Roboto, Arial, sans-serif",
                "base_font_size_px": 16,
                "color_bg": "#0f172a",
                "color_text": "#94a3b8",
                "color_text_strong": "#e2e8f0",
                "color_accent": "#2dd4bf",
                "header_html": "<h1 style='margin:0'>DocTracker</h1>",
                "footer_html": "<small>© Your Company</small>",
            },
        )

        # Tags + snippets
        tag_cpbx, _ = Tag.objects.get_or_create(
            org=org,
            name="cPBX",
            defaults={"description": "Cloud PBX related"}
        )

        RequirementSnippet.objects.get_or_create(
            org=org,
            tag=tag_cpbx,
            title="Cloud PBX Access",
            defaults={
                "content_md": (
                    "To access Cloud PBX admin:\n\n"
                    "1. Go to the admin portal.\n"
                    "2. Sign in with SSO/Okta.\n"
                    "3. Ensure your role is Admin/Editor."
                ),
                "active": True,
                "priority": 10,
            },
        )

        # Sample doc
        doc, _ = Document.objects.get_or_create(
            org=org,
            title="Sample: User Provisioning",
            defaults={
                "template": tpl,
                "everyone": False,
                "status": "draft",
            },
        )

        doc.departments.set([dep_support])
        doc.tags.set([tag_cpbx])

        # Sections (inherit org through doc)
        Section.objects.get_or_create(
            document=doc,
            header="Overview",
            defaults={"body_md": "Purpose and scope."}
        )

        Section.objects.get_or_create(
            document=doc,
            header="Procedure",
            defaults={"body_md": "1. Step one\n2. Step two"}
        )

        # Links (inherit org through doc)
        ResourceLink.objects.get_or_create(
            document=doc,
            title="Internal Handbook",
            url="https://example.com/handbook",
            defaults={"note": ""}
        )

        self.stdout.write(self.style.SUCCESS("Seed complete. Login: admin/admin123 (org: default)"))
