# 서드파티 라이브러리
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 로컬 애플리케이션
from app.core.config import settings

if not all([settings.DB_HOST, settings.DB_USER, settings.DB_NAME]):
    raise RuntimeError("DB env missing: DB_HOST/DB_NAME/DB_USER required")
# MySQL 연결 문자열
DATABASE_URL = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,     # 끊긴 커넥션 자동 감지
    pool_recycle=1800       # 장시간 idle 후 끊김 대응
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# FastAPI 의존성 주입용 세션 제공자
def get_db():
    """데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
    

