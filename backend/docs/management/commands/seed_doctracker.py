from django.core.management.base import BaseCommand
from docs.models import Department, Template, Tag, RequirementSnippet, Document, Section, ResourceLink

class Command(BaseCommand):
    help = "Seed initial data for DocTracker (tags + snippets, sample doc)"

    def handle(self, *args, **options):
        # Departments
        dep_net, _ = Department.objects.get_or_create(name="Network")
        dep_support, _ = Department.objects.get_or_create(name="Support")

        # Template
        tpl, _ = Template.objects.get_or_create(
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
        tag_cpbx, _ = Tag.objects.get_or_create(name="cPBX", defaults={"description": "Cloud PBX related"})
        RequirementSnippet.objects.get_or_create(
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
        doc = Document.objects.create(
            title="Sample: User Provisioning",
            template=tpl,
            everyone=False,
            status="draft",
        )
        doc.departments.set([dep_support])
        doc.tags.set([tag_cpbx])

        Section.objects.create(document=doc, order=0, header="Overview", body_md="Purpose and scope.")
        Section.objects.create(document=doc, order=1, header="Procedure", body_md="1. Step one\n2. Step two")
        ResourceLink.objects.create(document=doc, order=0, title="Internal Handbook", url="https://example.com/handbook")

        self.stdout.write(self.style.SUCCESS("Seed complete."))
