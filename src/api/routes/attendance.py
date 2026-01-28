"""Attendance Routes"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
from datetime import datetime
import logging

from ..dependencies import get_db, require_auth, require_admin, require_worker
from ..schemas.attendance import (
    CheckInRequest, AttendanceResponse, AttendanceListResponse, ChainLogResponse
)
from db import Database
from wpt_service import wpt_service
from utils import now_kst

router = APIRouter()
logger = logging.getLogger(__name__)

# 근무 완료 보상 (WPT)
WORK_COMPLETION_REWARD = 2


def _reward_work_completion(worker_id: int, db: Database):
    """근무 완료 시 WPT 보상 지급"""
    from psycopg2.extras import RealDictCursor
    # 근무자 정보 조회
    with db.get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
        row = cursor.fetchone()
        if not row:
            return
        worker = dict(row)

    wallet_address = worker.get("wallet_address")

    # 지갑 주소가 없으면 생성
    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker_id)
        db.set_worker_wallet_address(worker_id, wallet_address)

    tx_hash = None
    reason = "근무 완료 보상"

    if wpt_service.enabled:
        # WPT 토큰 발행
        result = wpt_service.mint_credits(
            wallet_address,
            WORK_COMPLETION_REWARD,
            reason
        )
        if result["success"]:
            tx_hash = result.get("tx_hash")
            logger.info(f"Work completion reward: {WORK_COMPLETION_REWARD} WPT to worker {worker_id}")
        else:
            logger.error(f"Failed to mint work completion reward: {result.get('error')}")
            return

    # DB 토큰 추가
    db.add_tokens(worker_id, WORK_COMPLETION_REWARD)

    # 새 잔액 조회
    if wpt_service.enabled:
        new_balance = wpt_service.get_balance(wallet_address)
    else:
        new_balance = db.get_worker_tokens(worker_id)

    # 거래 내역 저장
    db.create_credit_history(
        worker_id=worker_id,
        amount=WORK_COMPLETION_REWARD,
        balance_after=new_balance,
        tx_type="WORK_REWARD",
        reason=reason,
        tx_hash=tx_hash
    )


def _enrich_attendance(att: dict, db: Database) -> dict:
    """출석에 행사, 근무자, 블록체인 정보 추가"""
    # 행사 정보
    event = db.get_event(att.get("event_id"))
    if event:
        att["event_title"] = event.get("title")
        att["event_date"] = event.get("event_date")
        att["pay_amount"] = event.get("pay_amount")

    # 근무자 정보
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT name FROM workers WHERE id = %s", (att.get("worker_id"),))
        worker = cursor.fetchone()
        if worker:
            att["worker_name"] = worker["name"]

        # 블록체인 정보
        cursor.execute(
            "SELECT tx_hash, block_number, log_hash FROM chain_logs WHERE attendance_id = %s",
            (att.get("id"),)
        )
        chain_log = cursor.fetchone()
        if chain_log:
            att["tx_hash"] = chain_log["tx_hash"]
            att["block_number"] = chain_log["block_number"]
            att["log_hash"] = chain_log["log_hash"]

    return att


@router.post("/check-in", response_model=AttendanceResponse)
async def check_in(
    data: CheckInRequest,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """출근 처리"""
    worker = auth["worker"]

    # 출석 코드로 조회
    attendance = db.get_attendance_by_code(data.check_in_code)
    if not attendance:
        raise HTTPException(status_code=404, detail="유효하지 않은 출근 코드입니다")

    # 본인 확인
    if attendance["worker_id"] != worker["id"]:
        raise HTTPException(status_code=403, detail="본인의 출근 코드가 아닙니다")

    # 이미 출근한 경우
    if attendance.get("check_in_time"):
        raise HTTPException(status_code=400, detail="이미 출근 처리되었습니다")

    # 출근 처리
    db.check_in(attendance["id"])

    updated = db.get_attendance_by_code(data.check_in_code)
    return AttendanceResponse(**_enrich_attendance(updated, db))


@router.post("/{attendance_id}/check-out", response_model=AttendanceResponse)
async def check_out(
    attendance_id: int,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """퇴근 처리"""
    # 출석 조회
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM attendance WHERE id = %s", (attendance_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="출석 정보를 찾을 수 없습니다")
        attendance = dict(row)

    # 본인 또는 관리자 확인
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)
    is_admin = db.is_admin(telegram_id)

    if not is_admin and (not worker or worker["id"] != attendance["worker_id"]):
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    # 출근 안 한 경우
    if not attendance.get("check_in_time"):
        raise HTTPException(status_code=400, detail="먼저 출근 처리가 필요합니다")

    # 이미 퇴근한 경우
    if attendance.get("check_out_time"):
        raise HTTPException(status_code=400, detail="이미 퇴근 처리되었습니다")

    # 퇴근 처리
    db.check_out(attendance_id, completed_by=telegram_id)

    # 업데이트된 출석 정보 재조회 (worked_minutes 포함)
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM attendance WHERE id = %s", (attendance_id,))
        updated = dict(cursor.fetchone())

    # 블록체인 기록 - 텔레그램 봇과 동일하게 처리
    try:
        from chain import polygon_chain
        from utils import generate_worker_uid_hash
        import hashlib
        import json
        import os

        # 근무 로그 해시 생성
        log_data = {
            'event_id': updated['event_id'],
            'worker_id': updated['worker_id'],
            'check_in_time': str(updated['check_in_time']),
            'check_out_time': str(updated['check_out_time']),
            'worked_minutes': updated['worked_minutes']
        }
        log_hash = hashlib.sha256(json.dumps(log_data, sort_keys=True).encode()).hexdigest()

        worker_uid_hash = generate_worker_uid_hash(
            worker_id=updated['worker_id'],
            salt=os.getenv('SALT_SECRET', 'default_salt')
        )

        # 블록체인에 기록
        result = polygon_chain.record_work_log(
            log_hash=log_hash,
            event_id=updated['event_id'],
            worker_uid_hash=worker_uid_hash
        )

        if result['success']:
            # DB에 TX 정보 저장
            chain_log_id = db.create_chain_log(
                attendance_id=updated['id'],
                event_id=updated['event_id'],
                worker_uid_hash=worker_uid_hash,
                log_hash=log_hash
            )
            db.update_chain_log_tx(
                chain_log_id=chain_log_id,
                tx_hash=result['tx_hash'],
                block_number=result['block_number']
            )
    except Exception as e:
        # 블록체인 기록 실패해도 퇴근 처리는 완료
        logger.error(f"Blockchain recording failed: {e}")

    # WPT 근무 완료 보상 지급
    try:
        _reward_work_completion(updated["worker_id"], db)
    except Exception as e:
        logger.error(f"WPT reward failed: {e}")

    return AttendanceResponse(**_enrich_attendance(updated, db))


@router.get("/me", response_model=AttendanceListResponse)
async def get_my_attendance(
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """내 출석 이력"""
    worker = auth["worker"]

    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT * FROM attendance WHERE worker_id = %s ORDER BY created_at DESC",
            (worker["id"],)
        )
        rows = cursor.fetchall()
        attendance_list = [dict(row) for row in rows]

    return AttendanceListResponse(
        total=len(attendance_list),
        attendance=[AttendanceResponse(**_enrich_attendance(a, db)) for a in attendance_list]
    )


@router.get("/{attendance_id}", response_model=AttendanceResponse)
async def get_attendance(
    attendance_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """출석 상세 (관리자 전용)"""
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM attendance WHERE id = %s", (attendance_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="출석 정보를 찾을 수 없습니다")
        attendance = dict(row)

    return AttendanceResponse(**_enrich_attendance(attendance, db))


@router.get("/{attendance_id}/payment-statement")
async def download_payment_statement(
    attendance_id: int,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """지급명세서 PDF 다운로드"""
    worker = auth["worker"]

    # 출석 정보 조회
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """SELECT a.*, e.title as event_title, e.event_date, e.pay_amount
               FROM attendance a
               JOIN events e ON a.event_id = e.id
               WHERE a.id = %s""",
            (attendance_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="출석 정보를 찾을 수 없습니다")
        attendance = dict(row)

    # 본인 확인
    if attendance["worker_id"] != worker["id"]:
        raise HTTPException(status_code=403, detail="본인의 출석 정보만 다운로드할 수 있습니다")

    # 퇴근 완료 확인
    if not attendance.get("check_out_time"):
        raise HTTPException(status_code=400, detail="퇴근 완료된 기록만 다운로드할 수 있습니다")

    # PDF 생성
    try:
        pdf_bytes = generate_payment_statement_pdf(worker, attendance)
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=payment_statement_{attendance_id}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지급명세서 생성 실패: {str(e)}")


def generate_payment_statement_pdf(worker: dict, attendance: dict) -> bytes:
    """프리랜서 지급명세서 PDF 생성 - 네이비/블루 테마, 한 페이지"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.colors import HexColor
    import os

    # 색상 정의 (네이비/블루 테마)
    NAVY = "#191F28"
    BLUE = "#3182F6"
    LIGHT_BLUE = "#E8F3FF"
    GRAY = "#6B7280"
    DARK_GRAY = "#374151"
    TEXT = "#111827"
    BORDER = "#E5E7EB"
    GREEN = "#059669"
    RED = "#DC2626"

    # 회사 정보 (고정값)
    company_info = {
        "name": "(주)엘케이프라이빗",
        "business_number": "635-86-01148",
        "ceo_name": "김재영",
    }

    # 급여 계산 (프리랜서 3.3% 공제)
    gross_pay = attendance.get("pay_amount", 0) or 0
    income_tax = int(gross_pay * 0.03)  # 소득세 3%
    local_tax = int(gross_pay * 0.003)  # 지방소득세 0.3%
    total_deduction = income_tax + local_tax
    net_pay = gross_pay - total_deduction

    # 폰트 등록 (나눔고딕 사용)
    font_path = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
    bold_font_path = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"

    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont("NanumGothic", font_path))
        if os.path.exists(bold_font_path):
            pdfmetrics.registerFont(TTFont("NanumGothicBold", bold_font_path))
        else:
            pdfmetrics.registerFont(TTFont("NanumGothicBold", font_path))
        font_name = "NanumGothic"
        bold_font = "NanumGothicBold"
    else:
        font_name = "Helvetica"
        bold_font = "Helvetica-Bold"

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # 배경
    c.setFillColor(HexColor("#FFFFFF"))
    c.rect(0, 0, width, height, fill=1)

    # 테두리 (네이비)
    c.setStrokeColor(HexColor(NAVY))
    c.setLineWidth(2)
    c.rect(15*mm, 15*mm, width-30*mm, height-30*mm)

    # 헤더 (네이비)
    c.setFillColor(HexColor(NAVY))
    c.setFont(bold_font, 22)
    c.drawCentredString(width/2, height - 40*mm, "프리랜서 지급명세서")

    c.setFont(font_name, 9)
    c.setFillColor(HexColor(GRAY))
    c.drawCentredString(width/2, height - 48*mm, "Freelancer Payment Statement")

    # 구분선
    c.setStrokeColor(HexColor(BORDER))
    c.setLineWidth(1)
    c.line(25*mm, height - 55*mm, width - 25*mm, height - 55*mm)

    # 내용 시작 (간격 축소)
    y = height - 65*mm
    line_height = 8*mm
    section_gap = 3*mm

    # 근무자 정보 섹션
    c.setFillColor(HexColor(DARK_GRAY))
    c.setFont(bold_font, 11)
    c.drawString(30*mm, y, "근무자 정보")
    y -= line_height

    # 생년월일 포맷
    birth_date = worker.get("birth_date", "-") or "-"
    if birth_date and birth_date != "-":
        birth_date = birth_date.replace("-", "")[-6:]

    items = [
        ("이름", worker.get("name", "-")),
        ("생년월일", birth_date),
        ("연락처", worker.get("phone", "-")),
    ]

    for label, value in items:
        c.setFont(bold_font, 9)
        c.setFillColor(HexColor(GRAY))
        c.drawString(35*mm, y, label)
        c.setFont(font_name, 10)
        c.setFillColor(HexColor(TEXT))
        c.drawString(65*mm, y, str(value))
        y -= 6*mm

    y -= section_gap

    # 회사 정보 섹션
    c.setFillColor(HexColor(DARK_GRAY))
    c.setFont(bold_font, 11)
    c.drawString(30*mm, y, "회사 정보")
    y -= line_height

    items = [
        ("회사명", company_info["name"]),
        ("사업자등록번호", company_info["business_number"]),
        ("대표자명", company_info["ceo_name"]),
    ]

    for label, value in items:
        c.setFont(bold_font, 9)
        c.setFillColor(HexColor(GRAY))
        c.drawString(35*mm, y, label)
        c.setFont(font_name, 10)
        c.setFillColor(HexColor(TEXT))
        c.drawString(65*mm, y, str(value))
        y -= 6*mm

    y -= section_gap

    # 지급 정보 섹션
    c.setStrokeColor(HexColor(BORDER))
    c.line(25*mm, y + 2*mm, width - 25*mm, y + 2*mm)
    y -= section_gap

    c.setFillColor(HexColor(DARK_GRAY))
    c.setFont(bold_font, 11)
    c.drawString(30*mm, y, "지급 정보")
    y -= line_height

    items = [
        ("지급일", "차주 수요일"),
        ("용역 제공 기간", f"{attendance.get('event_date', '-')} {attendance.get('event_title', '')}"),
    ]

    for label, value in items:
        c.setFont(bold_font, 9)
        c.setFillColor(HexColor(GRAY))
        c.drawString(35*mm, y, label)
        c.setFont(font_name, 10)
        c.setFillColor(HexColor(TEXT))
        c.drawString(65*mm, y, str(value))
        y -= 6*mm

    y -= section_gap

    # 지급 금액 섹션
    c.setStrokeColor(HexColor(BORDER))
    c.line(25*mm, y + 2*mm, width - 25*mm, y + 2*mm)
    y -= section_gap

    c.setFillColor(HexColor(DARK_GRAY))
    c.setFont(bold_font, 11)
    c.drawString(30*mm, y, "지급 금액")
    y -= line_height

    items = [
        ("지급총액", f"{gross_pay:,}원"),
        ("소득세(3%)", f"-{income_tax:,}원"),
        ("지방소득세(0.3%)", f"-{local_tax:,}원"),
        ("공제합계", f"-{total_deduction:,}원"),
    ]

    for label, value in items:
        c.setFont(bold_font, 9)
        c.setFillColor(HexColor(GRAY))
        c.drawString(35*mm, y, label)
        c.setFont(font_name, 10)
        if value.startswith("-"):
            c.setFillColor(HexColor(RED))
        else:
            c.setFillColor(HexColor(TEXT))
        c.drawString(95*mm, y, str(value))
        y -= 6*mm

    # 실지급액 (강조 - 블루)
    y -= 6*mm
    c.setFillColor(HexColor(LIGHT_BLUE))
    c.rect(30*mm, y - 2*mm, width - 60*mm, 12*mm, fill=1, stroke=0)

    c.setFont(bold_font, 11)
    c.setFillColor(HexColor(BLUE))
    c.drawString(35*mm, y + 1*mm, "실지급액")
    c.setFont(bold_font, 14)
    c.drawRightString(width - 35*mm, y + 1*mm, f"{net_pay:,}원")
    y -= 14*mm

    # 근무 상태 섹션
    c.setStrokeColor(HexColor(BORDER))
    c.line(25*mm, y + 2*mm, width - 25*mm, y + 2*mm)
    y -= section_gap

    c.setFillColor(HexColor(DARK_GRAY))
    c.setFont(bold_font, 11)
    c.drawString(30*mm, y, "근무 현황")
    y -= line_height

    check_in = attendance.get("check_in_time", "-")
    check_out = attendance.get("check_out_time", "-")
    if check_in and check_in != "-":
        check_in = check_in.split(".")[0]  # 밀리초 제거
    if check_out and check_out != "-":
        check_out = check_out.split(".")[0]

    items = [
        ("상태", "퇴근완료"),
        ("출근", str(check_in)),
        ("퇴근", str(check_out)),
    ]

    for label, value in items:
        c.setFont(bold_font, 9)
        c.setFillColor(HexColor(GRAY))
        c.drawString(35*mm, y, label)
        c.setFont(font_name, 10)
        if label == "상태":
            c.setFillColor(HexColor(GREEN))
        else:
            c.setFillColor(HexColor(TEXT))
        c.drawString(65*mm, y, str(value))
        y -= 6*mm

    # 발급일 (하단 고정)
    c.setFillColor(HexColor(GRAY))
    c.setFont(font_name, 9)
    today = now_kst().strftime("%Y년 %m월 %d일")
    c.drawCentredString(width/2, 25*mm, f"발급일: {today}")

    c.save()
    buffer.seek(0)
    return buffer.read()
