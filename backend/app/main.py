import logging
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.routes.analysis import router as analysis_router
from app.routes.evidence import router as evidence_router
from app.routes.health import router as health_router
from app.routes.incident import router as incident_router

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("trace_ai.backend")


def create_application() -> FastAPI:
    """FastAPI application factory with middleware, routers, and exception handlers."""
    # Initialize SQLite database schema and storage automatically
    init_db()

    application = FastAPI(
        title=settings.PROJECT_NAME,
        description="TRACE AI - Evidence-based road accident timeline reconstruction backend API.",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # 3. CORS Configuration
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 4. Basic Error Handling
    @application.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        logger.warning(
            "HTTP %s exception on %s: %s", exc.status_code, request.url.path, exc.detail
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.detail,
                "status_code": exc.status_code,
            },
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        logger.warning("Validation error on %s: %s", request.url.path, exc.errors())
        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation Error",
                "detail": jsonable_encoder(exc.errors()),
                "status_code": 422,
            },
        )

    @application.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled server error on %s: %s", request.url.path, str(exc), exc_info=True
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "detail": "An unexpected error occurred on the server.",
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )

    # 2. Register Routes (Health, Incident, Evidence, Analysis under /api)
    application.include_router(health_router, prefix=settings.API_PREFIX, tags=["Health"])
    application.include_router(incident_router, prefix=settings.API_PREFIX, tags=["Incidents & Parties"])
    application.include_router(evidence_router, prefix=settings.API_PREFIX, tags=["Evidence Management"])
    application.include_router(analysis_router, prefix=settings.API_PREFIX, tags=["Analysis & Investigation"])

    @application.get("/", tags=["Root"])
    async def root():
        """Root endpoint with API summary and status."""
        return {
            "message": "TRACE AI Backend API is active",
            "docs": "/docs",
            "health": f"{settings.API_PREFIX}/health",
        }

    return application


app = create_application()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
