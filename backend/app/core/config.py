# 표준 라이브러리
from datetime import timedelta

# 서드파티 라이브러리
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DB_HOST: str
    DB_PORT: int
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str
    
     # JWT
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    JWT_ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    # CORS
    FRONTEND_URL: str

    # 서버
    BACKEND_URL: str
    
    class Config:
        env_file = ".env"         # .env 파일 자동 로드
        case_sensitive = True     # 환경변수 대소문자 구분

settings = Settings()