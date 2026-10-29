import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, Base, SessionLocal
from app.db.models import DBClinicalRecord
from app.api.routes_extract import router as extract_router
from app.api.routes_records import router as records_router, create_record
from app.api.routes_audit import router as audit_router
from app.api.routes_export import router as export_router
from app.schemas.record import RecordCreateRequest

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables
    Base.metadata.create_all(bind=engine)
    
    # Seed sample record if empty
    db = SessionLocal()
    try:
        count = db.query(DBClinicalRecord).count()
        if count == 0:
            demo_text = (
                "At 14:32, patient was conscious but experiencing difficulty breathing. "
                "Administered oxygen at 10 liters per minute through a non-rebreather mask. "
                "At 14:36, administered 0.3 milligrams of epinephrine intramuscularly. "
                "Patient's breathing improved at 14:40."
            )
            create_record(
                payload=RecordCreateRequest(
                    text=demo_text,
                    source_type="audio_transcript",
                    actor_id="EMS-PARAMEDIC-01",
                    audio_duration_seconds=24.5,
                    speech_engine="WebSpeech-LocalEngine"
                ),
                db=db
            )
    finally:
        db.close()
        
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Emergency Voice-to-Structured Clinical Note Generator for First Responders",
    lifespan=lifespan
)

# Enable CORS for frontend development and local offline usage
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(extract_router, prefix=settings.API_V1_STR)
app.include_router(records_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(export_router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "Field-to-Record",
        "version": settings.SCHEMA_VERSION,
        "mode": "offline-capable local inference"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
