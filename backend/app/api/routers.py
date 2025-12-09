# 서드파티 라이브러리
from fastapi import APIRouter

# 로컬 애플리케이션
from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.auth import router as auth_router


api_router = APIRouter()
api_router.include_router(admin_router)
api_router.include_router(auth_router)