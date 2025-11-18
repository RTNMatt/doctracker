from django.utils.deprecation import MiddlewareMixin
from django.http import HttpResponseForbidden
from .models import Organization

def extract_org_slug(host:str ) -> str | None:
    # examples for personal reference:
    # - acme.localhost:8000 -> acme
    # - acme.app.example.com -> acme
    # - localhost / 127.0.0.1 -> None (use dev header)
    host = (host or "").split(":")[0]
    parts = host.split(".")
    if "localhost" in host or host == "127.0.0.1":
        return None
    if len(parts) < 3:
        return None
    #subdomain . app . root
    return parts[0]

class OrgMiddleware(MiddlewareMixin):
    """
    Resolves request.org based on subdomain (prod) or X-Org-Slug header (dev).
    """
    def process_request(self,request):
        slug = extract_org_slug(request.get_host())
        if not slug:
            slug = request.headers.get("X-Org-Slug") or request.GET.get("org") #dev fallback

        if not slug:
            request.org = None
            return

        try:
            request.org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            return HttpResponseForbidden("Unknown organization")