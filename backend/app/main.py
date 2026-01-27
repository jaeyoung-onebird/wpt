from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.org import router as org_router
from app.api.worker import router as worker_router
from app.api.admin import router as admin_router


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="이벤트/행사 인력 매칭 플랫폼 API",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(auth_router.router, prefix="/api/auth", tags=["Auth"])
    app.include_router(org_router.router, prefix="/api/org", tags=["Organization"])
    app.include_router(worker_router.router, prefix="/api/worker", tags=["Worker"])
    app.include_router(admin_router.router, prefix="/api/admin", tags=["Admin"])

    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running"
        }

    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
