# 표준 라이브러리
from datetime import datetime

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.password import verify_password
from app.core.token import (
    decode_refresh_token,
    encode_access_token,
    encode_refresh_token,
)
from app.crud import crud_admin, crud_refresh_token
from app.schemas import schema_auth

def login(login_in: schema_auth.LoginRequest, db: Session) -> schema_auth.TokenPairResponse:
    """
    로그인 처리 함수
    
    동작 방식:
    1. 이메일로 관리자 계정 조회
       - 존재하지 않는 이메일인 경우 401 Unauthorized 반환 (보안상 이메일/비밀번호 오류 구분하지 않음)
    
    2. 계정 상태 검증
       - 삭제된 계정(deleted_at이 None이 아님)인 경우 403 Forbidden 반환
       - 비활성 계정(is_active가 False)인 경우 403 Forbidden 반환
       - 보안상 구체적인 이유를 노출하지 않고 동일한 에러 메시지 반환
    
    3. 비밀번호 검증
       - bcrypt를 사용하여 해시된 비밀번호와 평문 비밀번호 비교
       - 일치하지 않으면 401 Unauthorized 반환
    
    4. 기존 리프레시 토큰 폐기
       - 해당 관리자의 모든 활성 리프레시 토큰을 폐기 처리
       - 동시 로그인 방지 및 보안 강화 (토큰 탈취 시 이전 세션 무효화)
    
    5. 마지막 로그인 시간 업데이트
       - admin.last_login_at을 현재 시간으로 설정
    
    6. JWT 토큰 생성
       - Access Token: 짧은 만료 시간 (설정값에 따라, 보통 15분~1시간)
       - Refresh Token: 긴 만료 시간 (설정값에 따라, 보통 7일~30일)
       - 두 토큰 모두 관리자 ID를 sub(subject)로 포함
    
    7. 리프레시 토큰 DB 저장
       - Refresh Token을 데이터베이스에 저장하여 추후 검증 및 폐기 가능하도록 함
       - 트랜잭션 일관성을 위해 모든 변경사항(토큰 폐기, 로그인 시간 업데이트, 새 토큰 저장)을 한 번에 커밋
       - 저장 실패 시 롤백 처리
    
    8. 토큰 쌍 반환
       - Access Token과 Refresh Token을 함께 반환
       - 클라이언트는 Access Token을 API 요청 시 사용하고, 만료 시 Refresh Token으로 갱신
    
    보안 고려사항:
    - 이메일 존재 여부와 비밀번호 오류를 구분하지 않아 계정 존재 여부를 추측할 수 없도록 함
    - 삭제/비활성 계정도 동일한 에러 메시지로 처리하여 상태 정보 노출 방지
    - 로그인 시 기존 토큰을 모두 폐기하여 토큰 탈취 시 피해 최소화
    - 트랜잭션을 사용하여 부분 실패 시 데이터 일관성 보장
    """
    # 이메일로 관리자 조회 (존재하지 않으면 404 예외 발생)
    try:
        admin = crud_admin.read_admin_by_email(admin_email=login_in.email, db=db)
    except HTTPException:
        # 보안상 이메일/비밀번호 오류를 구분하지 않음
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )

    # 삭제된 계정 차단
    if admin.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )

    # 비활성 계정 차단
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )

    if not verify_password(login_in.plain_password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )
    
    # 기존 리프레시 토큰 모두 폐기 (동시 로그인 방지 및 보안 강화)
    crud_refresh_token.revoke_all_tokens_by_admin_id(admin_id=admin.id, db=db)
    
    # 마지막 로그인 시간 업데이트
    admin.last_login_at = datetime.now()
    
    # 토큰 생성
    access_token = encode_access_token(admin_id=admin.id)
    refresh_token = encode_refresh_token(admin_id=admin.id)

    refresh_payload = decode_refresh_token(refresh_token)
    # JWT exp는 epoch timestamp이므로 datetime으로 변환
    expires_at = datetime.fromtimestamp(refresh_payload.exp)
    
    # 리프레시 토큰 저장 (트랜잭션 일관성을 위해 함께 처리)
    try:
        new_refresh_token = crud_refresh_token.create_refresh_token(
            admin_id=admin.id,
            token=refresh_token,
            expires_at=expires_at,
            db=db
        )
        # 모든 변경사항을 한 번에 커밋
        db.commit()
        db.refresh(admin)
        db.refresh(new_refresh_token)
    except HTTPException:
        # HTTPException은 그대로 재발생
        db.rollback()
        raise
    except Exception as e:
        # 토큰 저장 실패 시 롤백하고 예외 재발생
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="로그인 처리 중 오류가 발생했습니다."
        )

    return schema_auth.TokenPairResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


