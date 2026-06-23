import jwt
from functools import lru_cache
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.config import settings
from app.core.database import get_db

security = HTTPBearer()


def _get_supabase_base_url() -> str:
    url = settings.SUPABASE_URL.strip().rstrip("/")
    if url.endswith("/rest/v1"):
        url = url[: -len("/rest/v1")]
    return url


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    jwks_url = f"{_get_supabase_base_url()}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True)


def _decode_supabase_token(token: str) -> dict:
    bypass_signature = (
        settings.ENVIRONMENT == "development"
        and (
            not settings.SUPABASE_JWT_SECRET
            or settings.SUPABASE_JWT_SECRET == "your-supabase-jwt-secret-from-dashboard"
        )
    )

    if bypass_signature:
        return jwt.decode(token, options={"verify_signature": False, "verify_aud": False})

    alg = jwt.get_unverified_header(token).get("alg", "")

    if alg == "HS256":
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )

    if alg in ("RS256", "ES256"):
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=[alg],
            audience="authenticated",
        )

    raise jwt.InvalidTokenError(f"Unsupported JWT algorithm: {alg}")

class UserPayload(BaseModel):
    id: str
    email: Optional[EmailStr] = None
    role: str = "patient"  # default role

def verify_supabase_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserPayload:
    """
    Decodes and verifies the Supabase Auth JWT.
    """
    token = credentials.credentials
    
    # 1. Support sandbox/demo mock tokens in development mode
    if token.startswith("mock-token."):
        if settings.ENVIRONMENT != "development":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Mock authentication is only permitted in development mode."
            )
        import base64
        import json
        try:
            parts = token.split(".")
            # Base64 padding correction if needed
            payload_b64 = parts[2]
            payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
            payload_str = base64.b64decode(payload_b64).decode("utf-8")
            payload = json.loads(payload_str)
            
            user_id = payload.get("sub")
            email = payload.get("email")
            app_metadata = payload.get("app_metadata", {})
            role = app_metadata.get("role") or "patient"
            
            if not user_id:
                raise ValueError("Missing subject field (sub).")
                
            return UserPayload(id=user_id, email=email, role=role)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid mock token format: {str(e)}"
            )

    try:
        payload = _decode_supabase_token(token)
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        app_metadata = payload.get("app_metadata", {})
        user_metadata = payload.get("user_metadata", {})
        
        role = app_metadata.get("role") or user_metadata.get("role") or "patient"
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: Missing subject (sub)."
            )
            
        return UserPayload(id=user_id, email=email, role=role)
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please sign in again."
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}"
        )

def get_current_user(payload: UserPayload = Depends(verify_supabase_jwt)) -> UserPayload:
    """
    Returns the authenticated user's payload.
    """
    return payload

def require_admin(user: UserPayload = Depends(get_current_user)) -> UserPayload:
    """
    Restricts access to Admin role users.
    """
    if user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin permissions required."
        )
    return user

def require_patient(
    user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPayload:
    """
    Restricts access to Patient role users.
    Also allows authenticated users who have a patient record in the database
    (e.g. admin-created profiles before first login sync).
    """
    if user.role.lower() == "patient":
        return user

    from app.services.patient_resolver import resolve_patient_for_user

    if resolve_patient_for_user(user, db, link_auth=False):
        return user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. Patient permissions required."
    )
