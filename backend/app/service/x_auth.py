# 표준 라이브러리
from datetime import datetime, timezone

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.password import verify_password
from app.core.token import (
    decode_access_token,
    decode_refresh_token,
    decode_token_safely,
    encode_access_token,
    encode_refresh_token,
    extract_admin_id_from_payloads,
    is_token_valid,
)
from app.crud import admin as admin_crud, refresh_token as refresh_token_crud
from app.models import admin as admin_model
from app.schemas import auth as auth_schema, admin as admin_schema

def login(login_in: auth_schema.LoginRequest, db: Session) -> auth_schema.TokenPairResponse:
    # 이메일로 관리자 조회 (존재하지 않으면 404 예외 발생)
    try:
        admin = admin_crud.read_admin_by_email(admin_email=login_in.email, db=db)
    except HTTPException as e:
        # 보안상 이메일/비밀번호 오류를 구분하지 않음
        if e.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
        raise e

    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    if not verify_password(login_in.plain_password, admin.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    

    # 기존 리프레시 토큰 모두 폐기 (동시 로그인 방지 및 보안 강화)
    refresh_token_crud.revoke_all_tokens_by_admin_id(admin_id=admin.id, db=db)
    
    
    # 토큰 생성
    access_token = encode_access_token(admin_id=admin.id)
    refresh_token = encode_refresh_token(admin_id=admin.id)

    refresh_payload = decode_refresh_token(refresh_token, verify_exp=True)
    
    # 리프레시 토큰 저장 
    refresh_token_crud.create_refresh_token(
        admin_id=admin.id,
        token=refresh_token,
        exp=refresh_payload.exp,    # int timestamp
        db=db
    )
    # 마지막 로그인 시간 업데이트
    admin.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(admin)

    return auth_schema.TokenPairResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


def refresh(refresh_in: auth_schema.RefreshRequest, db: Session) -> auth_schema.TokenPairResponse:
    access_token = refresh_in.access_token
    refresh_token = refresh_in.refresh_token

    # access payload
    access_payload = decode_token_safely(decode_access_token, access_token) # dict
    access_jwt_valid = is_token_valid(decode_access_token, access_token)
    access_valid = access_jwt_valid  # access 토큰은 DB 체크 불필요

    # refresh payload
    refresh_payload = decode_token_safely(decode_refresh_token, refresh_token) # dict
    refresh_jwt_valid = is_token_valid(decode_refresh_token, refresh_token) # True or False - jwt 토큰 자체의 유효성(만료 여부)
    refresh_db_valid = False # True or False - db에 저장된 리프레시 토큰의 revoked_at 확인(폐기 여부)
    
    # payload가 있으면 admin_id 추출하여 DB 상태 확인 (JWT 만료 여부와 관계없이)
    if refresh_payload:
        admin_id_from_refresh = int(refresh_payload["sub"]) if "sub" in refresh_payload else None
        if admin_id_from_refresh:
            refresh_db_valid = refresh_token_crud.exists_refresh_token(
                admin_id=admin_id_from_refresh,
                token=refresh_token,
                db=db
            )
    
    # refresh 토큰은 JWT 유효성과 DB 상태 둘 다 확인해야 함
    refresh_valid = refresh_jwt_valid and refresh_db_valid

    admin_id = extract_admin_id_from_payloads(access_payload=access_payload, refresh_payload=refresh_payload)
    if admin_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 정보가 유효하지 않습니다.",
        )

    # -------------------------
    # Case 1: 둘 다 만료
    # -------------------------
    if not access_valid and not refresh_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 모두 만료되었습니다. 다시 로그인해주세요.",
        )

    # -------------------------
    # Case 2: access 만료 + refresh 유효
    # -------------------------
    if not access_valid and refresh_valid:
        new_access_token = encode_access_token(admin_id)
        return auth_schema.TokenPairResponse(
            access_token=new_access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )

    # -------------------------
    # Case 3: access 유효 + refresh 만료
    # Refresh Rotation
    # -------------------------
    if access_valid and not refresh_valid:
        # JWT가 만료되었지만 DB에는 아직 폐기 안된 경우에만 revoke
        # (이미 DB에서 폐기된 경우는 revoke 불필요)
        if not refresh_jwt_valid and refresh_db_valid:
            try:
                refresh_token_crud.revoke_refresh_token(refresh_token, db)
            except HTTPException:
                # 이미 폐기되었거나 존재하지 않는 경우 무시
                pass
        new_refresh_token = encode_refresh_token(admin_id)
        new_refresh_payload = decode_refresh_token(new_refresh_token, verify_exp=True)
        refresh_token_obj = refresh_token_crud.create_refresh_token(
            admin_id, new_refresh_token, new_refresh_payload.exp, db
        )
        return auth_schema.TokenPairResponse(
            access_token=access_token,
            refresh_token=refresh_token_obj.token,
            token_type="bearer"
        )

    # -------------------------
    # Case 4: 둘 다 유효
    # -------------------------
    return auth_schema.TokenPairResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

def logout(logout_in: auth_schema.LogoutRequest, db: Session) -> None:
    # DB에서 Refresh Token 삭제
    refresh_token_crud.revoke_refresh_token(token=logout_in.refresh_token, db=db)

def init_first_admin(admin_in: admin_schema.AdminCreate, db: Session) -> admin_schema.AdminResponse:
    admin_count = db.query(admin_model.Admin).filter(admin_model.Admin.deleted_at.is_(None)).count()
    
    if admin_count > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이미 관리자가 존재합니다. 최초 관리자 생성은 시스템에 관리자가 없을 때만 가능합니다.")
    
    # 최초 관리자는 항상 SUPER_ADMIN으로 설정
    admin_in.role = admin_model.AdminRole.SUPER_ADMIN
    admin_in.is_active = True
    return admin_crud.create_admin(admin_in=admin_in, db=db)