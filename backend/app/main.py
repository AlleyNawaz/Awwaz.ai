import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, select

from app.core.config import settings
from app.core.errors import AwwazException, ErrorCode
from app.core.logging import logger
from app.repositories.database import init_db, engine, AsyncSessionLocal
from app.repositories.models import DepartmentModel
from app.domain.routing.mappings import DEFAULT_DEPARTMENTS

# Import API routers
from app.api.routes.auth import router as auth_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.complaints import router as complaints_router
from app.api.routes.recommendations import router as recommendations_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.evidence import router as evidence_router
from app.api.routes.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist and seed default departments
    logger.info("Starting Awwaz Backend - initializing database...")
    await init_db()

    async with AsyncSessionLocal() as session:
        dept_res = await session.execute(select(DepartmentModel))
        existing_depts = dept_res.scalars().all()
        if not existing_depts:
            logger.info("Seeding default civic departments...")
            for cat, config in DEFAULT_DEPARTMENTS.items():
                dept = DepartmentModel(
                    name=config["name"],
                    category=cat,
                    active=True,
                    responsibility_chain=config["responsibility_chain"],
                )
                session.add(dept)
            await session.commit()
            logger.info("Default civic departments seeded.")

    yield
    # Shutdown
    logger.info("Shutting down Awwaz Backend...")
    await engine.dispose()


app = FastAPI(
    title="Awwaz - AI Civic Coordination Platform",
    description="Backend API for Awwaz autonomous civic triage and human-in-the-loop operations",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID and Timing Middleware
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:8]}"
    request.state.request_id = request_id
    start_time = time.time()

    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(duration_ms)
        return response
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Unhandled error during request {request_id} ({request.method} {request.url.path}): {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": ErrorCode.INTERNAL_ERROR,
                    "message": "An unexpected internal server error occurred.",
                    "request_id": request_id,
                },
            },
            headers={"X-Request-ID": request_id},
        )


# Exception Handlers
@app.exception_handler(AwwazException)
async def awwaz_exception_handler(request: Request, exc: AwwazException):
    req_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex[:8]}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": req_id,
            },
        },
        headers={"X-Request-ID": req_id},
    )


# Health and Readiness Probes
@app.get("/health", tags=["System"])
@app.get("/api/v1/health", tags=["System"])
async def health_check():
    """Liveness probe."""
    return {"status": "healthy", "service": "awwaz-backend"}


@app.get("/ready", tags=["System"])
@app.get("/api/v1/ready", tags=["System"])
async def readiness_check():
    """Readiness probe checking database connectivity."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "database_error": str(e)},
        )


# Mount API Routers under /api/v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")
app.include_router(complaints_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(evidence_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
