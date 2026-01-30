from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.dispatch import (
    DispatchTarget, DispatchTargetsResponse, DispatchGenerateRequest,
    DispatchGenerateResponse, DispatchSummaryResponse, DispatchCreatedItem,
    DispatchErrorItem, SubscriptionStats, SingleTarget, SingleTargetsResponse
)
from app.schemas.common import ResponseModel
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.services import order_item_service, product_service, activity_log_service

router = APIRouter(prefix="/dispatch", tags=["발송대상"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("/issue/{issue}/targets", response_model=ResponseModel[DispatchTargetsResponse])
def get_dispatch_targets(
    issue: str,
    product_code: Optional[str] = None,
    base_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """호수별 발송 대상 조회 (YEARLY/MONTHLY)
    
    - issue: 발송 호수 (예: 202602)
    - product_code: 상품 코드 필터 - 정확히 일치 (옵션)
    - base_code: 대표 코드 필터 - 해당 코드로 시작하는 상품 (옵션, 예: M1001)
    
    응답의 send_product_code는 실제 발송에 사용할 상품 코드입니다.
    - YEARLY: M1001+202601 → M1001-202602 (해당 issue의 MONTHLY로 변환)
    - MONTHLY: 변환 없음
    """
    targets = order_item_service.find_subscription_targets(
        db, issue, product_code=product_code, base_code=base_code
    )
    
    return ResponseModel(data=DispatchTargetsResponse(
        issue=issue,
        product_code=product_code,
        base_code=base_code,
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
    """호수별 발송 일괄 생성 (YEARLY/MONTHLY)
    
    - product_code: 상품 코드 필터 (옵션)
    - base_code: 대표 코드 필터 (옵션, 예: M1001)
    - send_date: 발송일 (옵션)
    
    YEARLY 상품은 해당 issue의 MONTHLY 상품으로 발송품목이 생성됩니다.
    """
    targets = order_item_service.find_subscription_targets(
        db, issue, product_code=req.product_code, base_code=req.base_code
    )
    
    if not targets:
        raise HTTPException(status_code=400, detail="발송 대상이 없습니다.")
    
    created = []
    errors = []
    
    for target in targets:
        try:
            # 발송용 상품 코드로 상품 조회
            send_product_code = target["send_product_code"]
            send_product = product_service.get_product_by_code(db, send_product_code)
            
            if send_product is None:
                raise ValueError(f"발송 상품을 찾을 수 없습니다: {send_product_code}")
            
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
            
            # 주문품목 발송 기록 업데이트
            order_item = order_item_service.get_order_item_by_id(db, target["order_item_id"])
            if order_item:
                order_item.last_send_issue = issue
                order_item.sended_at = datetime.now()
            
            created.append(DispatchCreatedItem(
                send_id=send.send_id,
                order_item_id=target["order_item_id"],
                customer_name=target["customer_name"],
                send_product_code=send_product_code
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
        admin=current_admin,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.DISPATCH,
        target_name=f"{issue}호 일괄발송",
        details={
            "reason": "호수별 발송 일괄 생성 성공",
            "issue": issue,
            "product_code": req.product_code,
            "base_code": req.base_code,
            "total_targets": len(targets),
            "created_count": len(created),
            "error_count": len(errors),
            "send_date": str(req.send_date) if req.send_date else None
        },
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
    product_code: Optional[str] = None,
    base_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """호수별 발송 현황 요약 (YEARLY/MONTHLY)
    
    - product_code: 상품 코드 필터 (옵션)
    - base_code: 대표 코드 필터 (옵션)
    """
    stats = order_item_service.get_subscription_stats(
        db, issue, product_code=product_code, base_code=base_code
    )
    targets = order_item_service.find_subscription_targets(
        db, issue, product_code=product_code, base_code=base_code
    )
    
    return ResponseModel(data=DispatchSummaryResponse(
        issue=issue,
        product_code=product_code,
        base_code=base_code,
        statistics=SubscriptionStats(**stats),
        pending_count=len(targets)
    ))


# ========== SINGLE 상품 발송 API ==========

@router.get("/single/{product_code}/targets", response_model=ResponseModel[SingleTargetsResponse])
def get_single_targets(
    product_code: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """SINGLE 상품 발송 대상 조회
    
    - product_code: 단행본 상품 코드 (예: A5500)
    
    아직 발송되지 않은 SINGLE 상품 주문품목을 조회합니다.
    """
    # 상품 확인
    product = product_service.get_product_by_code(db, product_code)
    if product is None:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    
    if product.product_kind != "SINGLE":
        raise HTTPException(status_code=400, detail="SINGLE 상품만 조회할 수 있습니다.")
    
    targets = order_item_service.find_single_targets(db, product_code)
    
    return ResponseModel(data=SingleTargetsResponse(
        product_code=product_code,
        count=len(targets),
        targets=[SingleTarget(**t) for t in targets]
    ))


@router.post("/single/{product_code}/generate", response_model=ResponseModel[DispatchGenerateResponse])
def generate_single_dispatch(
    product_code: str,
    req: DispatchGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """SINGLE 상품 발송 일괄 생성
    
    - product_code: 단행본 상품 코드 (예: A5500)
    - send_date: 발송일 (옵션)
    """
    # 상품 확인
    product = product_service.get_product_by_code(db, product_code)
    if product is None:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    
    if product.product_kind != "SINGLE":
        raise HTTPException(status_code=400, detail="SINGLE 상품만 발송할 수 있습니다.")
    
    targets = order_item_service.find_single_targets(db, product_code)
    
    if not targets:
        raise HTTPException(status_code=400, detail="발송 대상이 없습니다.")
    
    created = []
    errors = []
    
    for target in targets:
        try:
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
                product_code=product.product_code,
                send_num=target["order_num"],
                purchase=product.purchase or 0,
                product_name=product.product_name,
                unit_weight=product.unit_weight or 0,
                unit_width=product.unit_width or 0,
                unit_length=product.unit_length or 0,
                unit_height=product.unit_height or 0
            )
            db.add(send_item)
            
            # 주문품목 발송 기록 업데이트 (SINGLE은 sended_at만 설정)
            order_item = order_item_service.get_order_item_by_id(db, target["order_item_id"])
            if order_item:
                order_item.sended_at = datetime.now()
            
            created.append(DispatchCreatedItem(
                send_id=send.send_id,
                order_item_id=target["order_item_id"],
                customer_name=target["customer_name"],
                send_product_code=product_code
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
        admin=current_admin,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.DISPATCH,
        target_name=f"단행본 발송: {product_code}",
        details={
            "reason": "단행본 발송 일괄 생성 성공",
            "product_code": product_code,
            "total_targets": len(targets),
            "created_count": len(created),
            "error_count": len(errors),
            "send_date": str(req.send_date) if req.send_date else None
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="발송이 생성되었습니다.",
        data=DispatchGenerateResponse(
            issue=f"SINGLE:{product_code}",
            total_targets=len(targets),
            created_count=len(created),
            error_count=len(errors),
            created=created,
            errors=errors
        )
    )
