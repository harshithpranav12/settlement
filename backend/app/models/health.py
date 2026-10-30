from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Pydantic model for service health check response."""

    status: str = Field(default="ok", description="Current health status of the service")
    service: str = Field(default="TRACE AI Backend", description="Service identifier")
    version: str = Field(default="0.1.0", description="Backend semantic version")
    environment: str = Field(default="development", description="Current deployment environment")
