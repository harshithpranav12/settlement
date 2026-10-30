"""API routes package."""

from app.routes.analysis import router as analysis_router
from app.routes.evidence import router as evidence_router
from app.routes.health import router as health_router
from app.routes.incident import router as incident_router

__all__ = ["analysis_router", "evidence_router", "health_router", "incident_router"]
