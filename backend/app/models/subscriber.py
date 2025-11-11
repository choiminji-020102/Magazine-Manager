from sqlalchemy import Column, Integer, String, DateTime, Boolean
from app.db.base import Base

# SQLAlchemy 모델 클래스
class Subscriber(Base):
    __tablename__ = "subscribers_mj"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(255), unique=True, nullable=False)
