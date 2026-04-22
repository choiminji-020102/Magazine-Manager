"""기출유/우체국 발송 엑셀 관련 엔드포인트

엔드포인트 (6개):
- GET  /dispatches/excel/monthly/candidates
- GET  /dispatches/excel/yearly-gichulyu/candidates
- GET  /dispatches/excel/yearly-postoffice/candidates
- POST /dispatches/excel/monthly               (엑셀 다운로드 + SHIPPING 전환)
- POST /dispatches/excel/yearly-gichulyu       (엑셀 다운로드 + SHIPPING 전환)
- POST /dispatches/excel/yearly-postoffice     (엑셀 다운로드 + SHIPPING 전환)

상세 사양: `GICHULYU_EXCEL_SPEC.md`
"""

# 표준 라이브러리
from urllib.parse import quote

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.deps import require_roles
from app.db.session import get_db
from app.models.admin import Admin
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import ResponseModel
from app.schemas.dispatch_excel import (
    MonthlyCandidatesQuery,
    MonthlyExcelCandidatesResponse,
    MonthlyExcelDownloadRequest,
    YearlyCandidatesQuery,
    YearlyExcelCandidatesResponse,
    YearlyExcelDownloadRequest,
)
from app.services import activity_log_service, dispatch_excel_service

router = APIRouter(tags=["발송 엑셀"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _build_content_disposition(filename: str) -> str:
    """한글 파일명 대응 Content-Disposition 헤더 값 (RFC 5987)"""
    encoded = quote(filename)
    return f"attachment; filename=\"download.xlsx\"; filename*=UTF-8''{encoded}"


# ── 후보 조회 ─────────────────────────────────────────────────────────────────

@router.get(
    "/dispatches/excel/monthly/candidates",
    response_model=ResponseModel[MonthlyExcelCandidatesResponse],
)
def get_monthly_excel_candidates(
    query: MonthlyCandidatesQuery = Depends(MonthlyCandidatesQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """단품 엑셀 후보 조회 (PREPARING + 국내 + 해당 호)"""
    candidates = dispatch_excel_service.get_monthly_candidates(
        db=db,
        issue=query.issue,
        postal_code=query.postal_code,
    )
    return ResponseModel(
        message="단품 엑셀 후보를 조회했습니다.",
        data=MonthlyExcelCandidatesResponse(
            issue=query.issue,
            total=len(candidates),
            candidates=candidates,
        ),
    )


@router.get(
    "/dispatches/excel/yearly-gichulyu/candidates",
    response_model=ResponseModel[YearlyExcelCandidatesResponse],
)
def get_yearly_gichulyu_excel_candidates(
    query: YearlyCandidatesQuery = Depends(YearlyCandidatesQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """정기구독 엑셀 A 후보 조회 (말씀함께 W0/WB)"""
    candidates = dispatch_excel_service.get_yearly_gichulyu_candidates(
        db=db,
        issue=query.issue,
        postal_code=query.postal_code,
        product_codes=query.product_codes,
    )
    return ResponseModel(
        message="정기구독 A(말씀함께) 엑셀 후보를 조회했습니다.",
        data=YearlyExcelCandidatesResponse(
            issue=query.issue,
            total=len(candidates),
            candidates=candidates,
        ),
    )


@router.get(
    "/dispatches/excel/yearly-postoffice/candidates",
    response_model=ResponseModel[YearlyExcelCandidatesResponse],
)
def get_yearly_postoffice_excel_candidates(
    query: YearlyCandidatesQuery = Depends(YearlyCandidatesQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """정기구독 엑셀 B 후보 조회 (청소년이하 HN/CL/CH/JN)"""
    candidates = dispatch_excel_service.get_yearly_postoffice_candidates(
        db=db,
        issue=query.issue,
        postal_code=query.postal_code,
        product_codes=query.product_codes,
    )
    return ResponseModel(
        message="정기구독 B(청소년이하) 엑셀 후보를 조회했습니다.",
        data=YearlyExcelCandidatesResponse(
            issue=query.issue,
            total=len(candidates),
            candidates=candidates,
        ),
    )


# ── 엑셀 다운로드 (+ SHIPPING 전환) ──────────────────────────────────────────

@router.post(
    "/dispatches/excel/monthly",
    response_class=StreamingResponse,
)
def download_monthly_excel(
    req: MonthlyExcelDownloadRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """단품 엑셀 다운로드 + 포함된 Send → SHIPPING (CJ대한통운)"""
    if not req.send_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="선택된 발송이 없습니다.",
        )

    output, included_ids, skipped = dispatch_excel_service.build_monthly_excel(
        db=db,
        send_ids=req.send_ids,
        send_date_yyyymmdd=req.send_date,
    )

    if not included_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀에 포함할 수 있는 발송이 없습니다. (모두 조건 불일치)",
        )

    # 상태 전환
    updated_count = dispatch_excel_service.mark_sends_as_shipping(
        db=db,
        send_ids=included_ids,
        courier_company=dispatch_excel_service.COURIER_MONTHLY,
    )

    # 활동 로그
    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"기출유 단품 엑셀 다운로드 / {req.send_date} / {updated_count}건",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "excel_type": "GICHULYU_MONTHLY",
            "send_date": req.send_date,
            "courier_company": dispatch_excel_service.COURIER_MONTHLY,
            "requested_count": len(req.send_ids),
            "included_count": len(included_ids),
            "skipped_count": len(skipped),
            "shipping_updated": updated_count,
            "skipped": [s.model_dump() for s in skipped],
        },
    )

    filename = dispatch_excel_service.monthly_filename(req.send_date)
    return StreamingResponse(
        output,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": _build_content_disposition(filename),
            "X-Included-Count": str(len(included_ids)),
            "X-Skipped-Count": str(len(skipped)),
            "X-Courier-Company": dispatch_excel_service.COURIER_MONTHLY,
        },
    )


@router.post(
    "/dispatches/excel/yearly-gichulyu",
    response_class=StreamingResponse,
)
def download_yearly_gichulyu_excel(
    req: YearlyExcelDownloadRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """정기구독 엑셀 A 다운로드 + 포함된 Send → SHIPPING (기출유우편)"""
    if not req.send_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="선택된 발송이 없습니다.",
        )

    output, included_ids, skipped = dispatch_excel_service.build_yearly_gichulyu_excel(
        db=db,
        send_ids=req.send_ids,
    )

    if not included_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀에 포함할 수 있는 발송이 없습니다. (모두 조건 불일치)",
        )

    updated_count = dispatch_excel_service.mark_sends_as_shipping(
        db=db,
        send_ids=included_ids,
        courier_company=dispatch_excel_service.COURIER_YEARLY_GICHULYU,
    )

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"기출유 정기구독 엑셀 다운로드 / {req.issue} / {updated_count}건",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "excel_type": "GICHULYU_YEARLY",
            "issue": req.issue,
            "courier_company": dispatch_excel_service.COURIER_YEARLY_GICHULYU,
            "requested_count": len(req.send_ids),
            "included_count": len(included_ids),
            "skipped_count": len(skipped),
            "shipping_updated": updated_count,
            "skipped": [s.model_dump() for s in skipped],
        },
    )

    filename = dispatch_excel_service.yearly_gichulyu_filename(req.issue)
    return StreamingResponse(
        output,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": _build_content_disposition(filename),
            "X-Included-Count": str(len(included_ids)),
            "X-Skipped-Count": str(len(skipped)),
            "X-Courier-Company": dispatch_excel_service.COURIER_YEARLY_GICHULYU,
        },
    )


