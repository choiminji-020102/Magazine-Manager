# 서드파티 라이브러리
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 로컬 애플리케이션
from app.api.routers import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "관리자 시스템 API"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
