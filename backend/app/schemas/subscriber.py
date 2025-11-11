from pydantic import BaseModel, EmailStr

class SubscriberCreate(BaseModel):
    email: str
    name: str

class SubscriberResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    
    class Config:
        from_attributes = True  # SQLAlchemy 객체 → Pydantic 변환

