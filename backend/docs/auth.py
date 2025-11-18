# docs/auth.py
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth import authenticate
from django.conf import settings

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class CookieJWTAuthentication(JWTAuthentication):
    """
    Authenticate using the 'access' cookie instead of Authorization header.
    """
    def authenticate(self, request):
        raw = request.COOKIES.get("access")
        if not raw:
            return None

        # Gracefully tolerate expired/invalid tokens
        try:
            validated_token = self.get_validated_token(raw)
        except (InvalidToken, TokenError):
            return None

        return self.get_user(validated_token), validated_token


def set_auth_cookies(resp, refresh, *, prod=False):
    """
    Set cookie flags depending on environment.
    prod=True → Secure + SameSite=None (required for cross-subdomain auth)
    dev       → Insecure cookies with Lax to simplify local debugging
    """
    access = str(refresh.access_token)

    if prod:
        # Production (HTTPS + cross-subdomain support)
        resp.set_cookie(
            "access", access,
            httponly=True,
            secure=True,
            samesite="None"
        )
        resp.set_cookie(
            "refresh", str(refresh),
            httponly=True,
            secure=True,
            samesite="None"
        )
    else:
        # Development (localhost)
        resp.set_cookie(
            "access", access,
            httponly=True,
            secure=False,
            samesite="Lax"
        )
        resp.set_cookie(
            "refresh", str(refresh),
            httponly=True,
            secure=False,
            samesite="Lax"
        )

    return resp


def clear_auth_cookies(resp):
    """
    Remove JWT cookies cleanly.
    """
    resp.delete_cookie("access")
    resp.delete_cookie("refresh")
    return resp


@method_decorator(csrf_exempt, name="dispatch")   # Dev mode: no CSRF
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(request, username=username, password=password)
        if not user:
            return Response({"detail": "Invalid credentials"}, status=401)

        refresh = RefreshToken.for_user(user)
        resp = Response({"ok": True})

        # Use secure cookies in production automatically
        return set_auth_cookies(resp, refresh, prod=not settings.DEBUG)


class LogoutView(APIView):
    def post(self, request):
        resp = Response({"ok": True})
        return clear_auth_cookies(resp)


class MeView(APIView):
    """
    Returns the authenticated user's identity, org, and role.
    """
    def get(self, request):
        org = getattr(request, "org", None)
        role = None

        if org and request.user.is_authenticated:
            from .models import Membership
            role = Membership.objects.filter(
                org=org, user=request.user
            ).values_list("role", flat=True).first()

        return Response({
            "user": {
                "id": request.user.id,
                "username": request.user.username
            } if request.user.is_authenticated else None,

            "org": {
                "id": getattr(org, "id", None),
                "slug": getattr(org, "slug", None)
            } if org else None,

            "role": role,
            "authenticated": request.user.is_authenticated,
        })


@method_decorator(csrf_exempt, name="dispatch")
class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get("refresh")
        if not raw:
            return Response({"detail": "No refresh"}, status=401)

        try:
            token = RefreshToken(raw)
            new_refresh = RefreshToken.for_user(token.user)
        except Exception:
            return Response({"detail": "Invalid refresh"}, status=401)

        resp = Response({"ok": True})

        # Same production rule as Login
        return set_auth_cookies(resp, new_refresh, prod=not settings.DEBUG)
