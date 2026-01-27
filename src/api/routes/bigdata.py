"""빅데이터 분석 API Routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from typing import List, Optional

from ..dependencies import get_db, require_auth, require_admin
from db import Database

router = APIRouter(prefix="/bigdata", tags=["bigdata"])


# ==================== 지역 마스터 ====================

@router.get("/regions")
async def get_regions(
    sido: Optional[str] = None,
    db: Database = Depends(get_db)
):
    """지역 목록 조회"""
    regions = db.get_regions(sido)

    # 시도별 그룹핑
    if not sido:
        grouped = {}
        for r in regions:
            if r['sido'] not in grouped:
                grouped[r['sido']] = []
            grouped[r['sido']].append(r)
        return {"regions": regions, "grouped": grouped}

    return {"regions": regions}


@router.post("/regions")
async def create_region(
    data: dict,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """지역 생성 (관리자)"""
    region_id = db.create_region(
        sido=data['sido'],
        sigungu=data['sigungu'],
        dong=data.get('dong'),
        lat=data.get('lat'),
        lng=data.get('lng')
    )
    return {"id": region_id, "message": "지역이 추가되었습니다"}


@router.put("/regions/{region_id}")
async def update_region(
    region_id: int,
    data: dict,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """지역 수정 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE regions SET sido = %s, sigungu = %s, dong = %s, lat = %s, lng = %s
            WHERE id = %s
        """, (data.get('sido'), data.get('sigungu'), data.get('dong'),
              data.get('lat'), data.get('lng'), region_id))
    return {"message": "지역이 수정되었습니다"}


@router.delete("/regions/{region_id}")
async def delete_region(
    region_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """지역 삭제 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM regions WHERE id = %s", (region_id,))
        conn.commit()
    return {"message": "지역이 삭제되었습니다"}


