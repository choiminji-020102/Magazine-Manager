from fastapi import APIRouter
from app.api.v1.endpoints.subscriber import router as subscriber_router

api_router = APIRouter()

api_router.include_router(subscriber_router)

