from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.models.admin import Admin
from app.models.refresh_token import RefreshToken
from app.core.security import verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.services import admin_service


def authenticate_admin(db: Session, email: str, password: str) -> Optional[Admin]:
    admin = admin_service.get_admin_by_email(db, email)
    if admin is None:
        return None
    if not verify_password(password, admin.hashed_password):
        return None
    return admin


def create_tokens(db: Session, admin: Admin) -> tuple[str, str]:
    payload = {
        "admin_id": admin.admin_id,
        "email": admin.email,
        "admin_role": admin.admin_role
    }
    
    access_token = create_access_token(payload)
    refresh_token = create_refresh_token(payload)
    
    # Store refresh token
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    token_record = RefreshToken(
        admin_id=admin.admin_id,
        token=refresh_token,
        expires_at=expires_at
    )
    db.add(token_record)
    db.commit()
    
    return access_token, refresh_token


def get_refresh_token(db: Session, token: str) -> Optional[RefreshToken]:
    return db.query(RefreshToken).filter(
        RefreshToken.token == token,
        RefreshToken.expires_at > datetime.now(timezone.utc),
        RefreshToken.revoked_at.is_(None)
    ).first()


def revoke_refresh_token(db: Session, token: str) -> None:
    token_record = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if token_record:
        token_record.revoked_at = datetime.now(timezone.utc)
        db.commit()


def revoke_all_tokens_for_admin(db: Session, admin_id: int) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.admin_id == admin_id,
        RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": datetime.now(timezone.utc)})
    db.commit()
