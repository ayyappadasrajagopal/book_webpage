"""SQLAlchemy ORM models for the PDF Book Reader Platform."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Text, Boolean,
    DateTime, ForeignKey, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")  # "admin" or "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    pdfs = relationship("PDF", back_populates="owner", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")


class PDF(Base):
    __tablename__ = "pdfs"

    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String(500), nullable=False)
    original_name = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    page_count = Column(Integer, default=0)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="pdfs")
    annotations = relationship("Annotation", back_populates="pdf", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="pdf", cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(String, primary_key=True, default=generate_uuid)
    pdf_id = Column(String, ForeignKey("pdfs.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    page_number = Column(Integer, nullable=False)
    annotation_type = Column(String(50), nullable=False)  # highlight, rectangle, circle, arrow, freehand, text_note, screenshot
    content = Column(Text, default="")
    position_x = Column(Float, default=0)
    position_y = Column(Float, default=0)
    width = Column(Float, default=0)
    height = Column(Float, default=0)
    color = Column(String(20), default="#FFFF00")
    stroke_width = Column(Float, default=2)
    path_data = Column(Text, default="")  # SVG path or freehand points JSON
    is_visible = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    pdf = relationship("PDF", back_populates="annotations")
    user = relationship("User", back_populates="annotations")
    history = relationship("AnnotationHistory", back_populates="annotation", cascade="all, delete-orphan")


class AnnotationHistory(Base):
    __tablename__ = "annotation_history"

    id = Column(String, primary_key=True, default=generate_uuid)
    annotation_id = Column(String, ForeignKey("annotations.id"), nullable=False)
    version = Column(Integer, nullable=False)
    annotation_type = Column(String(50), nullable=False)
    content = Column(Text, default="")
    position_x = Column(Float, default=0)
    position_y = Column(Float, default=0)
    width = Column(Float, default=0)
    height = Column(Float, default=0)
    color = Column(String(20), default="#FFFF00")
    stroke_width = Column(Float, default=2)
    path_data = Column(Text, default="")
    changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    annotation = relationship("Annotation", back_populates="history")


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    pdf_id = Column(String, ForeignKey("pdfs.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    page_number = Column(Integer, nullable=True)  # null means document-level note
    title = Column(String(500), default="")
    content = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    pdf = relationship("PDF", back_populates="notes")
    user = relationship("User", back_populates="notes")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    details = Column(Text, default="")
    ip_address = Column(String(50), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="activity_logs")
