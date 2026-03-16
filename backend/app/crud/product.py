# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


def list_products(
    db: Session,
    page: int = 1,
    limit: int = 20,
    product_kind: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    subscribe_start_issue: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[Product], int]:
    query = db.query(Product)

    if product_kind:
        query = query.filter(Product.product_kind == product_kind)
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    if search:
        query = query.filter(
            or_(
                Product.product_code.like(f"%{search}%"),
                Product.product_name.like(f"%{search}%"),
            )
        )
    if subscribe_start_issue:
        query = query.filter(Product.subscribe_start_issue == subscribe_start_issue)

    # 정렬: 허용된 컬럼만 사용 (SQL 인젝션 방지)
    allowed_sort = {"created_at", "product_name", "list_price", "sale_price", "stock_quantity"}
    sort_col = getattr(Product, sort_by if sort_by in allowed_sort else "created_at")
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    total = query.count()
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()
    return items, total


def read_product_by_id(db: Session, product_id: int) -> Product:
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {product_id}에 해당하는 상품을 찾을 수 없습니다.",
        )
    return product


def read_product_by_code(db: Session, product_code: str) -> Optional[Product]:
    return db.query(Product).filter(Product.product_code == product_code).first()


def read_product_by_external_code(db: Session, code: str, channel: str) -> Optional[Product]:
    if channel == "CAFE24":
        return db.query(Product).filter(Product.external_product_code_cafe24 == code).first()
    elif channel == "GPMALL":
        return db.query(Product).filter(Product.external_product_code_gpmall == code).first()
    return None


def check_code_duplicate(
    db: Session,
    product_code: str,
    exclude_product_id: Optional[int] = None,
) -> None:
    """상품 코드 중복 검증 (중복이면 400 raise)"""
    query = db.query(Product).filter(Product.product_code == product_code)
    if exclude_product_id is not None:
        query = query.filter(Product.product_id != exclude_product_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"상품 코드 '{product_code}'는 이미 사용 중입니다.",
        )


def create_product(db: Session, product_in: ProductCreate) -> Product:
    product = Product(**product_in.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product: Product, product_in: ProductUpdate) -> Product:
    for field, value in product_in.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


def update_stock(db: Session, product: Product, stock_quantity: int) -> Product:
    product.stock_quantity = stock_quantity
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product: Product) -> None:
    db.delete(product)
    db.commit()


def set_active(db: Session, product: Product, is_active: bool) -> Product:
    product.is_active = is_active
    db.commit()
    db.refresh(product)
    return product
