from fastapi import APIRouter

from app.api.endpoints import (
    activity_logs,
    addresses,
    admins,
    auth,
    cafe24_oauth,
    cafe24_orders,
    cafe24_products,
    customers,
    dispatch,
    health,
    inquiries,
    order_items,
    orders,
    pauses,
    products,
    send_items,
    sends,
    stats,
)

api_router = APIRouter()

# Auth (public)
api_router.include_router(auth.router)

# Protected routes
api_router.include_router(activity_logs.router)
api_router.include_router(addresses.router)
api_router.include_router(admins.router)
api_router.include_router(cafe24_oauth.router)
api_router.include_router(cafe24_orders.router)
api_router.include_router(cafe24_products.router)
api_router.include_router(customers.router)
api_router.include_router(dispatch.router)
api_router.include_router(health.router)
api_router.include_router(inquiries.router)
api_router.include_router(order_items.router)
api_router.include_router(orders.router)
api_router.include_router(pauses.router)
api_router.include_router(products.router)
api_router.include_router(send_items.router)
api_router.include_router(sends.router)
api_router.include_router(stats.router)
