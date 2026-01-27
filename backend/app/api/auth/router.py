from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
)
from app.models import User, WorkerPublic, WorkerPrivate, OrgMember, Invite
from app.schemas.auth import (
    SignupRequest,
    LoginRequest,
    TokenRefreshRequest,
    LoginResponse,
    TokenResponse,
    UserResponse,
)
from sqlalchemy import select

router = APIRouter()


@router.post("/signup", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with optional worker profile"""
    # Check if email already exists (required field)
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check phone uniqueness if provided
    if request.phone:
        result = await db.execute(select(User).where(User.phone == request.phone))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already registered")

    # Create user
    user = User(
        phone=request.phone,
        email=request.email,
        password_hash=get_password_hash(request.password),
        name=request.name,
    )
    db.add(user)
    await db.flush()

    worker_profile_id = None
    org_memberships = []
    signup_source = "direct"

    # Check if signing up via invite code
    if request.invite_code:
        result = await db.execute(
            select(Invite).where(
                Invite.code == request.invite_code,
                Invite.is_used == False,
                Invite.expires_at > datetime.utcnow()
            )
        )
        invite = result.scalar_one_or_none()
        if invite:
            signup_source = "org_invited"
            invite.is_used = True
            invite.used_by_user_id = user.id

    # Create worker profile if nickname provided
    if request.nickname:
        worker = WorkerPublic(
            user_id=user.id,
            nickname=request.nickname,
            region=request.region,
            work_types=request.work_types or [],
            signup_source=signup_source,
        )
        db.add(worker)
        await db.flush()
        worker_profile_id = worker.id

        # Create empty private info
        private_info = WorkerPrivate(
            worker_id=worker.id,
            real_name=request.name,
            phone=request.phone,
        )
        db.add(private_info)

    await db.commit()

    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return LoginResponse(
        user=UserResponse(
            id=user.id,
            phone=user.phone,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            created_at=user.created_at,
            has_worker_profile=worker_profile_id is not None,
            has_org_membership=False,
        ),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=3600,
        ),
        worker_profile_id=worker_profile_id,
        org_memberships=org_memberships,
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password"""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Update last login
    user.last_login_at = datetime.utcnow()

    # Get worker profile
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == user.id)
    )
    worker = result.scalar_one_or_none()

    # Get org memberships
    result = await db.execute(
        select(OrgMember).where(OrgMember.user_id == user.id)
    )
    memberships = result.scalars().all()

    await db.commit()

    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return LoginResponse(
        user=UserResponse(
            id=user.id,
            phone=user.phone,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            created_at=user.created_at,
            has_worker_profile=worker is not None,
            has_org_membership=len(memberships) > 0,
        ),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=3600,
        ),
        worker_profile_id=worker.id if worker else None,
        org_memberships=[
            {"org_id": str(m.org_id), "role": m.role} for m in memberships
        ],
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token"""
    payload = verify_token(request.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=3600,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get current user info"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()

    result = await db.execute(
        select(OrgMember).where(OrgMember.user_id == current_user.id)
    )
    memberships = result.scalars().all()

    return UserResponse(
        id=current_user.id,
        phone=current_user.phone,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        has_worker_profile=worker is not None,
        has_org_membership=len(memberships) > 0,
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout (client should discard tokens)"""
    # In a production system, you might want to blacklist the token
    return {"message": "Logged out successfully"}
