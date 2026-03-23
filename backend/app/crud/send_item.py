# 표준 라이브러리
from datetime import datetime, timezone
from typing import List, Optional

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.send_item import SendItem
from app.schemas.send_item import SendItemUpdate


def read_send_item_by_id(db: Session, send_item_id: int) -> SendItem:
    """발송 품목 ID로 발송 품목 조회"""
    send_item = db.query(SendItem).filter(SendItem.send_item_id == send_item_id).first()
    if not send_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="발송 품목을 찾을 수 없습니다.",
        )
    return send_item


def read_send_items_by_send_id(
    db: Session,
    send_id: int,
    include_cancelled: bool = False,
) -> List[SendItem]:
    """발송 ID로 발송 품목 목록 조회"""
    query = db.query(SendItem).filter(SendItem.send_id == send_id)
    if not include_cancelled:
        query = query.filter(SendItem.cancelled_at.is_(None))
    return query.order_by(SendItem.send_item_id.asc()).all()


def create_send_item(
    db: Session,
    send_id: int,
    order_item_id: int,
    product_code: str,
    product_name: str,
    issue: str,
    send_num: int = 1,
    cost_price: int = 0,
    unit_weight: Optional[float] = None,
    unit_width: Optional[float] = None,
    unit_length: Optional[float] = None,
    unit_height: Optional[float] = None,
) -> SendItem:
    """발송 품목 생성"""
    send_item = SendItem(
        send_id=send_id,
        order_item_id=order_item_id,
        product_code=product_code,
        product_name=product_name,
        issue=issue,
        send_num=send_num,
        cost_price=cost_price,
        unit_weight=unit_weight,
        unit_width=unit_width,
        unit_length=unit_length,
        unit_height=unit_height,
    )
    db.add(send_item)
    db.flush()
    return send_item


def update_send_item(db: Session, send_item: SendItem, item_in: SendItemUpdate) -> SendItem:
    """발송 품목 수정"""
    for field, value in item_in.model_dump(exclude_unset=True).items():
        setattr(send_item, field, value)
    db.commit()
    db.refresh(send_item)
    return send_item


def cancel_send_item(db: Session, send_item: SendItem) -> SendItem:
    """발송 품목 취소 (소프트 삭제)"""
    send_item.cancelled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(send_item)
    return send_item
