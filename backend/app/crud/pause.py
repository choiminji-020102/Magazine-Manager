# 표준 라이브러리
from datetime import datetime, timezone
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.pause import Pause
from app.schemas.pause import PauseUpdate


def read_pause_by_id(db: Session, pause_id: int) -> Pause:
    """휴지 조회 (삭제된 것 포함 — is_deleted 상태 확인은 service에서)"""
    pause = db.query(Pause).filter(Pause.pause_id == pause_id).first()
    if not pause:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="휴지를 찾을 수 없습니다.",
        )
    return pause


def read_pauses_by_order_item_id(db: Session, order_item_id: int) -> List[Pause]:
    return (
        db.query(Pause)
        .filter(
            Pause.order_item_id == order_item_id,
            Pause.deleted_at.is_(None),
        )
        .order_by(Pause.pause_issue)
        .all()
    )


def list_pauses(
    db: Session,
    page: int = 1,
    limit: int = 20,
    order_item_id: Optional[int] = None,
    pause_issue: Optional[str] = None,
    is_deleted: bool = False,
    admin_id: Optional[int] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[Pause], int]:
    query = db.query(Pause)

    if order_item_id is not None:
        query = query.filter(Pause.order_item_id == order_item_id)
    if pause_issue:
        query = query.filter(Pause.pause_issue == pause_issue)
    if is_deleted:
        query = query.filter(Pause.deleted_at.isnot(None))
    else:
        query = query.filter(Pause.deleted_at.is_(None))
    if admin_id is not None:
        query = query.filter(Pause.admin_id == admin_id)

    allowed_sort = {"created_at", "updated_at", "pause_issue", "deleted_at"}
    sort_col = getattr(Pause, sort_by if sort_by in allowed_sort else "created_at")
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total


def check_duplicate_pause(db: Session, order_item_id: int, pause_issue: str) -> bool:
    """동일 품목의 동일 호에 활성 휴지가 이미 있는지 확인"""
    return (
        db.query(Pause)
        .filter(
            Pause.order_item_id == order_item_id,
            Pause.pause_issue == pause_issue,
            Pause.deleted_at.is_(None),
        )
        .first() is not None
    )


def create_pause(
    db: Session,
    order_item_id: int,
    pause_issue: str,
    admin_id: int,
    reason: Optional[str] = None,
) -> Pause:
    pause = Pause(
        order_item_id=order_item_id,
        pause_issue=pause_issue,
        reason=reason,
        admin_id=admin_id,
    )
    db.add(pause)
    db.flush()
    return pause


def update_pause(db: Session, pause: Pause, pause_in: PauseUpdate) -> Pause:
    for field, value in pause_in.model_dump(exclude_unset=True).items():
        setattr(pause, field, value)
    db.commit()
    db.refresh(pause)
    return pause


def soft_delete_pause(db: Session, pause: Pause) -> Pause:
    pause.is_deleted = True
    pause.deleted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pause)
    return pause


def restore_pause(db: Session, pause: Pause) -> Pause:
    pause.is_deleted = False
    pause.deleted_at = None
    db.commit()
    db.refresh(pause)
    return pause
