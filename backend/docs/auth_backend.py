
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError  # <-- add

class CookieJWTAuthentication(JWTAuthentication):
    """Read access token from HttpOnly cookie 'access'."""
    def authenticate(self, request):
        raw = request.COOKIES.get("access")
        if not raw:
            return None
        try:
            validated_token = self.get_validated_token(raw)
        except (InvalidToken, TokenError):         # <-- tolerate bad/expired cookie
            return None
        return self.get_user(validated_token), validated_token

def set_auth_cookies(resp, refresh: RefreshToken, *, secure=False, samesite="Lax"):
    access = str(refresh.access_token)
    resp.set_cookie("access", access, httponly=True, samesite=samesite, secure=secure)
    resp.set_cookie("refresh", str(refresh), httponly=True, samesite=samesite, secure=secure)
    return resp

def clear_auth_cookies(resp):
    resp.delete_cookie("access")
    resp.delete_cookie("refresh")
    return resp
