"""PDF upload, listing, serving, and management routes."""

import os
import uuid
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, PDF, ActivityLog
from auth.handler import get_current_user, get_current_admin

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/api/pdfs", tags=["PDFs"])


class PDFResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    file_size: int
    page_count: int
    owner_id: str
    is_public: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/upload", response_model=PDFResponse, status_code=201)
async def upload_pdf(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF file."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    # Save file
    contents = await file.read()
    file_size = len(contents)
    with open(file_path, "wb") as f:
        f.write(contents)

    # Create DB record
    pdf = PDF(
        filename=unique_name,
        original_name=file.filename,
        file_size=file_size,
        owner_id=current_user.id,
    )
    db.add(pdf)

    # Log activity
    log = ActivityLog(
        user_id=current_user.id,
        action="upload_pdf",
        details=f"Uploaded: {file.filename}",
        ip_address=request.client.host if request.client else "",
    )
    db.add(log)
    db.commit()
    db.refresh(pdf)
    return pdf


@router.get("/", response_model=List[PDFResponse])
async def list_pdfs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List PDFs. Admins see all; users see own + public."""
    if current_user.role == "admin":
        return db.query(PDF).order_by(PDF.created_at.desc()).all()
    return (
        db.query(PDF)
        .filter((PDF.owner_id == current_user.id) | (PDF.is_public == True))
        .order_by(PDF.created_at.desc())
        .all()
    )


@router.get("/{pdf_id}", response_model=PDFResponse)
async def get_pdf(
    pdf_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get PDF metadata."""
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    if pdf.owner_id != current_user.id and not pdf.is_public and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return pdf


@router.get("/{pdf_id}/file")
async def serve_pdf_file(
    pdf_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve the actual PDF file for viewing."""
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    if pdf.owner_id != current_user.id and not pdf.is_public and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    file_path = os.path.join(UPLOAD_DIR, pdf.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(file_path, media_type="application/pdf", filename=pdf.original_name)


@router.delete("/{pdf_id}", status_code=204)
async def delete_pdf(
    pdf_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a PDF and its file."""
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    if pdf.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete file
    file_path = os.path.join(UPLOAD_DIR, pdf.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    # Log activity
    log = ActivityLog(
        user_id=current_user.id,
        action="delete_pdf",
        details=f"Deleted: {pdf.original_name}",
        ip_address=request.client.host if request.client else "",
    )
    db.add(log)
    db.delete(pdf)
    db.commit()


@router.put("/{pdf_id}/toggle-public", response_model=PDFResponse)
async def toggle_public(
    pdf_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle PDF public/private status."""
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    if pdf.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    pdf.is_public = not pdf.is_public
    db.commit()
    db.refresh(pdf)
    return pdf
