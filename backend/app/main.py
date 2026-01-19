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

app = FastAPI(
    title=settings.APP_TITLE,
    docs_url="/docs",
)
# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        settings.BACKEND_URL,
        settings.PRODUCTION_BACKEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "관리자 시스템 API"}


