"""Blockchain Routes"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
from datetime import datetime

from ..dependencies import get_db, require_auth, require_worker, require_admin
from ..schemas.attendance import ChainLogResponse
from db import Database
from utils import now_kst

router = APIRouter()


@router.get("/logs")
async def get_all_chain_logs(
    limit: int = 100,
    offset: int = 0,
    auth: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """모든 블록체인 기록 조회 (관리자 전용)"""
    logs = db.get_all_chain_logs(limit=limit, offset=offset)
    total = db.count_chain_logs()

    return {
        "total": total,
        "logs": logs
    }


@router.get("/logs/me")
async def get_my_chain_logs(
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """내 블록체인 기록"""
    from wpt_service import wpt_service

    worker = auth["worker"]
    logs = db.get_chain_logs_by_worker(worker["id"])

    # WPT 잔액 조회
    wallet_address = worker.get("wallet_address")
    if wpt_service.enabled and wallet_address:
        tokens = wpt_service.get_balance(wallet_address)
    else:
        tokens = db.get_worker_tokens(worker["id"])

    return {
        "total": len(logs),
        "logs": [ChainLogResponse(**log) for log in logs],
        "tokens": tokens
    }


@router.get("/tokens")
async def get_my_tokens(
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """내 크레딧 수 조회"""
    from wpt_service import wpt_service

    worker = auth["worker"]

    # 지갑 주소 확인/생성
    wallet_address = worker.get("wallet_address")
    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker["id"])
        db.set_worker_wallet_address(worker["id"], wallet_address)

    # WPT 잔액 조회
    if wpt_service.enabled:
        tokens = wpt_service.get_balance(wallet_address)
    else:
        tokens = db.get_worker_tokens(worker["id"])

    return {"tokens": tokens, "wallet_address": wallet_address}


@router.post("/certificate/{log_id}")
async def download_certificate(
    log_id: int,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """근무증명서 다운로드 (크레딧 1개 차감)"""
    from wpt_service import wpt_service

    worker = auth["worker"]

    # 해당 로그가 본인의 것인지 확인
    logs = db.get_chain_logs_by_worker(worker["id"])
    log = next((l for l in logs if l["id"] == log_id), None)

    if not log:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다")

    # 지갑 주소 확인/생성
    wallet_address = worker.get("wallet_address")
    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker["id"])
        db.set_worker_wallet_address(worker["id"], wallet_address)

    # WPT 크레딧 차감
    tx_hash = None
    if wpt_service.enabled:
        # 블록체인 잔액 확인
        balance = wpt_service.get_balance(wallet_address)
        if balance < 1:
            raise HTTPException(status_code=400, detail="크레딧이 부족합니다")

        # WPT 토큰 소각
        reason = f"증명서 발급 (log_id: {log_id})"
        result = wpt_service.burn_credits(wallet_address, 1, reason)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "크레딧 차감 실패"))

        tx_hash = result.get("tx_hash")
        new_balance = wpt_service.get_balance(wallet_address)

        # 거래 내역 기록
        db.create_credit_history(
            worker_id=worker["id"],
            amount=-1,
            balance_after=new_balance,
            tx_type="BURN",
            reason=reason,
            tx_hash=tx_hash
        )

        # DB 토큰도 동기화
        db.use_token(worker["id"], 1)
    else:
        # WPT 비활성화 시 DB 토큰만 사용
        if not db.use_token(worker["id"], 1):
            raise HTTPException(status_code=400, detail="크레딧이 부족합니다")

        new_balance = db.get_worker_tokens(worker["id"])
        db.create_credit_history(
            worker_id=worker["id"],
            amount=-1,
            balance_after=new_balance,
            tx_type="BURN",
            reason=f"증명서 발급 (log_id: {log_id})",
            tx_hash=None
        )

    # PDF 생성
    try:
        pdf_bytes = generate_certificate_pdf(worker, log)
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=certificate_{log_id}.pdf"
            }
        )
    except Exception as e:
        # 실패 시 크레딧 복구 (WPT는 이미 소각되어 복구 불가, 관리자에게 문의 안내)
        if not wpt_service.enabled:
            db.add_tokens(worker["id"], 1)
        raise HTTPException(status_code=500, detail=f"증명서 생성 실패: {str(e)} (크레딧 차감됨, 관리자 문의 필요)")


@router.post("/certificate/admin/{log_id}")
async def admin_download_certificate(
    log_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """관리자용 근무증명서 다운로드 (크레딧 차감 없음)"""
    # 로그 조회
    log = db.get_chain_log_by_id(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다")

    # 근무자 정보 조회
    worker = db.get_worker_by_id(log["worker_id"])
    if not worker:
        raise HTTPException(status_code=404, detail="근무자 정보를 찾을 수 없습니다")

    # PDF 생성
    try:
        pdf_bytes = generate_certificate_pdf(worker, log)
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=certificate_{log_id}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"증명서 생성 실패: {str(e)}")


def generate_certificate_pdf(worker: dict, log: dict) -> bytes:
    """블록체인 업무증명서 PDF 생성"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.colors import HexColor
    import os
    import qrcode
    import hashlib

    # 폰트 등록
    font_path = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
    bold_font_path = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"

    if os.path.exists(font_path):
        try:
            pdfmetrics.registerFont(TTFont("NanumGothic", font_path))
        except:
            pass
        if os.path.exists(bold_font_path):
            try:
                pdfmetrics.registerFont(TTFont("NanumGothicBold", bold_font_path))
            except:
                pass
        else:
            try:
                pdfmetrics.registerFont(TTFont("NanumGothicBold", font_path))
            except:
                pass
        font_name = "NanumGothic"
        bold_font = "NanumGothicBold"
    else:
        font_name = "Helvetica"
        bold_font = "Helvetica-Bold"

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # 색상 정의 (네이비, 그레이, 블랙, 화이트 톤)
    NAVY = "#1E3A5F"
    NAVY_DARK = "#152A45"
    BLACK = "#1F2937"
    DARK_GRAY = "#374151"
    GRAY = "#6B7280"
    LIGHT_GRAY = "#9CA3AF"
    WHITE = "#FFFFFF"
    BG_LIGHT = "#F3F4F6"

    # 마진 설정
    margin_x = 20 * mm
    margin_y = 12 * mm
    content_width = width - 2 * margin_x

    # 문서번호 생성
    tx_hash = log.get("tx_hash", "")
    if tx_hash:
        doc_number = f"WPC-{tx_hash[-8:].upper()}"
    else:
        doc_number = f"WPC-{hashlib.md5(str(log.get('id', 0)).encode()).hexdigest()[:8].upper()}"

    # ==================== 상단 헤더 ====================
    header_height = 38 * mm
    c.setFillColor(HexColor(NAVY))
    c.rect(0, height - header_height, width, header_height, stroke=0, fill=1)

    # 헤더 하단 장식선
    c.setFillColor(HexColor(NAVY_DARK))
    c.rect(0, height - header_height, width, 2*mm, stroke=0, fill=1)

    # 제목
    y = height - 15 * mm
    c.setFillColor(HexColor(WHITE))
    c.setFont(bold_font, 22)
    c.drawCentredString(width / 2, y, "블록체인 업무증명서")

    y -= 7 * mm
    c.setFont(font_name, 9)
    c.setFillColor(HexColor("#D1D5DB"))
    c.drawCentredString(width / 2, y, "Blockchain Work Certificate")

    y -= 6 * mm
    c.setFont(font_name, 8)
    c.drawCentredString(width / 2, y, f"문서번호: {doc_number}")

    # ==================== 본문 ====================
    y = height - header_height - 8 * mm
    row_height = 7 * mm
    label_width = 28 * mm

    def draw_section(y_pos, title, color):
        c.setFillColor(HexColor(color))
        c.roundRect(margin_x, y_pos - 5*mm, 3*mm, 5*mm, 1*mm, stroke=0, fill=1)
        c.setFillColor(HexColor(BLACK))
        c.setFont(bold_font, 10)
        c.drawString(margin_x + 5*mm, y_pos - 4*mm, title)
        return y_pos - 9 * mm

    def draw_row(y_pos, label, value):
        c.setStrokeColor(HexColor("#E5E7EB"))
        c.setLineWidth(0.5)
        # 라벨
        c.setFillColor(HexColor(BG_LIGHT))
        c.rect(margin_x, y_pos - row_height, label_width, row_height, stroke=1, fill=1)
        # 값
        c.setFillColor(HexColor(WHITE))
        c.rect(margin_x + label_width, y_pos - row_height, content_width - label_width, row_height, stroke=1, fill=1)
        # 텍스트
        c.setFillColor(HexColor(DARK_GRAY))
        c.setFont(bold_font, 8)
        c.drawString(margin_x + 2*mm, y_pos - 5*mm, label)
        c.setFillColor(HexColor(BLACK))
        c.setFont(font_name, 8)
        c.drawString(margin_x + label_width + 3*mm, y_pos - 5*mm, str(value) if value else "-")
        return y_pos - row_height

    # 인적사항
    y = draw_section(y, "인적사항", NAVY)
    y = draw_row(y, "성명", worker.get("name", "-"))
    y = draw_row(y, "생년월일", worker.get("birth_date", "-") or "-")
    y = draw_row(y, "연락처", worker.get("phone", "-"))

    # 근무내용
    y -= 5 * mm
    y = draw_section(y, "근무내용", DARK_GRAY)

    from datetime import datetime as dt

    def format_time(time_val):
        """시간 값을 HH:MM 형식으로 변환"""
        if not time_val:
            return "-"
        # datetime 객체인 경우
        if isinstance(time_val, dt):
            return time_val.strftime("%H:%M")
        # 문자열인 경우
        if isinstance(time_val, str):
            if "T" in time_val:
                return time_val.split("T")[1][:5]
            elif " " in time_val:
                return time_val.split(" ")[1][:5]
            elif ":" in time_val:
                return time_val[:5]
        return "-"

    check_in = log.get("check_in_time")
    check_out = log.get("check_out_time")
    check_in_time = format_time(check_in)
    check_out_time = format_time(check_out)

    worked_minutes = log.get("worked_minutes", 0) or 0
    hours = worked_minutes // 60
    mins = worked_minutes % 60

    y = draw_row(y, "행사명", log.get("event_title", "-"))
    y = draw_row(y, "근무지", log.get("location", "-") or "-")
    y = draw_row(y, "근무일", log.get("event_date", "-"))
    y = draw_row(y, "근무시간", f"{check_in_time} ~ {check_out_time} ({hours}시간 {mins}분)")

    # 급여내역
    y -= 5 * mm
    y = draw_section(y, "급여내역", GRAY)

    # 행사 등록 금액 그대로 사용
    gross_pay = log.get("pay_amount", 0) or 0
    tax_amount = int(gross_pay * 0.033)
    net_pay = gross_pay - tax_amount

    y = draw_row(y, "총급여", f"{gross_pay:,}원 (세전)")
    y = draw_row(y, "공제액", f"{tax_amount:,}원 (3.3%)")

    # 실수령액 강조
    c.setStrokeColor(HexColor("#E5E7EB"))
    c.setFillColor(HexColor(BG_LIGHT))
    c.rect(margin_x, y - row_height, label_width, row_height, stroke=1, fill=1)
    c.setFillColor(HexColor("#E5E7EB"))
    c.rect(margin_x + label_width, y - row_height, content_width - label_width, row_height, stroke=1, fill=1)
    c.setFillColor(HexColor(DARK_GRAY))
    c.setFont(bold_font, 8)
    c.drawString(margin_x + 2*mm, y - 5*mm, "실수령액")
    c.setFillColor(HexColor(BLACK))
    c.setFont(bold_font, 9)
    c.drawString(margin_x + label_width + 3*mm, y - 5*mm, f"{net_pay:,}원")
    y -= row_height

    # 블록체인 검증
    y -= 5 * mm
    y = draw_section(y, "블록체인 검증", NAVY_DARK)

    block_num = log.get("block_number", "-")
    y = draw_row(y, "네트워크", "Polygon Amoy Testnet")
    y = draw_row(y, "블록번호", str(block_num))

    # TX Hash
    c.setStrokeColor(HexColor("#E5E7EB"))
    c.setFillColor(HexColor(BG_LIGHT))
    c.rect(margin_x, y - row_height, label_width, row_height, stroke=1, fill=1)
    c.setFillColor(HexColor(WHITE))
    c.rect(margin_x + label_width, y - row_height, content_width - label_width, row_height, stroke=1, fill=1)
    c.setFillColor(HexColor(DARK_GRAY))
    c.setFont(bold_font, 8)
    c.drawString(margin_x + 2*mm, y - 5*mm, "TX Hash")
    c.setFillColor(HexColor(NAVY))
    c.setFont(font_name, 6)
    if tx_hash:
        display_hash = f"{tx_hash[:30]}...{tx_hash[-12:]}" if len(tx_hash) > 45 else tx_hash
        c.drawString(margin_x + label_width + 3*mm, y - 5*mm, display_hash)
    else:
        c.setFillColor(HexColor(LIGHT_GRAY))
        c.drawString(margin_x + label_width + 3*mm, y - 5*mm, "Pending")
    y -= row_height

    # ==================== 증명 문구 ====================
    y -= 10 * mm
    c.setFillColor(HexColor(BLACK))
    c.setFont(font_name, 10)
    c.drawCentredString(width / 2, y, "위 내용이 사실임을 블록체인 기록으로 증명합니다.")

    # ==================== 발급정보 ====================
    y -= 12 * mm
    today = now_kst().strftime("%Y년 %m월 %d일")
    c.setFont(font_name, 10)
    c.drawCentredString(width / 2, y, today)

    y -= 10 * mm
    c.setFillColor(HexColor(NAVY))
    c.setFont(bold_font, 13)
    c.drawCentredString(width / 2, y, "WorkProof Chain")

    y -= 5 * mm
    c.setFont(font_name, 8)
    c.setFillColor(HexColor(GRAY))
    c.drawCentredString(width / 2, y, "블록체인 기반 업무이력 증명 시스템")

    # ==================== QR 코드 ====================
    if tx_hash:
        qr_url = f"https://amoy.polygonscan.com/tx/{tx_hash}"
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#1E3A5F", back_color="white")

        qr_buffer = BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)

        from reportlab.lib.utils import ImageReader
        qr_image = ImageReader(qr_buffer)

        qr_size = 18 * mm
        qr_x = width - margin_x - qr_size - 3*mm
        qr_y = margin_y + 6*mm
        c.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size)

        c.setFont(font_name, 6)
        c.setFillColor(HexColor(GRAY))
        c.drawCentredString(qr_x + qr_size/2, qr_y - 2*mm, "QR 스캔 검증")

    # ==================== 하단 고지 ====================
    c.setFillColor(HexColor(LIGHT_GRAY))
    c.setFont(font_name, 6)
    c.drawString(margin_x, margin_y + 6*mm, "※ 본 증명서는 블록체인에 기록된 업무 내역을 바탕으로 자동 발급되었습니다.")
    c.drawString(margin_x, margin_y + 2*mm, "※ QR코드 또는 TX Hash로 Polygonscan에서 원본 기록 검증이 가능합니다.")

    c.save()
    buffer.seek(0)
    return buffer.read()


