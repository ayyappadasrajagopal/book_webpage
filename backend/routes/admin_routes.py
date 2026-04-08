"""Admin dashboard routes: stats, logs, search."""

import os
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from database import get_db
from models import User, PDF, Annotation, Note, ActivityLog
from auth.handler import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_pdfs: int
    total_annotations: int
    total_notes: int
    storage_bytes: int


class ActivityLogResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    action: str
    details: str
    ip_address: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Get platform statistics for admin dashboard."""
    upload_dir = os.getenv("UPLOAD_DIR", "../uploads")
    storage = 0
    if os.path.exists(upload_dir):
        for f in os.listdir(upload_dir):
            fp = os.path.join(upload_dir, f)
            if os.path.isfile(fp):
                storage += os.path.getsize(fp)

    return DashboardStats(
        total_users=db.query(func.count(User.id)).scalar(),
        active_users=db.query(func.count(User.id)).filter(User.is_active == True).scalar(),
        total_pdfs=db.query(func.count(PDF.id)).scalar(),
        total_annotations=db.query(func.count(Annotation.id)).scalar(),
        total_notes=db.query(func.count(Note.id)).scalar(),
        storage_bytes=storage,
    )


@router.get("/logs", response_model=List[ActivityLogResponse])
async def get_activity_logs(
    limit: int = Query(100, ge=1, le=500),
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Get activity logs with optional filters."""
    query = (
        db.query(
            ActivityLog.id,
            ActivityLog.user_id,
            User.email.label("user_email"),
            ActivityLog.action,
            ActivityLog.details,
            ActivityLog.ip_address,
            ActivityLog.created_at,
        )
        .join(User, User.id == ActivityLog.user_id)
    )

    if action:
        query = query.filter(ActivityLog.action == action)
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)

    rows = query.order_by(ActivityLog.created_at.desc()).limit(limit).all()
    return [
        ActivityLogResponse(
            id=r.id,
            user_id=r.user_id,
            user_email=r.user_email,
            action=r.action,
            details=r.details,
            ip_address=r.ip_address,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/search")
async def global_search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Search across PDFs, annotations, and notes."""
    pattern = f"%{q}%"

    pdfs = (
        db.query(PDF)
        .filter(PDF.original_name.ilike(pattern))
        .limit(20)
        .all()
    )

    annotations = (
        db.query(Annotation)
        .filter(Annotation.content.ilike(pattern))
        .limit(20)
        .all()
    )

    notes = (
        db.query(Note)
        .filter(or_(Note.title.ilike(pattern), Note.content.ilike(pattern)))
        .limit(20)
        .all()
    )

    return {
        "pdfs": [{"id": p.id, "name": p.original_name} for p in pdfs],
        "annotations": [
            {"id": a.id, "type": a.annotation_type, "content": a.content[:100], "pdf_id": a.pdf_id}
            for a in annotations
        ],
        "notes": [
            {"id": n.id, "title": n.title, "content": n.content[:100], "pdf_id": n.pdf_id}
            for n in notes
        ],
    }
