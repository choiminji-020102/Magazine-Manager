# 서드파티 라이브러리
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 로컬 애플리케이션
from app.core.config import settings

# MySQL 연결 문자열
DATABASE_URL = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,     # 끊긴 커넥션 자동 감지
    pool_recycle=3600,       # 장시간 유휴 연결 재활용(호스팅 환경 권장)
    echo=False              # 디버그가 필요하면 True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# FastAPI 의존성 주입용 세션 제공자
def get_db():
    """데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
    

