# 표준 라이브러리
from contextlib import asynccontextmanager

# 서드파티 라이브러리
import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 로컬 애플리케이션
from app.api.routers import api_router
from app.core.config import settings

# (필드, 에러 type) → 직접 문장형 메시지
_VALIDATION_MESSAGES: dict[tuple[str, str], str] = {
    ("email", "value_error"): "올바른 이메일 형식이 아닙니다.",
    ("email", "missing"): "이메일을 입력해주세요.",
    ("admin_name", "missing"): "이름을 입력해주세요.",
    ("plain_password", "missing"): "비밀번호를 입력해주세요.",
    ("admin_role", "enum"): "올바른 권한 값이 아닙니다.",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cafe24 OAuth용 httpx 클라이언트
    app.state.http_client = httpx.AsyncClient(timeout=30.0)
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title=settings.APP_TITLE,
    docs_url="/docs",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    if not errors:
        return JSONResponse(status_code=422, content={"detail": "입력값을 확인해주세요."})

    first = errors[0]
    field = str(first["loc"][-1]) if first.get("loc") else ""
    error_type = first.get("type", "")
    detail = _VALIDATION_MESSAGES.get((field, error_type), "입력값을 확인해주세요.")
    return JSONResponse(status_code=422, content={"detail": detail})

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        settings.BACKEND_URL,
        settings.PRODUCTION_BACKEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
        "X-Included-Count",
        "X-Skipped-Count",
    ],
)

# API 라우터 등록
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "관리자 시스템 API"}


