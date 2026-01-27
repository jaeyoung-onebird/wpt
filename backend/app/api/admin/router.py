from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date, timedelta
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import (
    User, Organization, OrgMember, WorkerPublic, WorkerPrivate,
    Event, Application, Attendance, PayrollRecord,
)
from app.schemas.admin import (
    OrgVerifyRequest, OrgAdminResponse, OrgListAdminResponse,
    UserAdminResponse, UserRoleUpdate, UserStatusUpdate,
    WorkerAdminResponse, TrustScoreUpdate,
    PlatformStats, DailyStats,
)
from app.schemas.common import PaginatedResponse, MessageResponse

router = APIRouter()


# ==================== Permission Check ====================

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Check if user is platform admin"""
    if current_user.platform_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def get_super_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Check if user is super admin"""
    if current_user.platform_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user


# ==================== Dashboard ====================

@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get platform-wide statistics"""
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    total_workers = (await db.execute(select(func.count()).select_from(WorkerPublic))).scalar()
    total_orgs = (await db.execute(select(func.count()).select_from(Organization))).scalar()
    verified_orgs = (await db.execute(
        select(func.count()).select_from(Organization).where(Organization.is_verified == True)
    )).scalar()
    total_events = (await db.execute(select(func.count()).select_from(Event))).scalar()
    active_events = (await db.execute(
        select(func.count()).select_from(Event).where(Event.status == "published")
    )).scalar()
    total_applications = (await db.execute(select(func.count()).select_from(Application))).scalar()
    total_payroll = (await db.execute(
        select(func.coalesce(func.sum(PayrollRecord.total_pay), 0))
    )).scalar()

    return PlatformStats(
        total_users=total_users,
        total_workers=total_workers,
        total_organizations=total_orgs,
        verified_organizations=verified_orgs,
        total_events=total_events,
        active_events=active_events,
        total_applications=total_applications,
        total_payroll_amount=total_payroll,
    )


@router.get("/stats/daily", response_model=list[DailyStats])
async def get_daily_stats(
    days: int = Query(7, ge=1, le=90),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get daily statistics for the past N days"""
    stats = []
    today = date.today()

    for i in range(days):
        target_date = today - timedelta(days=i)
        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = datetime.combine(target_date, datetime.max.time())

        new_users = (await db.execute(
            select(func.count()).select_from(User)
            .where(User.created_at.between(start_dt, end_dt))
        )).scalar()

        new_workers = (await db.execute(
            select(func.count()).select_from(WorkerPublic)
            .where(WorkerPublic.created_at.between(start_dt, end_dt))
        )).scalar()

        new_orgs = (await db.execute(
            select(func.count()).select_from(Organization)
            .where(Organization.created_at.between(start_dt, end_dt))
        )).scalar()

        new_events = (await db.execute(
            select(func.count()).select_from(Event)
            .where(Event.created_at.between(start_dt, end_dt))
        )).scalar()

        new_applications = (await db.execute(
            select(func.count()).select_from(Application)
            .where(Application.applied_at.between(start_dt, end_dt))
        )).scalar()

        completed_jobs = (await db.execute(
            select(func.count()).select_from(Attendance)
            .where(
                Attendance.status == "completed",
                Attendance.check_out_at.between(start_dt, end_dt)
            )
        )).scalar()

        total_paid = (await db.execute(
            select(func.coalesce(func.sum(PayrollRecord.total_pay), 0))
            .where(PayrollRecord.paid_at.between(start_dt, end_dt))
        )).scalar()

        stats.append(DailyStats(
            date=target_date.isoformat(),
            new_users=new_users,
            new_workers=new_workers,
            new_orgs=new_orgs,
            new_events=new_events,
            new_applications=new_applications,
            completed_jobs=completed_jobs,
            total_paid=total_paid,
        ))

    return stats


# ==================== Organization Management ====================

