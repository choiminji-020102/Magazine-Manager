import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

# MySQL 서버(Cafe24)가 KST 기준이므로 Python에서도 KST로 통일
KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """현재 한국 시간(KST) 반환 — DB의 func.now()와 동일한 시간대"""
    return datetime.now(KST)


def parse_subscribe_start_issue(product_code: str) -> Optional[str]:
    """product_code에서 구독 시작 호(YYYYMM) 추출

    규칙:
    - W0+202601 (YEARLY 정기구독)  → "202601"
    - W0~202601 (YEARLY 연장 구독) → "202601"
    - W0-202601 (MONTHLY 단품)     → "202601"
    - 구분자 없음                        → None

    연장 구독(`~`)은 정기구독(`+`)과 동일하게 YEARLY로 취급되며,
    시작 호 파싱 로직도 동일. 구분자 자체로만 통계 목적의 구별을 가능하게 함.
    """
    for sep in ("+", "~", "-"):
        if sep in product_code:
            return product_code.split(sep, 1)[1] or None
    return None


def format_phone_number(phone: str, country_code: str = "KR") -> Tuple[str, str]:
    """
    전화번호 포맷팅 및 뒤4자리 추출
    
    Returns:
        Tuple[formatted_phone, phone_num4]
    """
    if not phone:
        return "", ""
    
    # 숫자만 추출
    digits = re.sub(r'[^\d+]', '', phone)
    
    # 이미 + 로 시작하면 국제번호로 처리
    if digits.startswith('+'):
        # +82로 시작하면 한국 번호
        if digits.startswith('+82'):
            # +821012345678 -> 010-1234-5678
            local = '0' + digits[3:]
            formatted = format_korean_phone(local)
            phone_num4 = local[-4:] if len(local) >= 4 else local
            return formatted, phone_num4
        else:
            # 기타 국제번호는 그대로 유지 (하이픈 추가)
            phone_num4 = digits[-4:] if len(digits) >= 4 else digits
            return format_international_phone(digits), phone_num4
    
    # 82로 시작하면 +82 추가 후 한국번호 처리
    if digits.startswith('82') and len(digits) > 10:
        local = '0' + digits[2:]
        formatted = format_korean_phone(local)
        phone_num4 = local[-4:] if len(local) >= 4 else local
        return formatted, phone_num4
    
    # 한국 번호 (country_code가 KR이거나 0으로 시작)
    if country_code == "KR" or digits.startswith('0'):
        formatted = format_korean_phone(digits)
        phone_num4 = digits[-4:] if len(digits) >= 4 else digits
        return formatted, phone_num4
    
    # 기타: 국제번호로 처리
    formatted = format_international_phone('+' + digits)
    phone_num4 = digits[-4:] if len(digits) >= 4 else digits
    return formatted, phone_num4


def format_korean_phone(digits: str) -> str:
    """한국 전화번호 포맷팅 (010-1234-5678)"""
    digits = re.sub(r'[^\d]', '', digits)
    
    # 010, 011, 016, 017, 018, 019 (휴대폰)
    if len(digits) == 11 and digits.startswith('01'):
        return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    
    # 02 (서울)
    if digits.startswith('02'):
        if len(digits) == 9:
            return f"02-{digits[2:5]}-{digits[5:]}"
        elif len(digits) == 10:
            return f"02-{digits[2:6]}-{digits[6:]}"
    
    # 지역번호 (031, 032, ... 070 등)
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11:
        return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    
    # 포맷 불가시 원본 반환
    return digits


def format_international_phone(phone: str) -> str:
    """국제 전화번호 포맷팅 (+1-212-555-1234)"""
    digits = re.sub(r'[^\d+]', '', phone)
    
    if not digits.startswith('+'):
        digits = '+' + digits
    
    # 간단한 포맷팅: 국가코드 뒤에 하이픈 추가
    # +1 (미국/캐나다)
    if digits.startswith('+1') and len(digits) == 12:
        return f"+1-{digits[2:5]}-{digits[5:8]}-{digits[8:]}"
    
    # +81 (일본)
    if digits.startswith('+81') and len(digits) >= 12:
        return f"+81-{digits[3:5]}-{digits[5:9]}-{digits[9:]}"
    
    # +86 (중국)
    if digits.startswith('+86') and len(digits) >= 14:
        return f"+86-{digits[3:6]}-{digits[6:10]}-{digits[10:]}"
    
    # 기타: 국가코드(1-3자리) + 나머지
    if len(digits) > 4:
        # 국가코드 길이 추정 (1-3자리)
        for cc_len in [2, 3, 4]:  # +1, +82, +852 등
            if len(digits) > cc_len:
                cc = digits[:cc_len]
                rest = digits[cc_len:]
                # 나머지를 4자리씩 끊기
                parts = [rest[i:i+4] for i in range(0, len(rest), 4)]
                return f"{cc}-" + "-".join(parts)
    
    return digits


def extract_phone_num4(phone: str) -> str:
    """전화번호에서 뒤 4자리 추출"""
    digits = re.sub(r'[^\d]', '', phone)
    return digits[-4:] if len(digits) >= 4 else digits


def count_issue_diff(start_issue: str, end_issue: str) -> int:
    """두 호(YYYYMM) 간의 개월 수 차이 (end - start)"""
    y1, m1 = int(start_issue[:4]), int(start_issue[4:6])
    y2, m2 = int(end_issue[:4]), int(end_issue[4:6])
    return (y2 - y1) * 12 + (m2 - m1)


def calculate_subscribe_end_issue(start_issue: str, period: int) -> str:
    """
    구독 시작호와 기간으로 종료호 계산
    예: start_issue="202602", period=12 → "202701"
    """
    if not start_issue or len(start_issue) != 6:
        return start_issue
    
    year = int(start_issue[:4])
    month = int(start_issue[4:6])
    
    # period - 1 개월 후 (시작호 포함이므로)
    total_months = year * 12 + month + (period - 1)
    end_year = (total_months - 1) // 12
    end_month = (total_months - 1) % 12 + 1
    
    return f"{end_year:04d}{end_month:02d}"
