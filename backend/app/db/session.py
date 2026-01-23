# 서드파티 라이브러리
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# 로컬 애플리케이션
from app.core.config import settings


DATABASE_URL = settings.DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,     # 끊긴 커넥션 자동 감지
    pool_recycle=1800       # 장시간 idle 후 끊김 대응
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# FastAPI 의존성 주입용 세션 제공자
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()