@router.get("/organizations", response_model=PaginatedResponse[OrgListAdminResponse])
async def list_organizations(
    is_verified: bool | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all organizations"""
    query = select(Organization)

    if is_verified is not None:
        query = query.where(Organization.is_verified == is_verified)
    if search:
        query = query.where(
            Organization.name.ilike(f"%{search}%") |
            Organization.business_number.ilike(f"%{search}%")
        )

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()

    result = await db.execute(
        query.order_by(Organization.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    orgs = result.scalars().all()

    return PaginatedResponse(
        items=[OrgListAdminResponse.model_validate(o) for o in orgs],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size if total > 0 else 0,
    )


@router.get("/organizations/{org_id}", response_model=OrgAdminResponse)
async def get_organization_detail(
    org_id: UUID,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get organization detail for admin"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Count total events
    total_events = (await db.execute(
        select(func.count()).select_from(Event).where(Event.org_id == org_id)
    )).scalar()

    return OrgAdminResponse(
        id=org.id,
        name=org.name,
        business_number=org.business_number,
        representative_name=org.representative_name,
        business_type=org.business_type,
        address=org.address,
        contact_phone=org.contact_phone,
        contact_email=org.contact_email,
        is_verified=org.is_verified,
        follower_count=org.follower_count,
        rating_avg=org.rating_avg,
        total_events=total_events,
        created_at=org.created_at,
    )


@router.patch("/organizations/{org_id}/verify", response_model=MessageResponse)
async def verify_organization(
    org_id: UUID,
    request: OrgVerifyRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify or unverify an organization"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.is_verified = request.is_verified
    await db.commit()

    status_text = "verified" if request.is_verified else "unverified"
    return MessageResponse(message=f"Organization {status_text}")


@router.delete("/organizations/{org_id}", response_model=MessageResponse)
async def delete_organization(
    org_id: UUID,
    admin: User = Depends(get_super_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete organization (super admin only)"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check if org has active events
    active_events = (await db.execute(
        select(func.count()).select_from(Event)
        .where(Event.org_id == org_id, Event.status.in_(["published", "in_progress"]))
    )).scalar()

    if active_events > 0:
        raise HTTPException(status_code=400, detail="Cannot delete organization with active events")

    await db.delete(org)
    await db.commit()
    return MessageResponse(message="Organization deleted")


# ==================== User Management ====================

@router.get("/users", response_model=PaginatedResponse[UserAdminResponse])
async def list_users(
    role: str | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users"""
    query = select(User)

    if role:
        query = query.where(User.platform_role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if search:
        query = query.where(
            User.name.ilike(f"%{search}%") |
            User.phone.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%")
        )

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()

    result = await db.execute(
        query.order_by(User.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    users = result.scalars().all()

    items = []
    for user in users:
        # Check worker profile
        has_worker = (await db.execute(
            select(func.count()).select_from(WorkerPublic)
            .where(WorkerPublic.user_id == user.id)
        )).scalar() > 0

        # Check org membership
        has_org = (await db.execute(
            select(func.count()).select_from(OrgMember)
            .where(OrgMember.user_id == user.id)
        )).scalar() > 0

        items.append(UserAdminResponse(
            id=user.id,
            phone=user.phone,
            email=user.email,
            name=user.name,
            platform_role=user.platform_role,
            is_active=user.is_active,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            has_worker_profile=has_worker,
            has_org_membership=has_org,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size if total > 0 else 0,
    )


@router.patch("/users/{user_id}/role", response_model=MessageResponse)
async def update_user_role(
    user_id: UUID,
    request: UserRoleUpdate,
    admin: User = Depends(get_super_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's platform role (super admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user.platform_role = request.platform_role
    await db.commit()
    return MessageResponse(message=f"User role updated to {request.platform_role}")


@router.patch("/users/{user_id}/status", response_model=MessageResponse)
async def update_user_status(
    user_id: UUID,
    request: UserStatusUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate/deactivate user"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")

    # Super admin can't be deactivated by regular admin
    if user.platform_role == "super_admin" and admin.platform_role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify super admin")

    user.is_active = request.is_active
    await db.commit()

    status_text = "activated" if request.is_active else "deactivated"
    return MessageResponse(message=f"User {status_text}")


# ==================== Worker Management ====================

@router.get("/workers", response_model=PaginatedResponse[WorkerAdminResponse])
async def list_workers(
    search: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all workers"""
    query = (
        select(WorkerPublic, WorkerPrivate)
        .outerjoin(WorkerPrivate, WorkerPrivate.worker_id == WorkerPublic.id)
    )

    if search:
        query = query.where(
            WorkerPublic.nickname.ilike(f"%{search}%") |
            WorkerPrivate.real_name.ilike(f"%{search}%") |
            WorkerPrivate.phone.ilike(f"%{search}%")
        )

    count_result = await db.execute(
        select(func.count()).select_from(WorkerPublic)
    )
    total = count_result.scalar()

    result = await db.execute(
        query.order_by(WorkerPublic.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    workers = result.all()

    items = [
        WorkerAdminResponse(
            id=w.WorkerPublic.id,
            user_id=w.WorkerPublic.user_id,
            nickname=w.WorkerPublic.nickname,
            real_name=w.WorkerPrivate.real_name if w.WorkerPrivate else None,
            phone=w.WorkerPrivate.phone if w.WorkerPrivate else None,
            region=w.WorkerPublic.region,
            trust_score=w.WorkerPublic.trust_score,
            total_jobs=w.WorkerPublic.total_jobs,
            no_show_count=w.WorkerPublic.no_show_count,
            late_count=w.WorkerPublic.late_count,
            signup_source=w.WorkerPublic.signup_source,
            created_at=w.WorkerPublic.created_at,
        )
        for w in workers
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size if total > 0 else 0,
    )


@router.patch("/workers/{worker_id}/trust-score", response_model=MessageResponse)
async def adjust_trust_score(
    worker_id: UUID,
    request: TrustScoreUpdate,
    admin: User = Depends(get_super_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually adjust worker's trust score (super admin only)"""
    result = await db.execute(select(WorkerPublic).where(WorkerPublic.id == worker_id))
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    old_score = worker.trust_score
    worker.trust_score = request.trust_score
    await db.commit()

    return MessageResponse(
        message=f"Trust score updated from {old_score} to {request.trust_score}. Reason: {request.reason}"
    )
