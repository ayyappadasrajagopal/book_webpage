"""Authentication routes: login, register, profile."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from models import User, ActivityLog
from auth.handler import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, Token, UserCreate, UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate user and return JWT token."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    access_token = create_access_token(data={"sub": user.id, "role": user.role})

    # Log activity
    log = ActivityLog(
        user_id=user.id,
        action="login",
        details=f"User logged in",
        ip_address=request.client.host if request.client else "",
    )
    db.add(log)
    db.commit()

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    full_name: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's profile."""
    if full_name:
        current_user.full_name = full_name
    db.commit()
    db.refresh(current_user)
    return current_user
