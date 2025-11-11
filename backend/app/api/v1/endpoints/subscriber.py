from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models import subscriber as models_subscriber
from app.schemas import subscriber as schemas_subscriber
from app.crud import subscriber as crud_subscriber

router = APIRouter(prefix="/subscribers", tags=["구독자"])

@router.post("", response_model=schemas_subscriber.SubscriberResponse)
def register_subscriber(subscriber_data: schemas_subscriber.SubscriberCreate, db: Session = Depends(get_db)):
    # 중복 구독자명 체크
    existing_subscriber = crud_subscriber.read_subscriber_by_name(db, name=subscriber_data.name)
    if existing_subscriber:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 구독자입니다"
        )
    
    return crud_subscriber.create_subscriber(db=db, subscriber_data=subscriber_data)

@router.get("", response_model=List[schemas_subscriber.SubscriberResponse])
def get_subscribers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_subscriber.read_subscribers(db=db, skip=skip, limit=limit)

@router.get("/{subscriber_id}", response_model=schemas_subscriber.SubscriberResponse)
def get_subscriber(subscriber_id: int, db: Session = Depends(get_db)):
    return crud_subscriber.read_subscriber_by_id(db=db, subscriber_id=subscriber_id)
