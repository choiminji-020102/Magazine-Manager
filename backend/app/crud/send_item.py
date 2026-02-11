# 표준 라이브러리
from typing import Optional, List
from datetime import datetime

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.send_item import SendItem
from app.models.send import Send
from app.schemas.send_item import SendItemUpdate


def read_send_item_by_id(send_item_id: int, db: Session) -> SendItem:
    """발송 품목 ID로 발송 품목 조회"""
    send_item = db.query(SendItem).filter(
        SendItem.send_item_id == send_item_id
    ).first()
    if not send_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="발송 품목을 찾을 수 없습니다."
        )
    return send_item


def read_send_items_by_send_id(send_id: int, db: Session, include_cancelled: bool = False) -> List[SendItem]:
    """발송 ID로 발송 품목 목록 조회"""
    query = db.query(SendItem).filter(SendItem.send_id == send_id)
    if not include_cancelled:
        query = query.filter(SendItem.cancelled_at.is_(None))
    return query.order_by(SendItem.send_item_id.asc()).all()


def read_send_items_by_order_item_id(order_item_id: int, db: Session) -> List[dict]:
    """주문 품목 ID로 발송 품목 목록 조회 (Send 정보 포함)"""
    results = db.query(
        SendItem,
        Send.send_date,
        Send.courier_company,
        Send.tracking_no,
        Send.send_status
    ).join(Send, SendItem.send_id == Send.send_id)\
     .filter(
        SendItem.order_item_id == order_item_id,
        SendItem.cancelled_at.is_(None)
    ).order_by(Send.send_date.desc()).all()
    
    items = []
    for send_item, send_date, courier_company, tracking_no, send_status in results:
        item_dict = {
            **send_item.__dict__,
            "send_date": send_date,
            "courier_company": courier_company,
            "tracking_no": tracking_no,
            "send_status": send_status
        }
        items.append(item_dict)
    
    return items


def create_send_item(
    send_id: int,
    order_item_id: int,
    product_code: str,
    product_name: str,
    db: Session,
    send_num: int = 1,
    purchase: int = 0,
    unit_weight: float = 0.0,
    unit_width: float = 0.0,
    unit_length: float = 0.0,
    unit_height: float = 0.0
) -> SendItem:
    """발송 품목 생성"""
    try:
        send_item = SendItem(
            send_id=send_id,
            order_item_id=order_item_id,
            product_code=product_code,
            send_num=send_num,
            purchase=purchase,
            product_name=product_name,
            unit_weight=unit_weight,
            unit_width=unit_width,
            unit_length=unit_length,
            unit_height=unit_height
        )
        db.add(send_item)
        db.flush()
        return send_item
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"발송 품목 생성 중 오류가 발생했습니다: {str(e)}"
        )


def update_send_item(send_item: SendItem, item_in: SendItemUpdate, db: Session) -> SendItem:
    """발송 품목 수정"""
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(send_item, field, value)
    
    try:
        db.commit()
        db.refresh(send_item)
        return send_item
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"발송 품목 수정 중 오류가 발생했습니다: {str(e)}"
        )


def delete_send_item(send_item: SendItem, db: Session) -> None:
    """발송 품목 소프트 삭제"""
    send_item.cancelled_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(send_item)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"발송 품목 삭제 중 오류가 발생했습니다: {str(e)}"
        )