def refresh_token(refresh_in: schema_auth.RefreshRequest, db: Session) -> schema_auth.TokenPairResponse:
    """
    Refresh Token을 사용하여 새로운 Access Token과 Refresh Token을 발급하는 함수
    
    동작 방식:
    1. JWT 서명 및 만료 시간 검증
       - Refresh Token의 서명을 검증하여 변조 여부 확인
       - JWT의 exp(만료 시간) 필드를 확인하여 만료 여부 검증
       - 토큰 타입이 "refresh"인지 확인
       - 유효하지 않은 토큰인 경우 401 Unauthorized 반환
    
    2. 토큰 페이로드 검증
       - sub(관리자 ID)가 존재하고 양수인지 확인
       - 유효하지 않은 페이로드인 경우 401 Unauthorized 반환
    
    3. 데이터베이스에서 토큰 존재 여부 확인
       - 전달받은 Refresh Token이 DB에 저장되어 있는지 확인
       - 존재하지 않으면 404 Not Found 반환 (이미 폐기되었거나 유효하지 않은 토큰)
    
    4. 토큰 상태 검증
       - is_revoked가 True인 경우: 이미 폐기된 토큰이므로 401 Unauthorized 반환
       - expires_at이 현재 시간보다 이전인 경우: DB 레벨에서 만료된 토큰이므로 401 Unauthorized 반환
       - (JWT 레벨 검증과 DB 레벨 검증을 모두 수행하여 이중 보안)
    
    5. 기존 Refresh Token 폐기 (Token Rotation)
       - 검증된 기존 Refresh Token을 폐기 처리
       - is_revoked를 True로 설정하고 revoked_at에 현재 시간 기록
       - 한 번 사용된 토큰은 재사용할 수 없도록 하여 토큰 탈취 시 피해 최소화
    
    6. 새로운 토큰 쌍 생성
       - 새로운 Access Token 생성 (짧은 만료 시간)
       - 새로운 Refresh Token 생성 (긴 만료 시간)
       - 두 토큰 모두 동일한 관리자 ID를 sub로 포함
    
    7. 새로운 Refresh Token 저장
       - 새로 생성된 Refresh Token을 데이터베이스에 저장
       - expires_at은 JWT의 exp를 datetime으로 변환하여 저장
    
    8. 트랜잭션 커밋
       - 기존 토큰 폐기와 새 토큰 저장을 하나의 트랜잭션으로 처리
       - Race Condition 방지: 동시에 같은 토큰으로 갱신 요청이 와도 안전하게 처리
       - 실패 시 롤백하여 데이터 일관성 보장
    
    9. 새로운 토큰 쌍 반환
       - 새로운 Access Token과 Refresh Token을 함께 반환
       - 클라이언트는 기존 토큰을 새 토큰으로 교체하여 사용
    
    보안 고려사항:
    - Token Rotation: Refresh Token을 한 번 사용하면 폐기하고 새 토큰 발급
      → 토큰이 탈취되어도 한 번만 사용 가능하여 피해 최소화
    - 트랜잭션 사용: Race Condition 방지 및 데이터 일관성 보장
    - 이중 검증: JWT 레벨과 DB 레벨에서 모두 검증하여 보안 강화
    - 만료된 토큰은 즉시 폐기하여 재사용 불가능하도록 함
    """
    # - 1) JWT 서명/만료 검증
    payload = decode_refresh_token(refresh_in.refresh_token)
    
    # 토큰 페이로드 검증
    if not payload.sub or payload.sub <= 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 Refresh Token입니다."
        )
    
    # 트랜잭션 내에서 처리하여 Race Condition 방지
    try:
        # - 2) DB에 해당 refresh token이 존재하는지 확인
        existing_token = crud_refresh_token.read_refresh_token_by_token(
            token=refresh_in.refresh_token,
            db=db
        )
        
        # - 3) 이미 폐기된 토큰인지, 만료된 토큰인지 확인
        if existing_token.is_revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh Token이 폐기되었습니다."
            )
        if existing_token.expires_at < datetime.now():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh Token이 만료되었습니다."
            )
        
        # - 4) 유효하면 기존 토큰 폐기 및 새 토큰 발급 (트랜잭션 내에서)
        crud_refresh_token.revoke_refresh_token(token=refresh_in.refresh_token, db=db)
        
        access_token = encode_access_token(admin_id=payload.sub)
        new_refresh_token = encode_refresh_token(admin_id=payload.sub)
        
        new_refresh_payload = decode_refresh_token(new_refresh_token)
        expires_at = datetime.fromtimestamp(new_refresh_payload.exp)
        
        # 새 토큰 저장
        new_refresh_token_obj = crud_refresh_token.create_refresh_token(
            admin_id=payload.sub,
            token=new_refresh_token,
            expires_at=expires_at,
            db=db
        )
        
        db.commit()
        db.refresh(new_refresh_token_obj)
        
        return schema_auth.TokenPairResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="토큰 갱신 중 오류가 발생했습니다."
        )

