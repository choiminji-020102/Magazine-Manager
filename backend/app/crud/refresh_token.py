# 표준 라이브러리
from datetime import datetime

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models import refresh_token as refresh_token_model


def create_refresh_token(admin_id: int, token: str, exp: int, db: Session) -> refresh_token_model.RefreshToken:
    """리프레시 토큰 생성"""
    expires_at = datetime.fromtimestamp(exp) # timestamp를 datetime으로 변환
    try:
        new_refresh_token = refresh_token_model.RefreshToken(
            admin_id=admin_id,
            token=token,   
            expires_at=expires_at,
        )
        db.add(new_refresh_token)
        db.commit()
        db.refresh(new_refresh_token)
        return new_refresh_token
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"리프레시 토큰 생성 중 오류가 발생했습니다: {str(e)}"
        )

def read_refresh_token_by_token(token: str, db: Session) -> refresh_token_model.RefreshToken:
    refresh_token = db.query(refresh_token_model.RefreshToken).filter(refresh_token_model.RefreshToken.token == token).first()
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="해당 Refresh Token을 찾을 수 없습니다.")
    return refresh_token

def exists_refresh_token(admin_id: int, token: str, db: Session) -> bool:
    """리프레시 토큰이 존재하고 폐기되지 않았는지 확인"""
    refresh_token = db.query(refresh_token_model.RefreshToken).filter(
        refresh_token_model.RefreshToken.admin_id == admin_id,
        refresh_token_model.RefreshToken.token == token,
        refresh_token_model.RefreshToken.revoked_at.is_(None)
    ).first()
    return refresh_token is not None # True or False

def revoke_refresh_token(token: str, db: Session) -> None:
    refresh_token = read_refresh_token_by_token(token, db)
    try:
        refresh_token.revoked_at = datetime.now()
        db.commit()
        db.refresh(refresh_token)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"리프레시 토큰 폐기 중 오류가 발생했습니다: {str(e)}"
        )

def revoke_all_tokens_by_admin_id(admin_id: int, db: Session) -> None:
    """특정 관리자의 모든 리프레시 토큰 일괄 폐기"""
    try:
        # 일괄 업데이트로 한 번의 쿼리와 한 번의 commit으로 모든 토큰 폐기
        updated_count = db.query(refresh_token_model.RefreshToken).filter(
            and_(
                refresh_token_model.RefreshToken.admin_id == admin_id,
                refresh_token_model.RefreshToken.revoked_at.is_(None)
            )
        ).update(
            {"revoked_at": datetime.now()},
            synchronize_session=False  # 성능 향상을 위해 세션 동기화 비활성화
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"리프레시 토큰 폐기 중 오류가 발생했습니다: {str(e)}"
        )