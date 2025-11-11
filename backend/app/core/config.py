from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = ""
    
    class Config:
        env_file = ".env"         # .env 파일 자동 로드
        case_sensitive = True     # 환경변수 대소문자 구분

settings = Settings()

