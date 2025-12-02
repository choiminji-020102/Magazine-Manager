# 표준 라이브러리
from datetime import datetime

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.model_refresh_token import RefreshToken


def create_refresh_token(admin_id: int, token: str, expires_at: datetime, db: Session) -> RefreshToken:
    """리프레시 토큰 생성 (중복 방지, 커밋은 호출부에서 처리)"""
    # 중복 체크 (unique 제약이 있지만 명시적으로 확인)
    existing = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 존재하는 토큰입니다."
        )
    
    new_refresh_token = RefreshToken(
        admin_id=admin_id,
        token=token,   
        expires_at=expires_at,
    )
    db.add(new_refresh_token)
    # 커밋은 호출부에서 처리 (트랜잭션 일관성을 위해)
    return new_refresh_token

def read_refresh_token_by_token(token: str, db: Session) -> RefreshToken:
    refresh_token = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="해당 Refresh Token을 찾을 수 없습니다.")
    return refresh_token

def revoke_refresh_token(token: str, db: Session) -> None:
    refresh_token = read_refresh_token_by_token(token, db)
    refresh_token.is_revoked = True
    refresh_token.revoked_at = datetime.now()
    db.commit()
    db.refresh(refresh_token)

def revoke_all_tokens_by_admin_id(admin_id: int, db: Session) -> None:
    """특정 관리자의 모든 리프레시 토큰 폐기 (로그인 시 기존 토큰 정리용, 커밋은 호출부에서 처리)"""
    tokens = db.query(RefreshToken).filter(
        and_(
            RefreshToken.admin_id == admin_id,
            RefreshToken.is_revoked.is_(False)  # SQLAlchemy 권장 방식
        )
    ).all()
    
    for token in tokens:
        token.is_revoked = True
        token.revoked_at = datetime.now()
    
    # 커밋은 호출부에서 처리 (트랜잭션 일관성을 위해)