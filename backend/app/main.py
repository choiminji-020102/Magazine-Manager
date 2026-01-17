# 서드파티 라이브러리
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx

# 로컬 애플리케이션
from app.api.routers import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    timeout = httpx.Timeout(connect=5.0, read=20.0, write=20.0, pool=5.0)
    app.state.http_client = httpx.AsyncClient(timeout=timeout)
    try:
        yield
    finally:
        await app.state.http_client.aclose()

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(lifespan=lifespan)

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


