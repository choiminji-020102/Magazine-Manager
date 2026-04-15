# 표준 라이브러리
import asyncio
import logging

# 서드파티 라이브러리
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 로컬 애플리케이션
from app.api.routers import api_router
from app.core.config import settings
from app.crud.send import auto_deliver_shipped_sends
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


async def _auto_deliver_loop():
    """1시간마다 SHIPPING → DELIVERED 자동 전환 (shipped_at 기준 3일 경과)"""
    while True:
        await asyncio.sleep(86400)  # 24시간 간격
        try:
            db = SessionLocal()
            count = auto_deliver_shipped_sends(db, days=3)
            if count > 0:
                logger.info(f"자동 배송완료 전환: {count}건")
            db.close()
        except Exception as e:
            logger.error(f"자동 배송완료 전환 실패: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cafe24 OAuth용 httpx 클라이언트
    app.state.http_client = httpx.AsyncClient(timeout=30.0)
    task = asyncio.create_task(_auto_deliver_loop())
    yield
    task.cancel()
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
)

# API 라우터 등록
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "관리자 시스템 API"}


