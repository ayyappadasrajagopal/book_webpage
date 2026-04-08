"""
PDF Book Reader, Annotator & Editor Platform — FastAPI Backend

Entry point: starts the server, configures CORS, mounts static files,
creates DB tables, and seeds the admin user.
"""

import os
import sys
import logging

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import engine, SessionLocal, Base
from models import User
from auth.handler import get_password_hash

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("book_platform")

# --- Create FastAPI app ---
app = FastAPI(
    title="PDF Book Reader Platform",
    description="A research-grade PDF reading, annotation, and editing platform with multi-user support.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Create DB tables ---
Base.metadata.create_all(bind=engine)

# --- Seed admin user ---
def seed_admin():
    db = SessionLocal()
    try:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@bookplatform.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "Admin123!")
        existing = db.query(User).filter(User.email == admin_email).first()
        if not existing:
            admin = User(
                email=admin_email,
                hashed_password=get_password_hash(admin_password),
                full_name="Platform Admin",
                role="admin",
            )
            db.add(admin)
            db.commit()
            logger.info(f"Admin user created: {admin_email}")
        else:
            logger.info(f"Admin user already exists: {admin_email}")
    finally:
        db.close()

seed_admin()

# --- Register API routers ---
from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router
from routes.pdf_routes import router as pdf_router
from routes.annotation_routes import router as annotation_router
from routes.note_routes import router as note_router
from routes.admin_routes import router as admin_router
from routes.search_routes import router as search_router

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(pdf_router)
app.include_router(annotation_router)
app.include_router(note_router)
app.include_router(admin_router)
app.include_router(search_router)

# --- Mount static frontend ---
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# --- Serve frontend pages ---
@app.get("/", include_in_schema=False)
async def serve_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

@app.get("/dashboard", include_in_schema=False)
async def serve_dashboard():
    return FileResponse(os.path.join(FRONTEND_DIR, "dashboard.html"))

@app.get("/admin", include_in_schema=False)
async def serve_admin():
    return FileResponse(os.path.join(FRONTEND_DIR, "admin.html"))

# --- Health check ---
@app.get("/api/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
