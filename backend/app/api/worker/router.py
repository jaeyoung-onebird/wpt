from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, date
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import (
    User, WorkerPublic, WorkerPrivate, WorkerPreferences, WorkerUnavailableDate,
    WorkerOrgFollow, OrgWorkerFollow, WorkerOrgBlock, OrgWorkerBlock,
    Event, EventPosition, Application, Attendance, PayrollRecord,
    Organization,
)
from app.schemas.worker import (
    WorkerProfileCreate, WorkerProfileUpdate, WorkerPrivateUpdate,
    WorkerPublicResponse, WorkerFullResponse, WorkerPrivateResponse,
    WorkerPreferencesUpdate, WorkerPreferencesResponse,
    UnavailableDateCreate, UnavailableDateResponse,
    FollowOrgRequest, FollowingOrgResponse, BlockOrgRequest,
)
from app.schemas.event import (
    EventListResponse, EventResponse, EventSearchParams,
    ApplicationCreate, ApplicationResponse,
)
from app.schemas.attendance import (
    CheckInRequest, CheckOutRequest, AttendanceResponse,
    PayrollResponse, ScheduleResponse,
)
from app.schemas.common import PaginatedResponse, MessageResponse

router = APIRouter()


# ==================== Profile Management ====================

@router.post("/profile", response_model=WorkerPublicResponse, status_code=status.HTTP_201_CREATED)
async def create_worker_profile(
    request: WorkerProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create worker profile for existing user"""
    # Check if already has profile
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Worker profile already exists")

    worker = WorkerPublic(
        user_id=current_user.id,
        nickname=request.nickname,
        region=request.region,
        work_types=request.work_types,
        bio=request.bio,
        signup_source="direct",
    )
    db.add(worker)
    await db.flush()

    private_info = WorkerPrivate(
        worker_id=worker.id,
        real_name=request.real_name,
        phone=request.phone,
        birthdate=request.birthdate,
        gender=request.gender,
    )
    db.add(private_info)

    preferences = WorkerPreferences(worker_id=worker.id)
    db.add(preferences)

    await db.commit()
    await db.refresh(worker)
    return worker


@router.get("/profile", response_model=WorkerFullResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's worker profile"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    result = await db.execute(
        select(WorkerPrivate).where(WorkerPrivate.worker_id == worker.id)
    )
    private_info = result.scalar_one_or_none()

    result = await db.execute(
        select(WorkerPreferences).where(WorkerPreferences.worker_id == worker.id)
    )
    preferences = result.scalar_one_or_none()

    return WorkerFullResponse(
        id=worker.id,
        nickname=worker.nickname,
        profile_image_url=worker.profile_image_url,
        region=worker.region,
        work_types=worker.work_types,
        bio=worker.bio,
        trust_score=worker.trust_score,
        total_jobs=worker.total_jobs,
        rating_avg=worker.rating_avg,
        rating_count=worker.rating_count,
        no_show_count=worker.no_show_count,
        late_count=worker.late_count,
        signup_source=worker.signup_source,
        created_at=worker.created_at,
        private_info=WorkerPrivateResponse.model_validate(private_info) if private_info else None,
        preferences=WorkerPreferencesResponse.model_validate(preferences) if preferences else None,
    )


@router.patch("/profile", response_model=WorkerPublicResponse)
async def update_profile(
    request: WorkerProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update worker public profile"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(worker, field, value)

    await db.commit()
    await db.refresh(worker)
    return worker


@router.patch("/profile/private", response_model=WorkerPrivateResponse)
async def update_private_info(
    request: WorkerPrivateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update worker private info"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    result = await db.execute(
        select(WorkerPrivate).where(WorkerPrivate.worker_id == worker.id)
    )
    private_info = result.scalar_one_or_none()
    if not private_info:
        raise HTTPException(status_code=404, detail="Private info not found")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(private_info, field, value)

    await db.commit()
    await db.refresh(private_info)
    return private_info


@router.patch("/preferences", response_model=WorkerPreferencesResponse)
async def update_preferences(
    request: WorkerPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update worker preferences"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    result = await db.execute(
        select(WorkerPreferences).where(WorkerPreferences.worker_id == worker.id)
    )
    preferences = result.scalar_one_or_none()
    if not preferences:
        preferences = WorkerPreferences(worker_id=worker.id)
        db.add(preferences)

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(preferences, field, value)

    await db.commit()
    await db.refresh(preferences)
    return preferences


# ==================== Unavailable Dates ====================

@router.get("/unavailable-dates", response_model=list[UnavailableDateResponse])
async def get_unavailable_dates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get worker's unavailable dates"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    result = await db.execute(
        select(WorkerUnavailableDate)
        .where(
            WorkerUnavailableDate.worker_id == worker.id,
            WorkerUnavailableDate.unavailable_date >= date.today()
        )
        .order_by(WorkerUnavailableDate.unavailable_date)
    )
    dates = result.scalars().all()
    return dates


@router.post("/unavailable-dates", response_model=UnavailableDateResponse)
async def add_unavailable_date(
    request: UnavailableDateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add unavailable date"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    unavailable = WorkerUnavailableDate(
        worker_id=worker.id,
        unavailable_date=request.unavailable_date,
        reason=request.reason,
    )
    db.add(unavailable)
    await db.commit()
    await db.refresh(unavailable)
    return unavailable


@router.delete("/unavailable-dates/{date_id}", response_model=MessageResponse)
async def remove_unavailable_date(
    date_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove unavailable date"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    result = await db.execute(
        select(WorkerUnavailableDate).where(
            WorkerUnavailableDate.id == date_id,
            WorkerUnavailableDate.worker_id == worker.id
        )
    )
    unavailable = result.scalar_one_or_none()
    if not unavailable:
        raise HTTPException(status_code=404, detail="Date not found")

    await db.delete(unavailable)
    await db.commit()
    return MessageResponse(message="Date removed")


# ==================== Follow/Block Organizations ====================

@router.get("/following", response_model=list[FollowingOrgResponse])
async def get_following_orgs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get organizations worker is following"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    result = await db.execute(
        select(WorkerOrgFollow, Organization)
        .join(Organization, Organization.id == WorkerOrgFollow.org_id)
        .where(WorkerOrgFollow.worker_id == worker.id)
    )
    follows = result.all()

    # Check mutual follows
    org_ids = [f.WorkerOrgFollow.org_id for f in follows]
    result = await db.execute(
        select(OrgWorkerFollow.org_id)
        .where(
            OrgWorkerFollow.worker_id == worker.id,
            OrgWorkerFollow.org_id.in_(org_ids)
        )
    )
    mutual_ids = set(r[0] for r in result.all())

    return [
        FollowingOrgResponse(
            id=f.WorkerOrgFollow.id,
            org_id=f.Organization.id,
            org_name=f.Organization.name,
            org_logo_url=f.Organization.logo_url,
            is_mutual=f.Organization.id in mutual_ids,
            followed_at=f.WorkerOrgFollow.created_at,
        )
        for f in follows
    ]


@router.post("/follow", response_model=MessageResponse)
async def follow_org(
    request: FollowOrgRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Follow an organization"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    # Check if blocked
    result = await db.execute(
        select(WorkerOrgBlock).where(
            WorkerOrgBlock.worker_id == worker.id,
            WorkerOrgBlock.org_id == request.org_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cannot follow blocked organization")

    # Check if already following
    result = await db.execute(
        select(WorkerOrgFollow).where(
            WorkerOrgFollow.worker_id == worker.id,
            WorkerOrgFollow.org_id == request.org_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already following")

    follow = WorkerOrgFollow(
        worker_id=worker.id,
        org_id=request.org_id,
    )
    db.add(follow)
    await db.commit()
    return MessageResponse(message="Followed successfully")


@router.delete("/follow/{org_id}", response_model=MessageResponse)
async def unfollow_org(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unfollow an organization"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    result = await db.execute(
        select(WorkerOrgFollow).where(
            WorkerOrgFollow.worker_id == worker.id,
            WorkerOrgFollow.org_id == org_id
        )
    )
    follow = result.scalar_one_or_none()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following")

    await db.delete(follow)
    await db.commit()
    return MessageResponse(message="Unfollowed")


@router.post("/block", response_model=MessageResponse)
async def block_org(
    request: BlockOrgRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block an organization"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    # Remove follow if exists
    result = await db.execute(
        select(WorkerOrgFollow).where(
            WorkerOrgFollow.worker_id == worker.id,
            WorkerOrgFollow.org_id == request.org_id
        )
    )
    follow = result.scalar_one_or_none()
    if follow:
        await db.delete(follow)

    block = WorkerOrgBlock(
        worker_id=worker.id,
        org_id=request.org_id,
        reason=request.reason,
    )
    db.add(block)
    await db.commit()
    return MessageResponse(message="Organization blocked")


# ==================== Event Search & Application ====================

@router.get("/events", response_model=PaginatedResponse[EventListResponse])
async def search_events(
    region: str | None = None,
    work_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    min_hourly_rate: int | None = None,
    following_only: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search events"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()

    query = (
        select(Event, Organization)
        .join(Organization, Organization.id == Event.org_id)
        .where(Event.status == "published")
    )

    # Apply filters
    if date_from:
        query = query.where(Event.event_date >= date_from)
    if date_to:
        query = query.where(Event.event_date <= date_to)

    # Filter by blocked orgs
    if worker:
        blocked_orgs = await db.execute(
            select(WorkerOrgBlock.org_id).where(WorkerOrgBlock.worker_id == worker.id)
        )
        blocked_ids = [r[0] for r in blocked_orgs.all()]
        if blocked_ids:
            query = query.where(Event.org_id.notin_(blocked_ids))

        # Filter by orgs that blocked this worker
        blocking_orgs = await db.execute(
            select(OrgWorkerBlock.org_id).where(OrgWorkerBlock.worker_id == worker.id)
        )
        blocking_ids = [r[0] for r in blocking_orgs.all()]
        if blocking_ids:
            query = query.where(Event.org_id.notin_(blocking_ids))

        if following_only:
            following = await db.execute(
                select(WorkerOrgFollow.org_id).where(WorkerOrgFollow.worker_id == worker.id)
            )
            following_ids = [r[0] for r in following.all()]
            query = query.where(Event.org_id.in_(following_ids))

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Execute
    result = await db.execute(
        query.order_by(Event.event_date)
        .offset((page - 1) * size)
        .limit(size)
    )
    events = result.all()

    # Get following status
    following_ids = set()
    if worker:
        result = await db.execute(
            select(WorkerOrgFollow.org_id).where(WorkerOrgFollow.worker_id == worker.id)
        )
        following_ids = set(r[0] for r in result.all())

    items = []
    for e in events:
        # Get hourly rates
        rates_result = await db.execute(
            select(
                func.min(EventPosition.hourly_rate),
                func.max(EventPosition.hourly_rate)
            ).where(EventPosition.event_id == e.Event.id)
        )
        rates = rates_result.one()

        items.append(EventListResponse(
            id=e.Event.id,
            org_id=e.Organization.id,
            org_name=e.Organization.name,
            org_logo_url=e.Organization.logo_url,
            title=e.Event.title,
            event_date=e.Event.event_date,
            start_time=e.Event.start_time,
            end_time=e.Event.end_time,
            location_name=e.Event.location_name,
            status=e.Event.status,
            total_positions=e.Event.total_positions,
            filled_positions=e.Event.filled_positions,
            min_hourly_rate=rates[0] or 0,
            max_hourly_rate=rates[1] or 0,
            is_following_org=e.Organization.id in following_ids,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size if total > 0 else 0,
    )


@router.post("/apply", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_to_event(
    request: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply to an event position"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    # Get position and event
    result = await db.execute(
        select(EventPosition, Event, Organization)
        .join(Event, Event.id == EventPosition.event_id)
        .join(Organization, Organization.id == Event.org_id)
        .where(EventPosition.id == request.position_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Position not found")

    position, event, org = row.EventPosition, row.Event, row.Organization

    if event.status != "published":
        raise HTTPException(status_code=400, detail="Event is not accepting applications")

    # Check if blocked
    result = await db.execute(
        select(OrgWorkerBlock).where(
            OrgWorkerBlock.org_id == event.org_id,
            OrgWorkerBlock.worker_id == worker.id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are blocked by this organization")

    result = await db.execute(
        select(WorkerOrgBlock).where(
            WorkerOrgBlock.worker_id == worker.id,
            WorkerOrgBlock.org_id == event.org_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have blocked this organization")

    # Check if already applied
    result = await db.execute(
        select(Application).where(
            Application.worker_id == worker.id,
            Application.event_id == event.id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already applied to this event")

    application = Application(
        worker_id=worker.id,
        event_id=event.id,
        position_id=position.id,
        note=request.note,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    return ApplicationResponse(
        id=application.id,
        event_id=event.id,
        event_title=event.title,
        event_date=event.event_date,
        position_id=position.id,
        position_title=position.title,
        org_name=org.name,
        status=application.status,
        note=application.note,
        applied_at=application.applied_at,
        reviewed_at=application.reviewed_at,
        rejection_reason=application.rejection_reason,
    )


@router.get("/applications", response_model=list[ApplicationResponse])
async def get_my_applications(
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get my applications"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    query = (
        select(Application, Event, EventPosition, Organization)
        .join(Event, Event.id == Application.event_id)
        .join(EventPosition, EventPosition.id == Application.position_id)
        .join(Organization, Organization.id == Event.org_id)
        .where(Application.worker_id == worker.id)
    )
    if status:
        query = query.where(Application.status == status)

    result = await db.execute(query.order_by(Application.applied_at.desc()))
    applications = result.all()

    return [
        ApplicationResponse(
            id=a.Application.id,
            event_id=a.Event.id,
            event_title=a.Event.title,
            event_date=a.Event.event_date,
            position_id=a.EventPosition.id,
            position_title=a.EventPosition.title,
            org_name=a.Organization.name,
            status=a.Application.status,
            note=a.Application.note,
            applied_at=a.Application.applied_at,
            reviewed_at=a.Application.reviewed_at,
            rejection_reason=a.Application.rejection_reason,
        )
        for a in applications
    ]


@router.delete("/applications/{application_id}", response_model=MessageResponse)
async def cancel_application(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel application"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.worker_id == worker.id
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.status not in ["pending", "accepted"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this application")

    application.status = "cancelled"
    await db.commit()
    return MessageResponse(message="Application cancelled")


# ==================== Schedule & Attendance ====================

@router.get("/schedule", response_model=list[ScheduleResponse])
async def get_schedule(
    from_date: date | None = None,
    to_date: date | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get worker's schedule"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    query = (
        select(Application, Event, EventPosition, Organization, Attendance)
        .join(Event, Event.id == Application.event_id)
        .join(EventPosition, EventPosition.id == Application.position_id)
        .join(Organization, Organization.id == Event.org_id)
        .outerjoin(Attendance, Attendance.application_id == Application.id)
        .where(
            Application.worker_id == worker.id,
            Application.status == "accepted"
        )
    )

    if from_date:
        query = query.where(Event.event_date >= from_date)
    if to_date:
        query = query.where(Event.event_date <= to_date)

    result = await db.execute(query.order_by(Event.event_date, Event.start_time))
    schedules = result.all()

    return [
        ScheduleResponse(
            date=s.Event.event_date,
            event_id=s.Event.id,
            event_title=s.Event.title,
            org_name=s.Organization.name,
            position_title=s.EventPosition.title,
            start_time=s.Event.start_time,
            end_time=s.Event.end_time,
            status=s.Attendance.status if s.Attendance else "scheduled",
            hourly_rate=s.EventPosition.hourly_rate,
        )
        for s in schedules
    ]


@router.get("/payroll", response_model=list[PayrollResponse])
async def get_payroll_history(
    year_month: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get payroll history"""
    result = await db.execute(
        select(WorkerPublic).where(WorkerPublic.user_id == current_user.id)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    query = (
        select(PayrollRecord, Attendance, Event, Organization)
        .join(Attendance, Attendance.id == PayrollRecord.attendance_id)
        .join(Event, Event.id == PayrollRecord.event_id)
        .join(Organization, Organization.id == PayrollRecord.org_id)
        .where(PayrollRecord.worker_id == worker.id)
    )

    result = await db.execute(query.order_by(PayrollRecord.work_date.desc()))
    records = result.all()

    return [
        PayrollResponse(
            id=r.PayrollRecord.id,
            attendance_id=r.Attendance.id,
            event_title=r.Event.title,
            event_date=r.Event.event_date,
            org_name=r.Organization.name,
            work_date=r.PayrollRecord.work_date,
            worked_minutes=r.PayrollRecord.worked_minutes,
            hourly_rate=r.PayrollRecord.hourly_rate,
            base_pay=r.PayrollRecord.base_pay,
            total_pay=r.PayrollRecord.total_pay,
            payment_status=r.PayrollRecord.payment_status,
            worker_confirmed=r.PayrollRecord.worker_confirmed,
            worker_confirmed_at=r.PayrollRecord.worker_confirmed_at,
            paid_at=r.PayrollRecord.paid_at,
            created_at=r.PayrollRecord.created_at,
        )
        for r in records
    ]
