# 표준 라이브러리
from typing import Optional, List
from datetime import datetime

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.pause import Pause
from app.schemas.pause import PauseUpdate


def read_pause_by_id(pause_id: int, db: Session) -> Pause:
    """휴지 ID로 휴지 조회"""
    pause = db.query(Pause).filter(
        Pause.pause_id == pause_id,
        Pause.deleted_at.is_(None)
    ).first()
    if not pause:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="휴지를 찾을 수 없습니다."
        )
    return pause


def read_pauses_by_order_item_id(order_item_id: int, db: Session) -> List[Pause]:
    """주문 품목 ID로 휴지 목록 조회"""
    return db.query(Pause).filter(
        Pause.order_item_id == order_item_id,
        Pause.deleted_at.is_(None)
    ).order_by(Pause.pause_issue).all()


def check_pause_exists_for_issue(order_item_id: int, pause_issue: str, db: Session) -> bool:
    """해당 호에 휴지가 이미 존재하는지 확인"""
    return db.query(Pause).filter(
        Pause.order_item_id == order_item_id,
        Pause.pause_issue == pause_issue,
        Pause.deleted_at.is_(None)
    ).first() is not None


def create_pause(
    order_item_id: int,
    pause_issue: str,
    db: Session,
    reason: Optional[str] = None,
    admin_id: Optional[int] = None
) -> Pause:
    """휴지 생성"""
    try:
        pause = Pause(
            order_item_id=order_item_id,
            pause_issue=pause_issue,
            reason=reason,
            admin_id=admin_id
        )
        db.add(pause)
        db.flush()
        return pause
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"휴지 생성 중 오류가 발생했습니다: {str(e)}"
        )


def update_pause(pause: Pause, pause_in: PauseUpdate, db: Session) -> Pause:
    """휴지 수정"""
    update_data = pause_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pause, field, value)
    
    try:
        db.commit()
        db.refresh(pause)
        return pause
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"휴지 수정 중 오류가 발생했습니다: {str(e)}"
        )


def delete_pause(pause: Pause, db: Session) -> None:
    """휴지 소프트 삭제"""
    pause.deleted_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(pause)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"휴지 삭제 중 오류가 발생했습니다: {str(e)}"
        )