@router.post(
    "/dispatches/excel/yearly-postoffice",
    response_class=StreamingResponse,
)
def download_yearly_postoffice_excel(
    req: YearlyExcelDownloadRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """정기구독 엑셀 B 다운로드 + 포함된 Send → SHIPPING (일반우편)"""
    if not req.send_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="선택된 발송이 없습니다.",
        )

    output, included_ids, skipped = dispatch_excel_service.build_yearly_postoffice_excel(
        db=db,
        send_ids=req.send_ids,
    )

    if not included_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀에 포함할 수 있는 발송이 없습니다. (모두 조건 불일치)",
        )

    updated_count = dispatch_excel_service.mark_sends_as_shipping(
        db=db,
        send_ids=included_ids,
        courier_company=dispatch_excel_service.COURIER_YEARLY_POSTOFFICE,
    )

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"우체국 정기구독 엑셀 다운로드 / {req.issue} / {updated_count}건",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "excel_type": "POSTOFFICE_YEARLY",
            "issue": req.issue,
            "courier_company": dispatch_excel_service.COURIER_YEARLY_POSTOFFICE,
            "requested_count": len(req.send_ids),
            "included_count": len(included_ids),
            "skipped_count": len(skipped),
            "shipping_updated": updated_count,
            "skipped": [s.model_dump() for s in skipped],
        },
    )

    filename = dispatch_excel_service.yearly_postoffice_filename(req.issue)
    return StreamingResponse(
        output,
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": _build_content_disposition(filename),
            "X-Included-Count": str(len(included_ids)),
            "X-Skipped-Count": str(len(skipped)),
            "X-Courier-Company": dispatch_excel_service.COURIER_YEARLY_POSTOFFICE,
        },
    )
