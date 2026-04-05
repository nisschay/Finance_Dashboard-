import os
import time
from typing import Any, Dict

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)
FIREBASE_KEYS_TTL_SECONDS = int(os.getenv("FIREBASE_KEYS_TTL_SECONDS", "3600"))

_public_keys_cache: Dict[str, str] = {}
_public_keys_cache_expiry: float = 0.0


async def _fetch_firebase_public_keys() -> Dict[str, str]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(FIREBASE_CERTS_URL)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch Firebase public keys",
        ) from exc


async def _get_firebase_public_keys(force_refresh: bool = False) -> Dict[str, str]:
    global _public_keys_cache, _public_keys_cache_expiry

    now = time.time()
    if not force_refresh and _public_keys_cache and now < _public_keys_cache_expiry:
        return _public_keys_cache

    keys = await _fetch_firebase_public_keys()
    _public_keys_cache = keys
    _public_keys_cache_expiry = now + FIREBASE_KEYS_TTL_SECONDS
    return keys


async def verify_firebase_token(token: str) -> Dict[str, Any]:
    if not FIREBASE_PROJECT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FIREBASE_PROJECT_ID is not configured",
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token is missing",
        )

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing token key ID",
            )

        public_keys = await _get_firebase_public_keys()
        public_key = public_keys.get(kid)

        if not public_key:
            public_keys = await _get_firebase_public_keys(force_refresh=True)
            public_key = public_keys.get(kid)

        if not public_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token key ID is not valid",
            )

        decoded = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
        )

        firebase_uid = decoded.get("user_id") or decoded.get("sub")
        email = decoded.get("email")

        if not firebase_uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is missing Firebase UID",
            )

        return {
            "firebase_uid": firebase_uid,
            "email": email,
            "claims": decoded,
        }
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token",
        ) from exc