@router.delete("/regions")
async def delete_all_regions(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """전체 지역 삭제 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM regions")
        count = cursor.fetchone()[0]
        cursor.execute("DELETE FROM regions")
    return {"deleted": count, "message": f"{count}개 지역이 삭제되었습니다"}


# ==================== 업종 마스터 ====================

@router.get("/categories")
async def get_job_categories(
    parent_id: Optional[int] = None,
    db: Database = Depends(get_db)
):
    """업종 목록 조회"""
    categories = db.get_job_categories(parent_id)
    return {"categories": categories}


@router.post("/categories")
async def create_job_category(
    data: dict,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """업종 생성 (관리자)"""
    category_id = db.create_job_category(
        name=data['name'],
        parent_id=data.get('parent_id'),
        avg_pay=data.get('avg_pay'),
        description=data.get('description')
    )
    return {"id": category_id, "message": "업종이 추가되었습니다"}


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int,
    data: dict,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """업종 수정 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE job_categories SET name = %s, parent_id = %s, avg_pay = %s, description = %s
            WHERE id = %s
        """, (data.get('name'), data.get('parent_id'), data.get('avg_pay'),
              data.get('description'), category_id))
    return {"message": "업종이 수정되었습니다"}


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """업종 삭제 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM job_categories WHERE id = %s", (category_id,))
        conn.commit()
    return {"message": "업종이 삭제되었습니다"}


@router.delete("/categories")
async def delete_all_categories(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """전체 업종 삭제 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM job_categories")
        count = cursor.fetchone()[0]
        cursor.execute("DELETE FROM job_categories")
    return {"deleted": count, "message": f"{count}개 업종이 삭제되었습니다"}


# ==================== 기술/자격증 마스터 ====================

@router.get("/skills")
async def get_skills(
    category: Optional[str] = None,
    db: Database = Depends(get_db)
):
    """기술/자격증 목록 조회"""
    skills = db.get_skills(category)
    return {"skills": skills}


@router.post("/skills")
async def create_skill(
    data: dict,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """기술/자격증 생성 (관리자)"""
    skill_id = db.create_skill(
        name=data['name'],
        category=data.get('category'),
        description=data.get('description')
    )
    return {"id": skill_id, "message": "기술/자격증이 추가되었습니다"}


@router.put("/skills/{skill_id}")
async def update_skill(
    skill_id: int,
    data: dict,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """기술/자격증 수정 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE skills SET name = %s, category = %s, description = %s
            WHERE id = %s
        """, (data.get('name'), data.get('category'), data.get('description'), skill_id))
    return {"message": "기술/자격증이 수정되었습니다"}


@router.delete("/skills/{skill_id}")
async def delete_skill(
    skill_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """기술/자격증 삭제 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM skills WHERE id = %s", (skill_id,))
        conn.commit()
    return {"message": "기술/자격증이 삭제되었습니다"}


@router.delete("/skills")
async def delete_all_skills(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """전체 기술/자격증 삭제 (관리자)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM skills")
        count = cursor.fetchone()[0]
        cursor.execute("DELETE FROM skills")
    return {"deleted": count, "message": f"{count}개 기술/자격증이 삭제되었습니다"}


# ==================== 근무자 기술 ====================

@router.get("/workers/{worker_id}/skills")
async def get_worker_skills(
    worker_id: int,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """근무자 기술 목록"""
    skills = db.get_worker_skills(worker_id)
    return {"skills": skills}


@router.post("/workers/{worker_id}/skills")
async def add_worker_skill(
    worker_id: int,
    data: dict,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """근무자 기술 추가"""
    # 본인 또는 관리자만
    if user['id'] != worker_id and not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    success = db.add_worker_skill(
        worker_id=worker_id,
        skill_id=data['skill_id'],
        acquired_date=data.get('acquired_date')
    )
    if not success:
        raise HTTPException(status_code=400, detail="이미 등록된 기술입니다")
    return {"message": "기술이 추가되었습니다"}


# ==================== 평가/피드백 ====================

@router.post("/attendance/{attendance_id}/rating")
async def create_rating(
    attendance_id: int,
    data: dict,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """평가 생성"""
    # 출석 정보 확인
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM attendance WHERE id = %s",
            (attendance_id,)
        )
        attendance = cursor.fetchone()
        if not attendance:
            raise HTTPException(status_code=404, detail="출석 기록을 찾을 수 없습니다")

        attendance = dict(attendance)

    # 평가 유형 결정 (관리자 → MANAGER, 근무자 → WORKER)
    if user.get('is_admin'):
        rater_type = 'MANAGER'
    elif user['id'] == attendance['worker_id']:
        rater_type = 'WORKER'
    else:
        raise HTTPException(status_code=403, detail="평가 권한이 없습니다")

    rating = data.get('rating')
    if not rating or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="평점은 1-5 사이여야 합니다")

    rating_id = db.create_rating(
        attendance_id=attendance_id,
        rater_type=rater_type,
        rating=rating,
        feedback=data.get('feedback')
    )

    return {"id": rating_id, "message": "평가가 등록되었습니다"}


@router.get("/attendance/{attendance_id}/ratings")
async def get_attendance_ratings(
    attendance_id: int,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """출석별 평가 조회"""
    ratings = db.get_ratings_by_attendance(attendance_id)
    return {"ratings": ratings}


@router.get("/workers/{worker_id}/rating-stats")
async def get_worker_rating_stats(
    worker_id: int,
    db: Database = Depends(get_db)
):
    """근무자 평가 통계"""
    stats = db.get_worker_ratings(worker_id)
    return stats


# ==================== 이력 조회 ====================

@router.get("/workers/{worker_id}/history")
async def get_worker_history(
    worker_id: int,
    limit: int = Query(50, le=200),
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 변경 이력 (관리자)"""
    history = db.get_worker_history(worker_id, limit)
    return {"history": history}


@router.get("/applications/{application_id}/history")
async def get_application_status_history(
    application_id: int,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """지원 상태 변경 이력"""
    history = db.get_application_history(application_id)
    return {"history": history}


# ==================== 월별 통계 ====================

@router.get("/workers/{worker_id}/monthly-stats")
async def get_worker_monthly_stats(
    worker_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """근무자 월별 통계"""
    # 본인 또는 관리자만
    if user['id'] != worker_id and not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    stats = db.get_worker_monthly_stats(worker_id, year, month)
    return {"stats": stats}


@router.post("/workers/{worker_id}/calculate-stats")
async def calculate_worker_stats(
    worker_id: int,
    data: dict,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 월별 통계 계산 (관리자)"""
    year = data.get('year', datetime.now().year)
    month = data.get('month', datetime.now().month)

    stats = db.calculate_worker_monthly_stats(worker_id, year, month)
    return {"stats": stats, "message": "통계가 계산되었습니다"}


# ==================== 분석 요약 ====================

@router.get("/analytics/summary")
async def get_analytics_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """분석 요약 데이터 (관리자)"""
    summary = db.get_analytics_summary(year, month)
    return summary


@router.get("/analytics/worker/{worker_id}")
async def get_worker_analytics(
    worker_id: int,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """개인 근무자 분석"""
    # 본인 또는 관리자만
    if user['id'] != worker_id and not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    analytics = db.get_worker_analytics(worker_id)
    return analytics


# ==================== 배치 작업 ====================

@router.post("/batch/calculate-all-stats")
async def batch_calculate_all_stats(
    data: dict,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """전체 근무자 월별 통계 계산 (관리자)"""
    year = data.get('year', datetime.now().year)
    month = data.get('month', datetime.now().month)

    # 모든 근무자 조회
    workers = db.list_workers(limit=10000)
    calculated = 0

    for worker in workers:
        try:
            db.calculate_worker_monthly_stats(worker['id'], year, month)
            db.update_worker_cumulative_stats(worker['id'])
            calculated += 1
        except Exception as e:
            print(f"Error calculating stats for worker {worker['id']}: {e}")

    return {"calculated": calculated, "message": f"{calculated}명의 통계가 계산되었습니다"}


@router.post("/batch/update-cumulative")
async def batch_update_cumulative_stats(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """전체 근무자 누적 통계 업데이트 (관리자)"""
    workers = db.list_workers(limit=10000)
    updated = 0

    for worker in workers:
        try:
            db.update_worker_cumulative_stats(worker['id'])
            updated += 1
        except Exception as e:
            print(f"Error updating cumulative stats for worker {worker['id']}: {e}")

    return {"updated": updated, "message": f"{updated}명의 누적 통계가 업데이트되었습니다"}


# ==================== 초기 데이터 설정 ====================

@router.post("/init/regions")
async def init_regions(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """전국 시군구 초기 데이터 생성 (중복 체크)"""

    # 대한민국 전체 시군구 데이터
    regions_data = [
        # 서울특별시 (25개 구)
        {"sido": "서울", "sigungu": "강남구"},
        {"sido": "서울", "sigungu": "강동구"},
        {"sido": "서울", "sigungu": "강북구"},
        {"sido": "서울", "sigungu": "강서구"},
        {"sido": "서울", "sigungu": "관악구"},
        {"sido": "서울", "sigungu": "광진구"},
        {"sido": "서울", "sigungu": "구로구"},
        {"sido": "서울", "sigungu": "금천구"},
        {"sido": "서울", "sigungu": "노원구"},
        {"sido": "서울", "sigungu": "도봉구"},
        {"sido": "서울", "sigungu": "동대문구"},
        {"sido": "서울", "sigungu": "동작구"},
        {"sido": "서울", "sigungu": "마포구"},
        {"sido": "서울", "sigungu": "서대문구"},
        {"sido": "서울", "sigungu": "서초구"},
        {"sido": "서울", "sigungu": "성동구"},
        {"sido": "서울", "sigungu": "성북구"},
        {"sido": "서울", "sigungu": "송파구"},
        {"sido": "서울", "sigungu": "양천구"},
        {"sido": "서울", "sigungu": "영등포구"},
        {"sido": "서울", "sigungu": "용산구"},
        {"sido": "서울", "sigungu": "은평구"},
        {"sido": "서울", "sigungu": "종로구"},
        {"sido": "서울", "sigungu": "중구"},
        {"sido": "서울", "sigungu": "중랑구"},

        # 부산광역시 (16개 구/군)
        {"sido": "부산", "sigungu": "강서구"},
        {"sido": "부산", "sigungu": "금정구"},
        {"sido": "부산", "sigungu": "기장군"},
        {"sido": "부산", "sigungu": "남구"},
        {"sido": "부산", "sigungu": "동구"},
        {"sido": "부산", "sigungu": "동래구"},
        {"sido": "부산", "sigungu": "부산진구"},
        {"sido": "부산", "sigungu": "북구"},
        {"sido": "부산", "sigungu": "사상구"},
        {"sido": "부산", "sigungu": "사하구"},
        {"sido": "부산", "sigungu": "서구"},
        {"sido": "부산", "sigungu": "수영구"},
        {"sido": "부산", "sigungu": "연제구"},
        {"sido": "부산", "sigungu": "영도구"},
        {"sido": "부산", "sigungu": "중구"},
        {"sido": "부산", "sigungu": "해운대구"},

        # 대구광역시 (8개 구/군)
        {"sido": "대구", "sigungu": "남구"},
        {"sido": "대구", "sigungu": "달서구"},
        {"sido": "대구", "sigungu": "달성군"},
        {"sido": "대구", "sigungu": "동구"},
        {"sido": "대구", "sigungu": "북구"},
        {"sido": "대구", "sigungu": "서구"},
        {"sido": "대구", "sigungu": "수성구"},
        {"sido": "대구", "sigungu": "중구"},

        # 인천광역시 (10개 구/군)
        {"sido": "인천", "sigungu": "강화군"},
        {"sido": "인천", "sigungu": "계양구"},
        {"sido": "인천", "sigungu": "남동구"},
        {"sido": "인천", "sigungu": "동구"},
        {"sido": "인천", "sigungu": "미추홀구"},
        {"sido": "인천", "sigungu": "부평구"},
        {"sido": "인천", "sigungu": "서구"},
        {"sido": "인천", "sigungu": "연수구"},
        {"sido": "인천", "sigungu": "옹진군"},
        {"sido": "인천", "sigungu": "중구"},

        # 광주광역시 (5개 구)
        {"sido": "광주", "sigungu": "광산구"},
        {"sido": "광주", "sigungu": "남구"},
        {"sido": "광주", "sigungu": "동구"},
        {"sido": "광주", "sigungu": "북구"},
        {"sido": "광주", "sigungu": "서구"},

        # 대전광역시 (5개 구)
        {"sido": "대전", "sigungu": "대덕구"},
        {"sido": "대전", "sigungu": "동구"},
        {"sido": "대전", "sigungu": "서구"},
        {"sido": "대전", "sigungu": "유성구"},
        {"sido": "대전", "sigungu": "중구"},

        # 울산광역시 (5개 구/군)
        {"sido": "울산", "sigungu": "남구"},
        {"sido": "울산", "sigungu": "동구"},
        {"sido": "울산", "sigungu": "북구"},
        {"sido": "울산", "sigungu": "울주군"},
        {"sido": "울산", "sigungu": "중구"},

        # 세종특별자치시
        {"sido": "세종", "sigungu": "세종시"},

        # 경기도 (31개 시/군)
        {"sido": "경기", "sigungu": "가평군"},
        {"sido": "경기", "sigungu": "고양시"},
        {"sido": "경기", "sigungu": "과천시"},
        {"sido": "경기", "sigungu": "광명시"},
        {"sido": "경기", "sigungu": "광주시"},
        {"sido": "경기", "sigungu": "구리시"},
        {"sido": "경기", "sigungu": "군포시"},
        {"sido": "경기", "sigungu": "김포시"},
        {"sido": "경기", "sigungu": "남양주시"},
        {"sido": "경기", "sigungu": "동두천시"},
        {"sido": "경기", "sigungu": "부천시"},
        {"sido": "경기", "sigungu": "성남시"},
        {"sido": "경기", "sigungu": "수원시"},
        {"sido": "경기", "sigungu": "시흥시"},
        {"sido": "경기", "sigungu": "안산시"},
        {"sido": "경기", "sigungu": "안성시"},
        {"sido": "경기", "sigungu": "안양시"},
        {"sido": "경기", "sigungu": "양주시"},
        {"sido": "경기", "sigungu": "양평군"},
        {"sido": "경기", "sigungu": "여주시"},
        {"sido": "경기", "sigungu": "연천군"},
        {"sido": "경기", "sigungu": "오산시"},
        {"sido": "경기", "sigungu": "용인시"},
        {"sido": "경기", "sigungu": "의왕시"},
        {"sido": "경기", "sigungu": "의정부시"},
        {"sido": "경기", "sigungu": "이천시"},
        {"sido": "경기", "sigungu": "파주시"},
        {"sido": "경기", "sigungu": "평택시"},
        {"sido": "경기", "sigungu": "포천시"},
        {"sido": "경기", "sigungu": "하남시"},
        {"sido": "경기", "sigungu": "화성시"},

        # 강원특별자치도 (18개 시/군)
        {"sido": "강원", "sigungu": "강릉시"},
        {"sido": "강원", "sigungu": "고성군"},
        {"sido": "강원", "sigungu": "동해시"},
        {"sido": "강원", "sigungu": "삼척시"},
        {"sido": "강원", "sigungu": "속초시"},
        {"sido": "강원", "sigungu": "양구군"},
        {"sido": "강원", "sigungu": "양양군"},
        {"sido": "강원", "sigungu": "영월군"},
        {"sido": "강원", "sigungu": "원주시"},
        {"sido": "강원", "sigungu": "인제군"},
        {"sido": "강원", "sigungu": "정선군"},
        {"sido": "강원", "sigungu": "철원군"},
        {"sido": "강원", "sigungu": "춘천시"},
        {"sido": "강원", "sigungu": "태백시"},
        {"sido": "강원", "sigungu": "평창군"},
        {"sido": "강원", "sigungu": "홍천군"},
        {"sido": "강원", "sigungu": "화천군"},
        {"sido": "강원", "sigungu": "횡성군"},

        # 충청북도 (11개 시/군)
        {"sido": "충북", "sigungu": "괴산군"},
        {"sido": "충북", "sigungu": "단양군"},
        {"sido": "충북", "sigungu": "보은군"},
        {"sido": "충북", "sigungu": "영동군"},
        {"sido": "충북", "sigungu": "옥천군"},
        {"sido": "충북", "sigungu": "음성군"},
        {"sido": "충북", "sigungu": "제천시"},
        {"sido": "충북", "sigungu": "증평군"},
        {"sido": "충북", "sigungu": "진천군"},
        {"sido": "충북", "sigungu": "청주시"},
        {"sido": "충북", "sigungu": "충주시"},

        # 충청남도 (15개 시/군)
        {"sido": "충남", "sigungu": "계룡시"},
        {"sido": "충남", "sigungu": "공주시"},
        {"sido": "충남", "sigungu": "금산군"},
        {"sido": "충남", "sigungu": "논산시"},
        {"sido": "충남", "sigungu": "당진시"},
        {"sido": "충남", "sigungu": "보령시"},
        {"sido": "충남", "sigungu": "부여군"},
        {"sido": "충남", "sigungu": "서산시"},
        {"sido": "충남", "sigungu": "서천군"},
        {"sido": "충남", "sigungu": "아산시"},
        {"sido": "충남", "sigungu": "예산군"},
        {"sido": "충남", "sigungu": "천안시"},
        {"sido": "충남", "sigungu": "청양군"},
        {"sido": "충남", "sigungu": "태안군"},
        {"sido": "충남", "sigungu": "홍성군"},

        # 전북특별자치도 (14개 시/군)
        {"sido": "전북", "sigungu": "고창군"},
        {"sido": "전북", "sigungu": "군산시"},
        {"sido": "전북", "sigungu": "김제시"},
        {"sido": "전북", "sigungu": "남원시"},
        {"sido": "전북", "sigungu": "무주군"},
        {"sido": "전북", "sigungu": "부안군"},
        {"sido": "전북", "sigungu": "순창군"},
        {"sido": "전북", "sigungu": "완주군"},
        {"sido": "전북", "sigungu": "익산시"},
        {"sido": "전북", "sigungu": "임실군"},
        {"sido": "전북", "sigungu": "장수군"},
        {"sido": "전북", "sigungu": "전주시"},
        {"sido": "전북", "sigungu": "정읍시"},
        {"sido": "전북", "sigungu": "진안군"},

        # 전라남도 (22개 시/군)
        {"sido": "전남", "sigungu": "강진군"},
        {"sido": "전남", "sigungu": "고흥군"},
        {"sido": "전남", "sigungu": "곡성군"},
        {"sido": "전남", "sigungu": "광양시"},
        {"sido": "전남", "sigungu": "구례군"},
        {"sido": "전남", "sigungu": "나주시"},
        {"sido": "전남", "sigungu": "담양군"},
        {"sido": "전남", "sigungu": "목포시"},
        {"sido": "전남", "sigungu": "무안군"},
        {"sido": "전남", "sigungu": "보성군"},
        {"sido": "전남", "sigungu": "순천시"},
        {"sido": "전남", "sigungu": "신안군"},
        {"sido": "전남", "sigungu": "여수시"},
        {"sido": "전남", "sigungu": "영광군"},
        {"sido": "전남", "sigungu": "영암군"},
        {"sido": "전남", "sigungu": "완도군"},
        {"sido": "전남", "sigungu": "장성군"},
        {"sido": "전남", "sigungu": "장흥군"},
        {"sido": "전남", "sigungu": "진도군"},
        {"sido": "전남", "sigungu": "함평군"},
        {"sido": "전남", "sigungu": "해남군"},
        {"sido": "전남", "sigungu": "화순군"},

        # 경상북도 (23개 시/군)
        {"sido": "경북", "sigungu": "경산시"},
        {"sido": "경북", "sigungu": "경주시"},
        {"sido": "경북", "sigungu": "고령군"},
        {"sido": "경북", "sigungu": "구미시"},
        {"sido": "경북", "sigungu": "군위군"},
        {"sido": "경북", "sigungu": "김천시"},
        {"sido": "경북", "sigungu": "문경시"},
        {"sido": "경북", "sigungu": "봉화군"},
        {"sido": "경북", "sigungu": "상주시"},
        {"sido": "경북", "sigungu": "성주군"},
        {"sido": "경북", "sigungu": "안동시"},
        {"sido": "경북", "sigungu": "영덕군"},
        {"sido": "경북", "sigungu": "영양군"},
        {"sido": "경북", "sigungu": "영주시"},
        {"sido": "경북", "sigungu": "영천시"},
        {"sido": "경북", "sigungu": "예천군"},
        {"sido": "경북", "sigungu": "울릉군"},
        {"sido": "경북", "sigungu": "울진군"},
        {"sido": "경북", "sigungu": "의성군"},
        {"sido": "경북", "sigungu": "청도군"},
        {"sido": "경북", "sigungu": "청송군"},
        {"sido": "경북", "sigungu": "칠곡군"},
        {"sido": "경북", "sigungu": "포항시"},

        # 경상남도 (18개 시/군)
        {"sido": "경남", "sigungu": "거제시"},
        {"sido": "경남", "sigungu": "거창군"},
        {"sido": "경남", "sigungu": "고성군"},
        {"sido": "경남", "sigungu": "김해시"},
        {"sido": "경남", "sigungu": "남해군"},
        {"sido": "경남", "sigungu": "밀양시"},
        {"sido": "경남", "sigungu": "사천시"},
        {"sido": "경남", "sigungu": "산청군"},
        {"sido": "경남", "sigungu": "양산시"},
        {"sido": "경남", "sigungu": "의령군"},
        {"sido": "경남", "sigungu": "진주시"},
        {"sido": "경남", "sigungu": "창녕군"},
        {"sido": "경남", "sigungu": "창원시"},
        {"sido": "경남", "sigungu": "통영시"},
        {"sido": "경남", "sigungu": "하동군"},
        {"sido": "경남", "sigungu": "함안군"},
        {"sido": "경남", "sigungu": "함양군"},
        {"sido": "경남", "sigungu": "합천군"},

        # 제주특별자치도 (2개 시)
        {"sido": "제주", "sigungu": "서귀포시"},
        {"sido": "제주", "sigungu": "제주시"},
    ]

    # 기존 데이터 확인 후 중복 제외하고 추가
    existing = db.get_regions()
    existing_set = {(r['sido'], r['sigungu']) for r in existing}

    created = 0
    for r in regions_data:
        if (r['sido'], r['sigungu']) not in existing_set:
            try:
                db.create_region(sido=r['sido'], sigungu=r['sigungu'])
                created += 1
            except Exception:
                pass

    return {
        "created": created,
        "total": len(regions_data),
        "message": f"전국 {len(regions_data)}개 시군구 중 {created}개가 새로 추가되었습니다"
    }


@router.post("/init/categories")
async def init_categories(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """업종 초기 데이터 생성"""
    categories_data = [
        {"name": "전시/박람회", "avg_pay": 130000},
        {"name": "콘서트/공연", "avg_pay": 120000},
        {"name": "스포츠 이벤트", "avg_pay": 110000},
        {"name": "기업 행사", "avg_pay": 140000},
        {"name": "웨딩/연회", "avg_pay": 100000},
        {"name": "판촉/샘플링", "avg_pay": 90000},
        {"name": "MC/사회", "avg_pay": 200000},
        {"name": "안내/리셉션", "avg_pay": 100000},
        {"name": "포장/물류", "avg_pay": 100000},
        {"name": "청소/정리", "avg_pay": 90000},
        {"name": "주차 안내", "avg_pay": 100000},
        {"name": "경비/보안", "avg_pay": 120000},
        {"name": "촬영 보조", "avg_pay": 110000},
        {"name": "케이터링", "avg_pay": 100000},
        {"name": "기타", "avg_pay": 100000},
    ]

    created = 0
    for c in categories_data:
        try:
            db.create_job_category(name=c['name'], avg_pay=c.get('avg_pay'))
            created += 1
        except Exception:
            pass

    return {"created": created, "message": f"{created}개 업종이 추가되었습니다"}


@router.post("/init/skills")
async def init_skills(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """기술/자격증 초기 데이터 생성"""
    skills_data = [
        {"name": "운전면허 1종", "category": "자격증"},
        {"name": "운전면허 2종", "category": "자격증"},
        {"name": "경비지도사", "category": "자격증"},
        {"name": "일반경비원", "category": "자격증"},
        {"name": "특수경비원", "category": "자격증"},
        {"name": "지게차", "category": "자격증"},
        {"name": "위생사", "category": "자격증"},
        {"name": "바리스타", "category": "자격증"},
        {"name": "조리사", "category": "자격증"},
        {"name": "영어 회화", "category": "어학"},
        {"name": "일본어 회화", "category": "어학"},
        {"name": "중국어 회화", "category": "어학"},
        {"name": "전시 경험", "category": "경험"},
        {"name": "콘서트 경험", "category": "경험"},
        {"name": "스포츠 이벤트 경험", "category": "경험"},
        {"name": "MC 경험", "category": "경험"},
        {"name": "리더 경험", "category": "경험"},
    ]

    created = 0
    for s in skills_data:
        try:
            db.create_skill(name=s['name'], category=s.get('category'))
            created += 1
        except Exception:
            pass

    return {"created": created, "message": f"{created}개 기술/자격증이 추가되었습니다"}
