"""Notes CRUD routes."""

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, PDF, Note, ActivityLog
from auth.handler import get_current_user

router = APIRouter(prefix="/api/notes", tags=["Notes"])


class NoteCreate(BaseModel):
    pdf_id: str
    page_number: Optional[int] = None
    title: str = ""
    content: str = ""


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    page_number: Optional[int] = None


class NoteResponse(BaseModel):
    id: str
    pdf_id: str
    user_id: str
    page_number: Optional[int]
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def _check_pdf_access(db: Session, pdf_id: str, user: User) -> PDF:
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    if pdf.owner_id != user.id and not pdf.is_public and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return pdf


@router.post("/", response_model=NoteResponse, status_code=201)
async def create_note(
    data: NoteCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a note for a PDF."""
    _check_pdf_access(db, data.pdf_id, current_user)

    note = Note(
        pdf_id=data.pdf_id,
        user_id=current_user.id,
        page_number=data.page_number,
        title=data.title,
        content=data.content,
    )
    db.add(note)

    log = ActivityLog(
        user_id=current_user.id,
        action="create_note",
        details=f"Created note: {data.title}",
        ip_address=request.client.host if request.client else "",
    )
    db.add(log)
    db.commit()
    db.refresh(note)
    return note


@router.get("/pdf/{pdf_id}", response_model=List[NoteResponse])
async def list_notes(
    pdf_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List notes for a PDF."""
    _check_pdf_access(db, pdf_id, current_user)
    return (
        db.query(Note)
        .filter(Note.pdf_id == pdf_id, Note.user_id == current_user.id)
        .order_by(Note.created_at.desc())
        .all()
    )


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    updates: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a note."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a note."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(note)
    db.commit()
