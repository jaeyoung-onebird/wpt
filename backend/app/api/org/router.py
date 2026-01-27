from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, generate_invite_code
from app.models import (
    User, Organization, OrgMember, Invite,
    OrgWorkerFollow, WorkerOrgFollow, OrgWorkerBlock, WorkerOrgBlock,
    Event, EventPosition, Application, WorkerPublic,
)
from app.schemas.organization import (
    OrgCreate, OrgUpdate, OrgResponse, OrgListResponse,
    MemberInvite, MemberUpdate, MemberResponse,
    InviteResponse, FollowWorkerRequest, FollowerResponse,
    BlockWorkerRequest, BlockedWorkerResponse,
)
from app.schemas.event import (
    EventCreate, EventUpdate, EventResponse, EventListResponse,
    EventPositionResponse, ApplicationForOrgResponse, ApplicationReview,
)
from app.schemas.common import PaginatedResponse, MessageResponse

router = APIRouter()


# ==================== Organization CRUD ====================

@router.post("/register", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
async def register_organization(
    request: OrgCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new organization"""
    # Check if business number already exists
    result = await db.execute(
        select(Organization).where(Organization.business_number == request.business_number)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Business number already registered")

    org = Organization(
        name=request.name,
        business_number=request.business_number,
        representative_name=request.representative_name,
        business_type=request.business_type,
        address=request.address,
        contact_phone=request.contact_phone,
        contact_email=request.contact_email,
    )
    db.add(org)
    await db.flush()

    # Add current user as owner
    member = OrgMember(
        org_id=org.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(member)
    await db.commit()
    await db.refresh(org)

    return org


@router.get("/my", response_model=list[OrgListResponse])
async def get_my_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get organizations where current user is a member"""
    result = await db.execute(
        select(Organization)
        .join(OrgMember, OrgMember.org_id == Organization.id)
        .where(OrgMember.user_id == current_user.id)
    )
    orgs = result.scalars().all()
    return orgs


@router.get("/{org_id}", response_model=OrgResponse)
async def get_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get organization details"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/{org_id}", response_model=OrgResponse)
async def update_organization(
    org_id: UUID,
    request: OrgUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update organization (admin/owner only)"""
    # Check membership
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id,
            OrgMember.role.in_(["owner", "admin"])
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)
    return org


# ==================== Member Management ====================

@router.get("/{org_id}/members", response_model=list[MemberResponse])
async def get_org_members(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get organization members"""
    # Check if user is member
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    result = await db.execute(
        select(OrgMember, User)
        .join(User, User.id == OrgMember.user_id)
        .where(OrgMember.org_id == org_id)
    )
    members = result.all()

    return [
        MemberResponse(
            id=m.OrgMember.id,
            user_id=m.OrgMember.user_id,
            org_id=m.OrgMember.org_id,
            role=m.OrgMember.role,
            user_name=m.User.name,
            user_phone=m.User.phone,
            joined_at=m.OrgMember.joined_at,
        )
        for m in members
    ]


@router.post("/{org_id}/invite", response_model=InviteResponse)
async def create_invite_link(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create worker invite link"""
    # Check admin/owner
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id,
            OrgMember.role.in_(["owner", "admin", "manager"])
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    code = generate_invite_code()
    expires_at = datetime.utcnow() + timedelta(days=7)

    invite = Invite(
        org_id=org_id,
        code=code,
        created_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()

    return InviteResponse(
        invite_code=code,
        invite_url=f"/signup?invite={code}",
        expires_at=expires_at,
    )


# ==================== Worker Follow/Block ====================

@router.get("/{org_id}/followers", response_model=PaginatedResponse[FollowerResponse])
async def get_followers(
    org_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get workers following this organization"""
    # Check membership
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(OrgWorkerFollow).where(OrgWorkerFollow.org_id == org_id)
    )
    total = count_result.scalar()

    # Get followers with worker info
    result = await db.execute(
        select(OrgWorkerFollow, WorkerPublic)
        .join(WorkerPublic, WorkerPublic.id == OrgWorkerFollow.worker_id)
        .where(OrgWorkerFollow.org_id == org_id)
        .offset((page - 1) * size)
        .limit(size)
    )
    follows = result.all()

    # Check mutual follows
    worker_ids = [f.OrgWorkerFollow.worker_id for f in follows]
    result = await db.execute(
        select(WorkerOrgFollow.worker_id)
        .where(
            WorkerOrgFollow.org_id == org_id,
            WorkerOrgFollow.worker_id.in_(worker_ids)
        )
    )
    mutual_ids = set(r[0] for r in result.all())

    items = [
        FollowerResponse(
            id=f.OrgWorkerFollow.id,
            worker_id=f.WorkerPublic.id,
            nickname=f.WorkerPublic.nickname,
            profile_image_url=f.WorkerPublic.profile_image_url,
            trust_score=f.WorkerPublic.trust_score,
            total_jobs=f.WorkerPublic.total_jobs,
            is_mutual=f.WorkerPublic.id in mutual_ids,
            note=f.OrgWorkerFollow.note,
            followed_at=f.OrgWorkerFollow.created_at,
        )
        for f in follows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.post("/{org_id}/follow", response_model=MessageResponse)
async def follow_worker(
    org_id: UUID,
    request: FollowWorkerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Follow a worker"""
    # Check membership
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    # Check if worker is blocked
    result = await db.execute(
        select(OrgWorkerBlock).where(
            OrgWorkerBlock.org_id == org_id,
            OrgWorkerBlock.worker_id == request.worker_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cannot follow blocked worker")

    # Check if already following
    result = await db.execute(
        select(OrgWorkerFollow).where(
            OrgWorkerFollow.org_id == org_id,
            OrgWorkerFollow.worker_id == request.worker_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already following")

    follow = OrgWorkerFollow(
        org_id=org_id,
        worker_id=request.worker_id,
        note=request.note,
    )
    db.add(follow)

    # Update org follower count
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one()
    org.follower_count += 1

    await db.commit()
    return MessageResponse(message="Followed successfully")


@router.delete("/{org_id}/follow/{worker_id}", response_model=MessageResponse)
async def unfollow_worker(
    org_id: UUID,
    worker_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unfollow a worker"""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    result = await db.execute(
        select(OrgWorkerFollow).where(
            OrgWorkerFollow.org_id == org_id,
            OrgWorkerFollow.worker_id == worker_id
        )
    )
    follow = result.scalar_one_or_none()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following")

    await db.delete(follow)

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one()
    org.follower_count = max(0, org.follower_count - 1)

    await db.commit()
    return MessageResponse(message="Unfollowed successfully")


@router.post("/{org_id}/block", response_model=MessageResponse)
async def block_worker(
    org_id: UUID,
    request: BlockWorkerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block a worker"""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id,
            OrgMember.role.in_(["owner", "admin"])
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    # Remove follow if exists
    result = await db.execute(
        select(OrgWorkerFollow).where(
            OrgWorkerFollow.org_id == org_id,
            OrgWorkerFollow.worker_id == request.worker_id
        )
    )
    follow = result.scalar_one_or_none()
    if follow:
        await db.delete(follow)

    block = OrgWorkerBlock(
        org_id=org_id,
        worker_id=request.worker_id,
        reason=request.reason,
    )
    db.add(block)
    await db.commit()

    return MessageResponse(message="Worker blocked")


@router.get("/{org_id}/blocked", response_model=list[BlockedWorkerResponse])
async def get_blocked_workers(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get blocked workers list"""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    result = await db.execute(
        select(OrgWorkerBlock, WorkerPublic)
        .join(WorkerPublic, WorkerPublic.id == OrgWorkerBlock.worker_id)
        .where(OrgWorkerBlock.org_id == org_id)
    )
    blocks = result.all()

    return [
        BlockedWorkerResponse(
            id=b.OrgWorkerBlock.id,
            worker_id=b.WorkerPublic.id,
            nickname=b.WorkerPublic.nickname,
            reason=b.OrgWorkerBlock.reason,
            blocked_at=b.OrgWorkerBlock.created_at,
        )
        for b in blocks
    ]


# ==================== Event Management ====================

@router.post("/{org_id}/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    org_id: UUID,
    request: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new event"""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    event = Event(
        org_id=org_id,
        title=request.title,
        description=request.description,
        event_date=request.event_date,
        start_time=request.start_time,
        end_time=request.end_time,
        location_name=request.location_name,
        location_address=request.location_address,
        location_lat=request.location_lat,
        location_lng=request.location_lng,
        dress_code=request.dress_code,
        notes=request.notes,
    )
    db.add(event)
    await db.flush()

    total_positions = 0
    for pos_data in request.positions:
        position = EventPosition(
            event_id=event.id,
            title=pos_data.title,
            work_type=pos_data.work_type,
            headcount=pos_data.headcount,
            hourly_rate=pos_data.hourly_rate,
            description=pos_data.description,
            requirements=pos_data.requirements,
        )
        db.add(position)
        total_positions += pos_data.headcount

    event.total_positions = total_positions
    await db.commit()
    await db.refresh(event)

    # Load positions
    result = await db.execute(
        select(EventPosition).where(EventPosition.event_id == event.id)
    )
    positions = result.scalars().all()

    return EventResponse(
        id=event.id,
        org_id=event.org_id,
        org_name=org.name,
        title=event.title,
        description=event.description,
        event_date=event.event_date,
        start_time=event.start_time,
        end_time=event.end_time,
        location_name=event.location_name,
        location_address=event.location_address,
        location_lat=event.location_lat,
        location_lng=event.location_lng,
        dress_code=event.dress_code,
        notes=event.notes,
        status=event.status,
        total_positions=event.total_positions,
        filled_positions=event.filled_positions,
        positions=[EventPositionResponse.model_validate(p) for p in positions],
        created_at=event.created_at,
    )


@router.get("/{org_id}/events", response_model=PaginatedResponse[EventListResponse])
async def get_org_events(
    org_id: UUID,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get organization's events"""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one()

    query = select(Event).where(Event.org_id == org_id)
    if status:
        query = query.where(Event.status == status)

    count_result = await db.execute(
        select(func.count()).select_from(Event).where(Event.org_id == org_id)
    )
    total = count_result.scalar()

    result = await db.execute(
        query.order_by(Event.event_date.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    events = result.scalars().all()

    # Get min/max hourly rates for each event
    items = []
    for event in events:
        result = await db.execute(
            select(
                func.min(EventPosition.hourly_rate),
                func.max(EventPosition.hourly_rate)
            ).where(EventPosition.event_id == event.id)
        )
        rates = result.one()

        items.append(EventListResponse(
            id=event.id,
            org_id=event.org_id,
            org_name=org.name,
            org_logo_url=org.logo_url,
            title=event.title,
            event_date=event.event_date,
            start_time=event.start_time,
            end_time=event.end_time,
            location_name=event.location_name,
            status=event.status,
            total_positions=event.total_positions,
            filled_positions=event.filled_positions,
            min_hourly_rate=rates[0] or 0,
            max_hourly_rate=rates[1] or 0,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/{org_id}/events/{event_id}/applications", response_model=list[ApplicationForOrgResponse])
async def get_event_applications(
    org_id: UUID,
    event_id: UUID,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get applications for an event"""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    query = (
        select(Application, WorkerPublic, EventPosition)
        .join(WorkerPublic, WorkerPublic.id == Application.worker_id)
        .join(EventPosition, EventPosition.id == Application.position_id)
        .where(Application.event_id == event_id)
    )
    if status:
        query = query.where(Application.status == status)

    result = await db.execute(query.order_by(Application.applied_at.desc()))
    applications = result.all()

    # Check following status
    worker_ids = [a.Application.worker_id for a in applications]
    result = await db.execute(
        select(OrgWorkerFollow.worker_id)
        .where(
            OrgWorkerFollow.org_id == org_id,
            OrgWorkerFollow.worker_id.in_(worker_ids)
        )
    )
    following_ids = set(r[0] for r in result.all())

    return [
        ApplicationForOrgResponse(
            id=a.Application.id,
            worker_id=a.WorkerPublic.id,
            worker_nickname=a.WorkerPublic.nickname,
            worker_profile_image=a.WorkerPublic.profile_image_url,
            worker_trust_score=a.WorkerPublic.trust_score,
            worker_total_jobs=a.WorkerPublic.total_jobs,
            position_id=a.EventPosition.id,
            position_title=a.EventPosition.title,
            status=a.Application.status,
            note=a.Application.note,
            applied_at=a.Application.applied_at,
            is_following=a.WorkerPublic.id in following_ids,
        )
        for a in applications
    ]


@router.patch("/{org_id}/applications/{application_id}", response_model=MessageResponse)
async def review_application(
    org_id: UUID,
    application_id: UUID,
    request: ApplicationReview,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept or reject an application"""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    result = await db.execute(
        select(Application)
        .join(Event, Event.id == Application.event_id)
        .where(
            Application.id == application_id,
            Event.org_id == org_id
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.status != "pending":
        raise HTTPException(status_code=400, detail="Application already reviewed")

    application.status = request.status
    application.reviewed_at = datetime.utcnow()
    application.rejection_reason = request.rejection_reason

    if request.status == "accepted":
        # Update position filled count
        result = await db.execute(
            select(EventPosition).where(EventPosition.id == application.position_id)
        )
        position = result.scalar_one()
        position.filled_count += 1

        # Update event filled count
        result = await db.execute(
            select(Event).where(Event.id == application.event_id)
        )
        event = result.scalar_one()
        event.filled_positions += 1

    await db.commit()
    return MessageResponse(message=f"Application {request.status}")
