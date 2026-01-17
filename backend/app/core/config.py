# 서드파티 라이브러리
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl

class Settings(BaseSettings):
    # Database
    DB_HOST: str
    DB_PORT: int
    DB_USER: str
    DB_NAME: str
    DB_PASSWORD: str
    
    # JWT
    JWT_ACCESS_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    JWT_ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    # CORS
    FRONTEND_URL: str

    # 서버
    BACKEND_URL: str

    # CAFE24
    CAFE24_MALL_ID: str
    CAFE24_REDIRECT_URI: AnyHttpUrl
    CAFE24_CLIENT_ID: str
    CAFE24_CLIENT_SECRET_KEY: str
    CAFE24_STATE_SECRET_KEY: str
    CAFE24_API_VERSION: str
    
    class Config:
        env_file = ".env"         # .env 파일 자동 로드
        case_sensitive = True     # 환경변수 대소문자 구분

settings = Settings()
