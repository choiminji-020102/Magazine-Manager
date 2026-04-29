# 서드파티 라이브러리
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 로컬 애플리케이션
from app.api.routers import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cafe24 OAuth용 httpx 클라이언트
    app.state.http_client = httpx.AsyncClient(timeout=30.0)
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title=settings.APP_TITLE,
    docs_url="/docs",
    lifespan=lifespan,
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
    expose_headers=[
        "Content-Disposition",
        "X-Included-Count",
        "X-Skipped-Count",
        "X-Courier-Company",
    ],
)

# API 라우터 등록
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "관리자 시스템 API"}