def logout(logout_in: schema_auth.LogoutRequest, db: Session) -> None:
    """
    로그아웃 처리 함수
    
    동작 방식:
    1. Refresh Token 폐기
       - 클라이언트가 전달한 Refresh Token을 데이터베이스에서 찾아 폐기 처리
       - is_revoked를 True로 설정하고 revoked_at에 현재 시간 기록
       - 폐기된 토큰은 이후 refresh 요청 시 사용할 수 없음
    
    2. Access Token 처리
       - Access Token은 짧은 만료 시간을 가지고 있어 자연스럽게 무효화됨
       - 별도의 블랙리스트 관리 없이 만료 시간에 의존
       - 클라이언트는 로그아웃 시 Access Token을 삭제해야 함
    
    3. 에러 처리
       - 존재하지 않는 토큰으로 로그아웃을 시도해도 성공으로 처리
       - 구체적인 에러 메시지를 반환하지 않아 보안상 정보 노출 방지
       - 이미 폐기된 토큰으로 로그아웃을 시도해도 성공으로 처리
       - 이는 공격자가 유효한 토큰인지 확인하는 것을 방지하기 위함
    
    보안 고려사항:
    - 존재하지 않는 토큰이나 이미 폐기된 토큰으로 로그아웃을 시도해도 항상 성공으로 처리
      → 공격자가 토큰의 유효성을 추측할 수 없도록 함 (Timing Attack 방지)
    - Refresh Token만 폐기하고 Access Token은 만료 시간에 의존
      → Access Token은 짧은 수명을 가지므로 별도 관리 불필요
    - 로그아웃은 멱등성(idempotent)을 가짐: 여러 번 호출해도 안전
    """
    try:
        crud_refresh_token.revoke_refresh_token(token=logout_in.refresh_token, db=db)
    except HTTPException:
        # 존재하지 않는 토큰으로 로그아웃 시도해도 성공 처리 (보안상 정보 노출 방지)
        pass