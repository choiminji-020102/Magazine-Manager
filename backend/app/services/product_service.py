from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, Tuple, List
from fastapi import HTTPException, status

from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


def get_product_by_id(db: Session, product_id: int) -> Optional[Product]:
    product = db.query(Product).filter(
        Product.product_id == product_id
    ).first()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="id로 상품을 찾을 수 없습니다."
        )
    return product


def get_product_by_code(db: Session, product_code: str) -> Optional[Product]:
    product = db.query(Product).filter(
        Product.product_code == product_code
    ).first()
    return product


def get_product_by_external_code(db: Session, code: str, channel: str) -> Optional[Product]:
    if channel == "CAFE24":
        return db.query(Product).filter(Product.external_product_code_cafe24 == code).first()
    elif channel == "GPMALL":
        return db.query(Product).filter(Product.external_product_code_gpmall == code).first()
    return None


def get_products(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    kind: Optional[str] = None,
    is_active: Optional[bool] = None
) -> Tuple[List[Product], int]:
    query = db.query(Product)
    
    if search:
        query = query.filter(
            or_(
                Product.product_code.like(f"%{search}%"),
                Product.product_name.like(f"%{search}%")
            )
        )
    
    if kind:
        query = query.filter(Product.product_kind == kind)
    
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    
    total = query.count()
    
    offset = (page - 1) * limit
    items = query.order_by(Product.created_at.desc()).offset(offset).limit(limit).all()
    
    return items, total


def get_products_by_kind(db: Session, kind: str, active_only: bool = True) -> List[Product]:
    query = db.query(Product).filter(Product.product_kind == kind)
    
    if active_only:
        query = query.filter(Product.is_active == True)
    
    return query.order_by(Product.product_name.asc()).all()


def create_product(db: Session, product_in: ProductCreate) -> Product:
    product = Product(**product_in.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product: Product, product_in: ProductUpdate) -> Product:
    update_data = product_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product: Product) -> None:
    db.delete(product)
    db.commit()


def toggle_active(db: Session, product: Product) -> Product:
    product.is_active = not product.is_active
    db.commit()
    db.refresh(product)
    return product