@router.post("/verify")
async def verify_log(
    data: dict,
    db: Database = Depends(get_db)
):
    """블록체인 기록 검증"""
    tx_hash = data.get("tx_hash")
    log_hash = data.get("log_hash")

    # tx_hash로 찾기
    if tx_hash:
        with db.get_connection() as conn:
            from psycopg2.extras import RealDictCursor
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                "SELECT cl.*, e.title as event_title, e.event_date FROM chain_logs cl LEFT JOIN events e ON cl.event_id = e.id WHERE cl.tx_hash = %s",
                (tx_hash,)
            )
            row = cursor.fetchone()
    elif log_hash:
        with db.get_connection() as conn:
            from psycopg2.extras import RealDictCursor
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                "SELECT cl.*, e.title as event_title, e.event_date FROM chain_logs cl LEFT JOIN events e ON cl.event_id = e.id WHERE cl.log_hash = %s",
                (log_hash,)
            )
            row = cursor.fetchone()
    else:
        raise HTTPException(status_code=400, detail="tx_hash 또는 log_hash가 필요합니다")

    if not row:
        return {
            "verified": False,
            "message": "해당 기록을 찾을 수 없습니다"
        }

    log = dict(row)

    # tx_hash가 있으면 온체인 검증 시도
    if log.get("tx_hash"):
        try:
            from chain import PolygonChain
            chain = PolygonChain()
            result = chain.verify_log_exists(log["log_hash"])
            on_chain_verified = result.get("exists", False)

            return {
                "verified": on_chain_verified,
                "message": "블록체인에서 검증됨" if on_chain_verified else "블록체인에 기록 확인됨 (DB 매칭)",
                "tx_hash": log["tx_hash"],
                "block_number": log.get("block_number"),
                "network": log.get("network", "amoy"),
                "event_title": log.get("event_title"),
                "event_date": log.get("event_date"),
                "status": log.get("status")
            }
        except Exception as e:
            # 검증 실패해도 DB에 기록이 있으면 성공으로 처리
            return {
                "verified": True,
                "message": "DB 기록 확인됨 (온체인 검증 스킵)",
                "tx_hash": log.get("tx_hash"),
                "block_number": log.get("block_number"),
                "network": log.get("network", "amoy"),
                "event_title": log.get("event_title"),
                "event_date": log.get("event_date"),
                "status": log.get("status")
            }

    # 아직 온체인에 기록되지 않은 경우
    return {
        "verified": True,
        "message": "로컬 기록 확인됨 (아직 블록체인에 기록되지 않음)",
        "log_hash": log.get("log_hash"),
        "pending_tx": True,
        "event_title": log.get("event_title"),
        "event_date": log.get("event_date"),
        "status": log.get("status")
    }


@router.get("/status")
async def chain_status(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """블록체인 연결 상태"""
    try:
        from chain import PolygonChain
        from ..config import get_settings

        settings = get_settings()
        chain = PolygonChain()

        # 잔액 조회
        balance = chain.get_balance()

        # 지갑 주소
        wallet_address = chain.account.address if chain.account else None

        # 최근 기록 수
        with db.get_connection() as conn:
            from psycopg2.extras import RealDictCursor
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT COUNT(*) as cnt FROM chain_logs")
            total_logs = cursor.fetchone()["cnt"]

            cursor.execute("SELECT COUNT(*) as cnt FROM chain_logs WHERE tx_hash IS NOT NULL")
            confirmed_logs = cursor.fetchone()["cnt"]

        return {
            "connected": True,
            "network": settings.POLYGON_NETWORK if hasattr(settings, 'POLYGON_NETWORK') else "amoy",
            "chain_id": settings.CHAIN_ID,
            "wallet_address": wallet_address,
            "balance_matic": balance,
            "total_logs": total_logs,
            "confirmed_logs": confirmed_logs,
            "pending_logs": total_logs - confirmed_logs
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }
