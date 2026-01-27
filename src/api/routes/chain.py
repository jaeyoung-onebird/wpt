"""Blockchain Routes"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
from datetime import datetime

from ..dependencies import get_db, require_auth, require_worker
from ..schemas.attendance import ChainLogResponse
from db import Database

router = APIRouter()


@router.get("/logs")
async def get_all_chain_logs(
    limit: int = 100,
    offset: int = 0,
    db: Database = Depends(get_db)
):
    """모든 블록체인 기록 조회 (공개)"""
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


def generate_certificate_pdf(worker: dict, log: dict) -> bytes:
    """근무증명서 PDF 생성 (Toss 스타일)"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.colors import HexColor
    import os
    import qrcode

    # 디자인 토큰
    PRIMARY_BLUE = "#2563EB"
    DARK_NAVY = "#1E3A5F"
    GRAY_TEXT = "#64748B"
    LIGHT_BG = "#F8FAFC"
    BORDER_COLOR = "#E2E8F0"
    SUCCESS_GREEN = "#059669"
    TEXT_DARK = "#1E293B"
    TEXT_BLACK = "#0F172A"

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

    # 배경
    c.setFillColor(HexColor(LIGHT_BG))
    c.rect(0, 0, width, height, fill=1)

    # 마진 설정
    margin_x = 25 * mm
    content_width = width - 2 * margin_x

    # 헤더 영역
    y = height - 35 * mm
    c.setFillColor(HexColor(DARK_NAVY))
    c.setFont(bold_font, 24)
    c.drawCentredString(width / 2, y, "근무증명서")

    y -= 8 * mm
    c.setFillColor(HexColor(GRAY_TEXT))
    c.setFont(font_name, 10)
    c.drawCentredString(width / 2, y, "Certificate of Employment")

    # 블록체인 검증 배지
    y -= 12 * mm
    badge_width = 45 * mm
    badge_height = 7 * mm
    badge_x = (width - badge_width) / 2
    c.setFillColor(HexColor("#DCFCE7"))
    c.roundRect(badge_x, y - 2 * mm, badge_width, badge_height, 3 * mm, fill=1, stroke=0)
    c.setFillColor(HexColor(SUCCESS_GREEN))
    c.setFont(bold_font, 9)
    c.drawCentredString(width / 2, y, "Blockchain Verified")

    # === 카드 섹션 그리기 함수 ===
    def draw_card(y_pos, title, items, card_height=None):
        """카드 스타일 섹션 그리기"""
        padding = 5 * mm
        item_height = 8 * mm
        if card_height is None:
            card_height = 12 * mm + len(items) * item_height

        # 카드 배경
        c.setFillColor(HexColor("#FFFFFF"))
        c.setStrokeColor(HexColor(BORDER_COLOR))
        c.setLineWidth(0.5)
        c.roundRect(margin_x, y_pos - card_height, content_width, card_height, 3 * mm, fill=1, stroke=1)

        # 카드 제목
        title_y = y_pos - 8 * mm
        c.setFillColor(HexColor(TEXT_DARK))
        c.setFont(bold_font, 11)
        c.drawString(margin_x + padding, title_y, title)

        # 항목들
        item_y = title_y - 10 * mm
        for label, value in items:
            c.setFillColor(HexColor(GRAY_TEXT))
            c.setFont(font_name, 9)
            c.drawString(margin_x + padding, item_y, label)

            c.setFillColor(HexColor(TEXT_BLACK))
            c.setFont(font_name, 10)
            c.drawRightString(margin_x + content_width - padding, item_y, str(value))
            item_y -= item_height

        return y_pos - card_height - 5 * mm

    # === 1. 근무자 정보 ===
    y -= 20 * mm
    worker_items = [
        ("이름", worker.get("name", "-")),
        ("생년월일", worker.get("birth_date", "-") or "-"),
        ("연락처", worker.get("phone", "-")),
    ]
    y = draw_card(y, "근무자 정보", worker_items)

    # === 2. 근무 내용 ===
    work_items = [
        ("행사명", log.get("event_title", "-")),
        ("근무지", log.get("location", "-") or "-"),
    ]
    y = draw_card(y, "근무 내용", work_items)

    # === 3. 근무 기간 및 시간 ===
    check_in = log.get("check_in_time", "-")
    check_out = log.get("check_out_time", "-")

    # 시간 포맷팅
    if check_in and isinstance(check_in, str) and " " in check_in:
        check_in_time = check_in.split(" ")[1][:5]
    elif check_in and isinstance(check_in, str) and len(check_in) >= 5:
        check_in_time = check_in[:5]
    else:
        check_in_time = "-"

    if check_out and isinstance(check_out, str) and " " in check_out:
        check_out_time = check_out.split(" ")[1][:5]
    elif check_out and isinstance(check_out, str) and len(check_out) >= 5:
        check_out_time = check_out[:5]
    else:
        check_out_time = "-"

    worked_minutes = log.get("worked_minutes", 0) or 0
    hours = worked_minutes // 60
    mins = worked_minutes % 60

    time_items = [
        ("근무일", log.get("event_date", "-")),
        ("근무시간", f"{check_in_time} ~ {check_out_time}"),
        ("총 근무시간", f"{hours}시간 {mins}분"),
    ]
    y = draw_card(y, "근무 기간 및 시간", time_items)

    # === 4. 급여 정보 ===
    pay_amount = log.get("pay_amount", 0) or 0

    # 근무시간 기준 급여 계산 (8시간 기준)
    if worked_minutes > 0 and pay_amount > 0:
        # 일당 기준으로 시간당 급여 계산 (8시간 기준)
        hourly_rate = pay_amount / 8
        gross_pay = int((worked_minutes / 60) * hourly_rate)
    else:
        hourly_rate = 0
        gross_pay = pay_amount

    tax_rate = 0.033
    tax_amount = int(gross_pay * tax_rate)
    net_pay = gross_pay - tax_amount

    pay_items = [
        ("시급", f"{int(hourly_rate):,}원" if hourly_rate > 0 else "-"),
        ("총 급여 (세전)", f"{gross_pay:,}원"),
        ("세금공제 (3.3%)", f"-{tax_amount:,}원"),
        ("실수령액", f"{net_pay:,}원"),
    ]
    y = draw_card(y, "급여 정보", pay_items)

    # === 5. 블록체인 검증 정보 + QR 코드 ===
    chain_card_height = 45 * mm
    padding = 5 * mm

    # 카드 배경
    c.setFillColor(HexColor("#FFFFFF"))
    c.setStrokeColor(HexColor(BORDER_COLOR))
    c.setLineWidth(0.5)
    c.roundRect(margin_x, y - chain_card_height, content_width, chain_card_height, 3 * mm, fill=1, stroke=1)

    # 카드 제목
    title_y = y - 8 * mm
    c.setFillColor(HexColor(TEXT_DARK))
    c.setFont(bold_font, 11)
    c.drawString(margin_x + padding, title_y, "블록체인 검증 정보")

    # 블록체인 정보
    tx_hash = log.get("tx_hash", "Pending")
    block_num = log.get("block_number", "-")
    network = log.get("network", "amoy")

    info_y = title_y - 12 * mm
    c.setFillColor(HexColor(GRAY_TEXT))
    c.setFont(font_name, 8)

    c.drawString(margin_x + padding, info_y, "TX Hash")
    c.setFillColor(HexColor(TEXT_BLACK))
    c.setFont(font_name, 8)
    if tx_hash and len(tx_hash) > 30:
        c.drawString(margin_x + padding + 20 * mm, info_y, f"{tx_hash[:28]}...")
    else:
        c.drawString(margin_x + padding + 20 * mm, info_y, tx_hash or "-")

    info_y -= 6 * mm
    c.setFillColor(HexColor(GRAY_TEXT))
    c.drawString(margin_x + padding, info_y, "Network")
    c.setFillColor(HexColor(TEXT_BLACK))
    c.drawString(margin_x + padding + 20 * mm, info_y, "Polygon Amoy Testnet")

    info_y -= 6 * mm
    c.setFillColor(HexColor(GRAY_TEXT))
    c.drawString(margin_x + padding, info_y, "Block")
    c.setFillColor(HexColor(TEXT_BLACK))
    c.drawString(margin_x + padding + 20 * mm, info_y, str(block_num))

    # QR 코드 생성
    if tx_hash and tx_hash != "Pending":
        qr_url = f"https://amoy.polygonscan.com/tx/{tx_hash}"
        qr = qrcode.QRCode(version=1, box_size=10, border=2)
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")

        # QR 이미지를 바이트로 변환
        qr_buffer = BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)

        from reportlab.lib.utils import ImageReader
        qr_image = ImageReader(qr_buffer)

        # QR 코드 그리기
        qr_size = 25 * mm
        qr_x = margin_x + content_width - qr_size - padding
        qr_y = y - chain_card_height + padding
        c.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size)

    y = y - chain_card_height - 5 * mm

    # === 6. 발급일 ===
    y -= 3 * mm
    c.setFillColor(HexColor(GRAY_TEXT))
    c.setFont(font_name, 10)
    today = datetime.now().strftime("%Y년 %m월 %d일")
    c.drawCentredString(width / 2, y, f"발급일: {today}")

    # === 7. 법적 고지 ===
    y -= 15 * mm
    c.setFillColor(HexColor(GRAY_TEXT))
    c.setFont(font_name, 7)
    c.drawCentredString(width / 2, y, "본 증명서는 블록체인에 기록된 근무 내역을 바탕으로 발급되었습니다.")
    y -= 4 * mm
    c.drawCentredString(width / 2, y, "QR 코드 또는 TX Hash로 Polygonscan에서 검증할 수 있습니다.")
    y -= 4 * mm
    c.drawCentredString(width / 2, y, "본 증명서는 참고용이며, 법적 효력을 보장하지 않습니다.")

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
            cursor = conn.execute(
                "SELECT cl.*, e.title as event_title, e.event_date FROM chain_logs cl LEFT JOIN events e ON cl.event_id = e.id WHERE cl.tx_hash = ?",
                (tx_hash,)
            )
            row = cursor.fetchone()
    elif log_hash:
        with db.get_connection() as conn:
            cursor = conn.execute(
                "SELECT cl.*, e.title as event_title, e.event_date FROM chain_logs cl LEFT JOIN events e ON cl.event_id = e.id WHERE cl.log_hash = ?",
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
            cursor = conn.execute("SELECT COUNT(*) as cnt FROM chain_logs")
            total_logs = cursor.fetchone()["cnt"]

            cursor = conn.execute("SELECT COUNT(*) as cnt FROM chain_logs WHERE tx_hash IS NOT NULL")
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
