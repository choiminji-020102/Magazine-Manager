from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.dispatch import (
    DispatchTarget, DispatchTargetsResponse, DispatchGenerateRequest,
    DispatchGenerateResponse, DispatchSummaryResponse, DispatchCreatedItem,
    DispatchErrorItem, SubscriptionStats
)
from app.schemas.common import ResponseModel
from app.services import order_item_service, product_service, activity_log_service

router = APIRouter(prefix="/dispatch", tags=["구독 발송"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("/issue/{issue}/targets", response_model=ResponseModel[DispatchTargetsResponse])
def get_dispatch_targets(
    issue: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """호수별 발송 대상 조회"""
    targets = order_item_service.find_subscription_targets(db, issue)
    
    return ResponseModel(data=DispatchTargetsResponse(
        issue=issue,
        count=len(targets),
        targets=[DispatchTarget(**t) for t in targets]
    ))


@router.post("/issue/{issue}/generate", response_model=ResponseModel[DispatchGenerateResponse])
def generate_dispatch(
    issue: str,
    req: DispatchGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """호수별 발송 일괄 생성"""
    targets = order_item_service.find_subscription_targets(db, issue)
    
    if not targets:
        raise HTTPException(status_code=400, detail="발송 대상이 없습니다.")
    
    product = None
    if req.product_code:
        product = product_service.get_product_by_code(db, req.product_code)
        if product is None:
            raise HTTPException(status_code=400, detail="상품을 찾을 수 없습니다.")
    
    created = []
    errors = []
    
    for target in targets:
        try:
            send_product = product
            if send_product is None:
                send_product = product_service.get_product_by_code(db, target["product_code"])
                if send_product is None:
                    raise ValueError(f"상품을 찾을 수 없습니다: {target['product_code']}")
            
            send = Send(
                order_id=target["order_id"],
                address_id=target["address_id"],
                send_date=req.send_date,
                send_status="PREPARING",
                address_name=target["address_name"] or "",
                phone=target["phone"] or "",
                nation="대한민국",
                postal_code=target["postal_code"] or "",
                address=target["address"] or '',
                address_memo=target["address_memo"]
            )
            db.add(send)
            db.flush()
            
            send_item = SendItem(
                send_id=send.send_id,
                order_item_id=target["order_item_id"],
                product_code=send_product.product_code,
                send_num=1,
                purchase=send_product.purchase or 0,
                product_name=send_product.product_name,
                unit_weight=send_product.unit_weight or 0,
                unit_width=send_product.unit_width or 0,
                unit_length=send_product.unit_length or 0,
                unit_height=send_product.unit_height or 0
            )
            db.add(send_item)
            
            order_item = order_item_service.get_order_item_by_id(db, target["order_item_id"])
            if order_item:
                order_item.last_send_issue = issue
                order_item.sended_at = datetime.now()
            
            created.append(DispatchCreatedItem(
                send_id=send.send_id,
                order_item_id=target["order_item_id"],
                customer_name=target["customer_name"]
            ))
            
        except Exception as e:
            errors.append(DispatchErrorItem(
                order_item_id=target["order_item_id"],
                customer_name=target["customer_name"],
                error=str(e)
            ))
    
    db.commit()
    
    activity_log_service.create_log(
        db=db,
        action="GENERATE_DISPATCH",
        target_type="DISPATCH",
        target_name=f"{issue}호 일괄발송",
        details={
            "issue": issue,
            "total_targets": len(targets),
            "created_count": len(created),
            "error_count": len(errors),
            "send_date": str(req.send_date) if req.send_date else None
        },
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="발송이 생성되었습니다.",
        data=DispatchGenerateResponse(
            issue=issue,
            total_targets=len(targets),
            created_count=len(created),
            error_count=len(errors),
            created=created,
            errors=errors
        )
    )


@router.get("/issue/{issue}/summary", response_model=ResponseModel[DispatchSummaryResponse])
def get_dispatch_summary(
    issue: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """호수별 발송 현황 요약"""
    stats = order_item_service.get_subscription_stats(db, issue)
    targets = order_item_service.find_subscription_targets(db, issue)
    
    return ResponseModel(data=DispatchSummaryResponse(
        issue=issue,
        statistics=SubscriptionStats(**stats),
        pending_count=len(targets)
    ))