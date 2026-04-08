"""Search routes for PDFs, annotations, and notes."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models import User, PDF, Annotation, Note
from auth.handler import get_current_user

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("/")
async def search(
    q: str = Query(..., min_length=1),
    scope: Optional[str] = Query(None, description="Filter scope: pdfs, annotations, notes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search across user's PDFs, annotations, and notes."""
    pattern = f"%{q}%"
    results = {}

    # Get user's accessible PDF IDs
    if current_user.role == "admin":
        accessible_pdfs = db.query(PDF.id).all()
    else:
        accessible_pdfs = (
            db.query(PDF.id)
            .filter((PDF.owner_id == current_user.id) | (PDF.is_public == True))
            .all()
        )
    pdf_ids = [p.id for p in accessible_pdfs]

    if scope is None or scope == "pdfs":
        pdfs = (
            db.query(PDF)
            .filter(PDF.id.in_(pdf_ids), PDF.original_name.ilike(pattern))
            .limit(20)
            .all()
        )
        results["pdfs"] = [
            {"id": p.id, "name": p.original_name, "size": p.file_size}
            for p in pdfs
        ]

    if scope is None or scope == "annotations":
        annotations = (
            db.query(Annotation)
            .filter(
                Annotation.pdf_id.in_(pdf_ids),
                Annotation.content.ilike(pattern),
            )
            .limit(20)
            .all()
        )
        results["annotations"] = [
            {
                "id": a.id,
                "type": a.annotation_type,
                "content": a.content[:200],
                "pdf_id": a.pdf_id,
                "page": a.page_number,
            }
            for a in annotations
        ]

    if scope is None or scope == "notes":
        notes = (
            db.query(Note)
            .filter(
                Note.pdf_id.in_(pdf_ids),
                or_(Note.title.ilike(pattern), Note.content.ilike(pattern)),
            )
            .limit(20)
            .all()
        )
        results["notes"] = [
            {
                "id": n.id,
                "title": n.title,
                "content": n.content[:200],
                "pdf_id": n.pdf_id,
                "page": n.page_number,
            }
            for n in notes
        ]

    return results
