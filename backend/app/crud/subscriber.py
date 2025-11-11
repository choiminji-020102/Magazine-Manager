from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.subscriber import Subscriber
from app.schemas.subscriber import SubscriberCreate, SubscriberResponse


def read_subscriber_by_id(db: Session, subscriber_id: int) -> Subscriber:
    return db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()

def read_subscriber_by_name(db: Session, name: str) -> Optional[Subscriber]:
    return db.query(Subscriber).filter(Subscriber.name == name).first()

def read_subscribers(db: Session, skip: int = 0, limit: int = 100) -> List[Subscriber]:
    return db.query(Subscriber).offset(skip).limit(limit).all()

def create_subscriber(db: Session, subscriber_data: SubscriberCreate) -> Subscriber:
    db_subscriber = Subscriber(
        name=subscriber_data.name,
        email=subscriber_data.email
    )
    db.add(db_subscriber)
    db.commit()
    db.refresh(db_subscriber)
    return db_subscriber


