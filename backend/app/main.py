from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

from app.core.config import settings
from app.core.database import engine, create_tables
from app.api import auth, workspaces, datasets, dashboards, queries, ai_insights, templates


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (for SQLite dev mode)
    await create_tables()
    yield
    await engine.dispose()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=True,
    lifespan=lifespan
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print("UNHANDLED ERROR:", tb)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb}
    )

if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(workspaces.router, prefix="/api/v1/workspaces")
app.include_router(datasets.router, prefix="/api/v1/datasets")
app.include_router(dashboards.router, prefix="/api/v1/dashboards")
app.include_router(queries.router, prefix="/api/v1/queries")
app.include_router(ai_insights.router, prefix="/api/v1/ai")
app.include_router(templates.router, prefix="/api/v1/templates")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.VERSION}
