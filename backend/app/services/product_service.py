# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import parse_subscribe_start_issue
from app.crud import product as product_crud
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductListQuery, ProductStockUpdate, ProductUpdate


def get_products(db: Session, query: ProductListQuery) -> Tuple[List[Product], int]:
    return product_crud.list_products(
        db=db,
        page=query.page,
        limit=query.limit,
        product_kind=query.product_kind,
        is_active=query.is_active,
        search=query.search,
        subscribe_start_issue=query.subscribe_start_issue,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


def get_product_by_id(db: Session, product_id: int) -> Product:
    return product_crud.read_product_by_id(db=db, product_id=product_id)


def get_product_by_code(db: Session, product_code: str) -> Optional[Product]:
    return product_crud.read_product_by_code(db=db, product_code=product_code)


def get_product_by_external_code(db: Session, code: str, channel: str) -> Optional[Product]:
    return product_crud.read_product_by_external_code(db=db, code=code, channel=channel)


def create_product(db: Session, product_in: ProductCreate) -> Product:
    # 상품 코드 중복 검증
    product_crud.check_code_duplicate(db=db, product_code=product_in.product_code)

    # product_kind와 product_code 형식 일치 검증
    if product_in.product_kind == "YEARLY" and "+" not in product_in.product_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="YEARLY 상품의 product_code는 '+' 구분자와 시작 호를 포함해야 합니다. 예: M1001+202604",
        )
    if product_in.product_kind == "MONTHLY" and "-" not in product_in.product_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MONTHLY 상품의 product_code는 '-' 구분자와 시작 호를 포함해야 합니다. 예: M1001-202604",
        )

    # product_code에서 subscribe_start_issue 자동 파싱
    subscribe_start_issue = parse_subscribe_start_issue(product_in.product_code)

    # 파싱된 호 형식 검증 (YYYYMM)
    if subscribe_start_issue and (
        len(subscribe_start_issue) != 6 or not subscribe_start_issue.isdigit()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"product_code의 호 형식이 잘못되었습니다: '{subscribe_start_issue}' (YYYYMM 형식이어야 합니다)",
        )

    # 가격 검증: 정가 >= 판매가
    if product_in.list_price > 0 and product_in.sale_price > 0:
        if product_in.list_price < product_in.sale_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="정가(list_price)는 판매가(sale_price)보다 크거나 같아야 합니다.",
            )

    return product_crud.create_product(
        db=db, product_in=product_in, subscribe_start_issue=subscribe_start_issue
    )


def update_product(db: Session, product: Product, product_in: ProductUpdate) -> Product:
    # 상품 코드 변경 시 중복 검증
    if product_in.product_code is not None:
        product_crud.check_code_duplicate(
            db=db,
            product_code=product_in.product_code,
            exclude_product_id=product.product_id,
        )

    # 가격 검증: 정가 >= 판매가 (변경된 값 기준)
    new_list_price = product_in.list_price if product_in.list_price is not None else product.list_price
    new_sale_price = product_in.sale_price if product_in.sale_price is not None else product.sale_price
    if new_list_price > 0 and new_sale_price > 0 and new_list_price < new_sale_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="정가(list_price)는 판매가(sale_price)보다 크거나 같아야 합니다.",
        )

    return product_crud.update_product(db=db, product=product, product_in=product_in)


def update_stock(db: Session, product: Product, stock_in: ProductStockUpdate) -> Product:
    return product_crud.update_stock(db=db, product=product, stock_quantity=stock_in.stock_quantity)


def delete_product(db: Session, product: Product) -> None:
    product_crud.delete_product(db=db, product=product)


def activate(db: Session, product: Product) -> Product:
    return product_crud.set_active(db=db, product=product, is_active=True)


def deactivate(db: Session, product: Product) -> Product:
    return product_crud.set_active(db=db, product=product, is_active=False)
