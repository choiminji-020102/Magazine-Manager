from fastapi import APIRouter

from app.api.endpoints import (
    activity_logs,
    addresses,
    admins,
    auths,
    cafe24_oauths,
    cafe24_orders,
    cafe24_products,
    customers,
    dispatch_excel,
    dispatches,
    health,
    inquiries,
    order_items,
    orders,
    pauses,
    products,
    send_items,
    sends,
    stats,
    vip_slots,
)

api_router = APIRouter()

# Auth (public)
api_router.include_router(auths.router)

# Protected routes
api_router.include_router(activity_logs.router)
api_router.include_router(addresses.router)
api_router.include_router(admins.router)
api_router.include_router(cafe24_oauths.router)
api_router.include_router(cafe24_orders.router)
api_router.include_router(cafe24_products.router)
api_router.include_router(customers.router)
api_router.include_router(dispatch_excel.router)
api_router.include_router(dispatches.router)
api_router.include_router(health.router)
api_router.include_router(inquiries.router)
api_router.include_router(order_items.router)
api_router.include_router(orders.router)
api_router.include_router(pauses.router)
api_router.include_router(products.router)
api_router.include_router(send_items.router)
api_router.include_router(sends.router)
api_router.include_router(stats.router)
api_router.include_router(vip_slots.router)
