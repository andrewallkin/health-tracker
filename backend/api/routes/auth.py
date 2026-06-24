from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from ...auth import create_token, decode_token, get_password_hash, verify_password
from ...config import get_settings
from ...database import get_db
from ...db_models import RefreshTokenRow, UserRow
from ..deps import get_current_user
from ..schemas_auth import AuthResponse, LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _user_out(user: UserRow) -> UserOut:
    return UserOut.model_validate(user)


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/api/auth",
        max_age=settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
    )


def _issue_tokens(db: Session, user: UserRow, response: Response) -> AuthResponse:
    access_token, _ = create_token(
        user.id,
        timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )
    refresh_token, refresh_jti = create_token(
        user.id,
        timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    db.add(
        RefreshTokenRow(
            id=str(refresh_jti),
            user_id=user.id,
            family_id=str(uuid.uuid4()),
            expires_at=datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days),
        )
    )
    db.commit()
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(access_token=access_token, user=_user_out(user))


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    normalized_email = payload.email.strip().lower()
    existing = db.query(UserRow).filter(UserRow.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already taken")

    user = UserRow(
        email=normalized_email,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.flush()
    return _issue_tokens(db, user, response)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    normalized_email = payload.email.strip().lower()
    user = db.query(UserRow).filter(UserRow.email == normalized_email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    return _issue_tokens(db, user, response)


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh cookie")

    try:
        payload = decode_token(refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    try:
        jti = uuid.UUID(payload["jti"])
        sub = payload["sub"]
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_row = (
        db.query(RefreshTokenRow)
        .filter(
            RefreshTokenRow.id == str(jti),
            RefreshTokenRow.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not token_row or token_row.is_revoked:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if token_row.is_used:
        family_tokens = (
            db.query(RefreshTokenRow)
            .filter(RefreshTokenRow.family_id == token_row.family_id)
            .all()
        )
        for token in family_tokens:
            token.is_revoked = True
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(UserRow).filter(UserRow.id == sub).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_row.is_used = True
    new_access, _ = create_token(
        sub,
        timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )
    new_refresh, new_jti = create_token(
        sub,
        timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    db.add(
        RefreshTokenRow(
            id=str(new_jti),
            user_id=sub,
            family_id=token_row.family_id,
            expires_at=datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days),
        )
    )
    db.commit()
    _set_refresh_cookie(response, new_refresh)
    return TokenResponse(access_token=new_access)


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    rows = db.query(RefreshTokenRow).filter(RefreshTokenRow.user_id == user.id).all()
    for row in rows:
        row.is_revoked = True
    db.commit()
    response.delete_cookie("refresh_token", path="/api/auth")
    return Response(status_code=204)
