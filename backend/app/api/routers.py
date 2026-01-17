# 서드파티 라이브러리
from fastapi import APIRouter

# 로컬 애플리케이션
from app.api.endpoints.health import router as health_router
from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.cafe24_products import router as cafe24_products_router
from app.api.endpoints.cafe24_orders import router as cafe24_orders_router
from app.api.endpoints.cafe24_oauth import router as cafe24_oauth_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(admin_router)
api_router.include_router(auth_router)
api_router.include_router(cafe24_products_router)
api_router.include_router(cafe24_orders_router)
api_router.include_router(cafe24_oauth_router)
