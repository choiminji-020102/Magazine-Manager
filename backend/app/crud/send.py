# 표준 라이브러리
from typing import Optional, List
from datetime import datetime, date

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.send import Send
from app.schemas.send import SendUpdate


def read_send_by_id(send_id: int, db: Session) -> Send:
    """발송 ID로 발송 조회"""
    send = db.query(Send).filter(Send.send_id == send_id).first()
    if not send:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="발송 정보를 찾을 수 없습니다."
        )
    return send


def read_sends_by_order_id(order_id: int, db: Session) -> List[Send]:
    """주문 ID로 발송 목록 조회"""
    return db.query(Send).filter(
        Send.order_id == order_id
    ).order_by(Send.created_at.desc()).all()


def read_sends_by_date(send_date: date, db: Session) -> List[Send]:
    """발송일로 발송 목록 조회"""
    return db.query(Send).filter(
        Send.send_date == send_date,
        Send.cancelled_at.is_(None)
    ).order_by(Send.created_at.asc()).all()


def create_send(
    order_id: int,
    address_id: Optional[int],
    send_date: Optional[date],
    db: Session,
    courier_company: Optional[str] = None,
    tracking_no: Optional[str] = None,
    send_status: str = "PREPARING",
    send_memo: Optional[str] = None,
    address_name: str = "",
    phone: str = "",
    nation: str = "대한민국",
    postal_code: str = "",
    address: str = "",
    address_memo: Optional[str] = None
) -> Send:
    """발송 생성"""
    try:
        send = Send(
            order_id=order_id,
            address_id=address_id,
            send_date=send_date,
            courier_company=courier_company,
            tracking_no=tracking_no,
            send_status=send_status,
            send_memo=send_memo,
            address_name=address_name,
            phone=phone,
            nation=nation,
            postal_code=postal_code,
            address=address,
            address_memo=address_memo
        )
        db.add(send)
        db.flush()
        return send
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"발송 생성 중 오류가 발생했습니다: {str(e)}"
        )


def update_send(send: Send, send_in: SendUpdate, db: Session) -> Send:
    """발송 수정"""
    update_data = send_in.model_dump(exclude_unset=True)
    
    # address는 별도 처리 (service에서 처리)
    if "address" in update_data:
        del update_data["address"]
    
    for field, value in update_data.items():
        setattr(send, field, value)
    
    try:
        db.commit()
        db.refresh(send)
        return send
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"발송 수정 중 오류가 발생했습니다: {str(e)}"
        )


def update_send_status(send: Send, status: str, db: Session) -> Send:
    """발송 상태 변경"""
    send.send_status = status
    if status == "CANCELLED":
        send.cancelled_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(send)
        return send
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"발송 상태 변경 중 오류가 발생했습니다: {str(e)}"
        )


def update_tracking(send: Send, courier: str, tracking_no: str, db: Session) -> Send:
    """운송장 정보 업데이트"""
    send.courier_company = courier
    send.tracking_no = tracking_no
    send.send_status = "SHIPPED"
    if not send.send_date:
        send.send_date = date.today()
    
    try:
        db.commit()
        db.refresh(send)
        return send
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"운송장 정보 업데이트 중 오류가 발생했습니다: {str(e)}"
        )


def cancel_send(send: Send, db: Session) -> Send:
    """발송 취소"""
    from app.crud import send_item as send_item_crud
    
    send.send_status = "CANCELLED"
    send.cancelled_at = datetime.now()
    
    # 발송 품목도 취소
    items = send_item_crud.read_send_items_by_send_id(
        send_id=send.send_id,
        db=db,
        include_cancelled=False
    )
    for item in items:
        item.cancelled_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(send)
        return send
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"발송 취소 중 오류가 발생했습니다: {str(e)}"
        )
