"""Annotation CRUD routes with versioning."""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, PDF, Annotation, AnnotationHistory, ActivityLog
from auth.handler import get_current_user

router = APIRouter(prefix="/api/annotations", tags=["Annotations"])


class AnnotationCreate(BaseModel):
    pdf_id: str
    page_number: int
    annotation_type: str
    content: str = ""
    position_x: float = 0
    position_y: float = 0
    width: float = 0
    height: float = 0
    color: str = "#FFFF00"
    stroke_width: float = 2
    path_data: str = ""


class AnnotationUpdate(BaseModel):
    content: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    stroke_width: Optional[float] = None
    path_data: Optional[str] = None
    is_visible: Optional[bool] = None


class AnnotationResponse(BaseModel):
    id: str
    pdf_id: str
    user_id: str
    page_number: int
    annotation_type: str
    content: str
    position_x: float
    position_y: float
    width: float
    height: float
    color: str
    stroke_width: float
    path_data: str
    is_visible: bool
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnnotationHistoryResponse(BaseModel):
    id: str
    annotation_id: str
    version: int
    annotation_type: str
    content: str
    position_x: float
    position_y: float
    width: float
    height: float
    color: str
    stroke_width: float
    path_data: str
    changed_at: datetime

    class Config:
        from_attributes = True


def _check_pdf_access(db: Session, pdf_id: str, user: User) -> PDF:
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    if pdf.owner_id != user.id and not pdf.is_public and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return pdf


@router.post("/", response_model=AnnotationResponse, status_code=201)
async def create_annotation(
    data: AnnotationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new annotation on a PDF page."""
    _check_pdf_access(db, data.pdf_id, current_user)

    valid_types = {"highlight", "rectangle", "circle", "arrow", "freehand", "text_note", "screenshot"}
    if data.annotation_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {valid_types}")

    annotation = Annotation(
        pdf_id=data.pdf_id,
        user_id=current_user.id,
        page_number=data.page_number,
        annotation_type=data.annotation_type,
        content=data.content,
        position_x=data.position_x,
        position_y=data.position_y,
        width=data.width,
        height=data.height,
        color=data.color,
        stroke_width=data.stroke_width,
        path_data=data.path_data,
    )
    db.add(annotation)

    # Log activity
    log = ActivityLog(
        user_id=current_user.id,
        action="create_annotation",
        details=f"Created {data.annotation_type} on page {data.page_number}",
        ip_address=request.client.host if request.client else "",
    )
    db.add(log)
    db.commit()
    db.refresh(annotation)
    return annotation


@router.get("/pdf/{pdf_id}", response_model=List[AnnotationResponse])
async def list_annotations(
    pdf_id: str,
    page: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List annotations for a PDF, optionally filtered by page."""
    _check_pdf_access(db, pdf_id, current_user)

    query = db.query(Annotation).filter(Annotation.pdf_id == pdf_id)
    if page is not None:
        query = query.filter(Annotation.page_number == page)
    return query.order_by(Annotation.created_at).all()


@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: str,
    updates: AnnotationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an annotation and create a history version."""
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if ann.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    # Save current state to history
    history = AnnotationHistory(
        annotation_id=ann.id,
        version=ann.version,
        annotation_type=ann.annotation_type,
        content=ann.content,
        position_x=ann.position_x,
        position_y=ann.position_y,
        width=ann.width,
        height=ann.height,
        color=ann.color,
        stroke_width=ann.stroke_width,
        path_data=ann.path_data,
    )
    db.add(history)

    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ann, field, value)
    ann.version += 1

    # Log
    log = ActivityLog(
        user_id=current_user.id,
        action="update_annotation",
        details=f"Updated annotation {annotation_id} to v{ann.version}",
        ip_address=request.client.host if request.client else "",
    )
    db.add(log)
    db.commit()
    db.refresh(ann)
    return ann


@router.delete("/{annotation_id}", status_code=204)
async def delete_annotation(
    annotation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an annotation."""
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if ann.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    log = ActivityLog(
        user_id=current_user.id,
        action="delete_annotation",
        details=f"Deleted annotation {annotation_id}",
        ip_address=request.client.host if request.client else "",
    )
    db.add(log)
    db.delete(ann)
    db.commit()


@router.put("/{annotation_id}/toggle-visibility", response_model=AnnotationResponse)
async def toggle_visibility(
    annotation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle annotation visibility."""
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if ann.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    ann.is_visible = not ann.is_visible
    db.commit()
    db.refresh(ann)
    return ann


@router.get("/{annotation_id}/history", response_model=List[AnnotationHistoryResponse])
async def get_annotation_history(
    annotation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get version history for an annotation."""
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if ann.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    return (
        db.query(AnnotationHistory)
        .filter(AnnotationHistory.annotation_id == annotation_id)
        .order_by(AnnotationHistory.version.desc())
        .all()
    )
