# 표준 라이브러리
import re

# 서드파티 라이브러리
from fastapi import HTTPException, status
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(plain_password: str) -> str:
    """비밀번호 해시 생성"""
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def validate_password_strength(plain_password: str) -> None:
    """비밀번호 강도 검증"""
    if len(plain_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호는 최소 8자 이상이어야 합니다."
        )
    
    if len(plain_password) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호는 50자를 초과할 수 없습니다."
        )
    
    # 최소 하나의 숫자, 영문자, 특수문자 포함
    if not re.search(r'[0-9]', plain_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호는 최소 하나의 숫자를 포함해야 합니다."
        )
    
    if not re.search(r'[a-zA-Z]', plain_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호는 최소 하나의 영문자를 포함해야 합니다."
        )
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', plain_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호는 최소 하나의 특수문자를 포함해야 합니다."
        )   