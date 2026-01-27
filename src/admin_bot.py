"""
관리자 봇 메인
"""
import os
import logging
from dotenv import load_dotenv

# 환경변수 먼저 로드 (다른 모듈 import 전에!)
load_dotenv('config/.env')

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ContextTypes, ConversationHandler, filters
)

from db import Database
from parser import EventParser
from utils import generate_short_code, generate_deep_link, generate_check_in_code, now_kst_str, now_kst, KST
from payroll import PayrollExporter
from models import ApplicationStatus, EventStatus
from chain import polygon_chain

# 로깅 설정 (한국 시간 UTC+9)
import time
logging.Formatter.converter = lambda *args: time.localtime(time.time() + 9*3600)
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
    handlers=[
        logging.FileHandler(os.getenv('LOG_DIR', 'logs') + '/admin_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# DB 초기화
db = Database(os.getenv('DATABASE_URL', 'postgresql://ubuntu:ubuntu123@localhost:5432/workproof'))

# 파서 초기화
event_parser = EventParser()

# 엑셀 생성기 초기화
payroll_exporter = PayrollExporter(os.getenv('EXPORT_DIR', 'data/exports'))

# 근무자 봇 인스턴스 (근무자에게 알림 발송용)
worker_bot = Bot(token=os.getenv('WORKER_BOT_TOKEN'))

# Conversation states
(EVENT_TITLE, EVENT_DATE, EVENT_START_TIME, EVENT_END_TIME, EVENT_LOCATION, EVENT_PAY,
 EVENT_WORK_TYPE, EVENT_DRESS, EVENT_MANAGER, EVENT_CONFIRM,
 APP_SELECT, APP_ACTION,
 CODE_GEN,
 EDIT_TITLE, EDIT_DATE, EDIT_TIME, EDIT_LOCATION, EDIT_PAY, EDIT_WORK_TYPE, EDIT_DRESS, EDIT_MANAGER) = range(21)


# ===== 유틸리티 =====
def is_admin(user_id: int) -> bool:
    """관리자 권한 확인"""
    return db.is_admin(user_id)


async def require_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """관리자 권한 확인 - 링크 접속 시 자동 등록"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        # 승인 없이 바로 관리자로 등록
        user = update.effective_user
        username = user.username if user.username else ""

        try:
            db.add_admin(user_id, username)
            logger.info(f"Auto-registered admin: {user_id} (@{username})")

            await update.message.reply_text(
                "✅ 관리자 등록 완료\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "관리자 봇을 사용하실 수 있습니다.\n"
                "다시 /start 명령어를 입력해주세요."
            )
        except Exception as e:
            logger.error(f"Failed to auto-register admin: {e}")
            await update.message.reply_text(
                "❌ 등록 중 오류가 발생했습니다.\n"
                "다시 시도해주세요."
            )

        return False
    return True


# ===== 관리자 승인 처리 =====
async def approve_admin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """관리자 승인 버튼 처리"""
    query = update.callback_query
    await query.answer()

    # 승인 권한 확인
    reviewer_id = update.effective_user.id
    if not is_admin(reviewer_id):
        await query.edit_message_text("❌ 관리자만 승인할 수 있습니다.")
        return

    # telegram_id 추출
    telegram_id = int(query.data.split("_")[-1])

    # 승인 처리
    try:
        # 요청자 정보 먼저 가져오기 (승인 전에)
        request_info = db.get_pending_admin_request(telegram_id)
        if request_info:
            full_name = f"{request_info.get('first_name', '')} {request_info.get('last_name', '')}".strip()
            username = request_info.get('username', '')
        else:
            full_name = "사용자"
            username = ""

        # 승인 처리
        db.approve_admin_request(telegram_id, reviewer_id)

        # 승인 메시지 업데이트
        await query.edit_message_text(
            f"✅ 관리자 승인 완료\n\n"
            f"이름: {full_name}\n"
            f"아이디: @{username}\n"
            f"Telegram ID: {telegram_id}\n\n"
            f"승인되었습니다."
        )

        # 승인된 사용자에게 알림
        try:
            await context.bot.send_message(
                chat_id=telegram_id,
                text="🎉 관리자 권한이 승인되었습니다!\n\n"
                     "/start 명령어로 관리자 봇을 사용하실 수 있습니다."
            )
        except Exception as e:
            logger.error(f"Failed to notify approved admin: {e}")

    except Exception as e:
        logger.error(f"Failed to approve admin: {e}")
        await query.edit_message_text(f"❌ 승인 처리 중 오류가 발생했습니다: {e}")


async def reject_admin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """관리자 거부 버튼 처리"""
    query = update.callback_query
    await query.answer()

    # 승인 권한 확인
    reviewer_id = update.effective_user.id
    if not is_admin(reviewer_id):
        await query.edit_message_text("❌ 관리자만 거부할 수 있습니다.")
        return

    # telegram_id 추출
    telegram_id = int(query.data.split("_")[-1])

    # 거부 처리
    try:
        db.reject_admin_request(telegram_id, reviewer_id)

        # 요청자 정보 가져오기
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT username, first_name, last_name
                FROM pending_admin_requests
                WHERE telegram_id = ?
            """, (telegram_id,))
            row = cursor.fetchone()
            if row:
                full_name = f"{row['first_name'] or ''} {row['last_name'] or ''}".strip()
                username = row['username'] or ''
            else:
                full_name = "사용자"
                username = ""

        # 거부 메시지 업데이트
        await query.edit_message_text(
            f"❌ 관리자 요청 거부\n\n"
            f"이름: {full_name}\n"
            f"아이디: @{username}\n"
            f"Telegram ID: {telegram_id}\n\n"
            f"거부되었습니다."
        )

        # 거부된 사용자에게 알림
        try:
            await context.bot.send_message(
                chat_id=telegram_id,
                text="❌ 관리자 권한 요청이 거부되었습니다.\n\n"
                     "관리자에게 문의해주세요."
            )
        except Exception as e:
            logger.error(f"Failed to notify rejected admin: {e}")

    except Exception as e:
        logger.error(f"Failed to reject admin: {e}")
        await query.edit_message_text(f"❌ 거부 처리 중 오류가 발생했습니다: {e}")


# ===== 시작 명령어 =====
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """시작 명령어"""
    if not await require_admin(update, context):
        return

    # 통계 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()

        # 지원자 통계
        cursor.execute("""
            SELECT
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_count
            FROM applications
        """)
        app_stats = cursor.fetchone()
        pending_apps = app_stats['pending_count'] if app_stats else 0
        confirmed_apps = app_stats['confirmed_count'] if app_stats else 0

        # 출석 통계
        cursor.execute("""
            SELECT
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status IN ('CHECKED_IN', 'COMPLETED') THEN 1 ELSE 0 END) as done_count
            FROM attendance
        """)
        att_stats = cursor.fetchone()
        pending_att = att_stats['pending_count'] if att_stats else 0
        done_att = att_stats['done_count'] if att_stats else 0

    keyboard = [
        [InlineKeyboardButton("📋 행사 관리", callback_data="event_list")],
        [InlineKeyboardButton("➕ 새 행사 등록", callback_data="event_register")],
        [InlineKeyboardButton(f"👥 지원자 ({pending_apps}대기 / {confirmed_apps}확정)", callback_data="manage_applications")],
        [InlineKeyboardButton(f"📊 출석 ({pending_att}대기 / {done_att}완료)", callback_data="manage_attendance")],
        [InlineKeyboardButton("👷 근무자 관리", callback_data="manage_workers")],
        [InlineKeyboardButton("📥 정산 다운로드", callback_data="export_payroll")],
        [InlineKeyboardButton("⛓️ 블록체인 검증", callback_data="blockchain_menu")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "🛡 WorkProof Chain 관리자\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📊 현황\n"
        f"• 지원자: 대기 {pending_apps} / 확정 {confirmed_apps}\n"
        f"• 출석: 대기 {pending_att} / 완료 {done_att}\n\n"
        "━━━━━━━━━━━━━━━━━━━━",
        reply_markup=reply_markup
    )


# ===== 행사 등록 =====
async def event_register_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 등록 시작 - 행사명 입력"""
    query = update.callback_query
    await query.answer()

    # 초기화
    context.user_data['event_data'] = {}

    keyboard = [[InlineKeyboardButton("✕ 취소", callback_data="event_cancel")]]
    await query.edit_message_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "STEP 1/8 · 행사명\n\n"
        "행사명을 입력하세요\n"
        "예) BMW 시승행사",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EVENT_TITLE


async def event_title_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사명 입력 받음"""
    context.user_data['event_data']['title'] = update.message.text

    await update.message.reply_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "STEP 2/8 · 날짜\n\n"
        "날짜를 입력하세요 (MMDD)\n"
        "예) 0125 → 01월 25일"
    )

    return EVENT_DATE


async def event_date_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """날짜 입력 받음 (MMDD 형식)"""
    date_input = update.message.text.strip()

    # MMDD 형식 검증
    if len(date_input) != 4 or not date_input.isdigit():
        await update.message.reply_text(
            "⚠️ 형식 오류\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            "MMDD 형식으로 입력하세요\n"
            "예) 0125"
        )
        return EVENT_DATE

    # 월/일 분리
    month = date_input[:2]
    day = date_input[2:]

    # 날짜 형식으로 저장
    formatted_date = f"{month}월 {day}일"
    context.user_data['event_data']['date'] = formatted_date
    context.user_data['event_data']['date_raw'] = date_input

    await update.message.reply_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"STEP 3/9 · 시작 시간\n\n"
        f"📅 {formatted_date}\n\n"
        "시작 시간을 입력하세요 (HHMM)\n"
        "예) 0900"
    )

    return EVENT_START_TIME


async def event_start_time_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """시작 시간 입력 받음"""
    time_input = update.message.text.strip()

    # HHMM 형식 검증
    if len(time_input) != 4 or not time_input.isdigit():
        await update.message.reply_text(
            "⚠️ 형식 오류\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            "HHMM 형식으로 입력하세요\n"
            "예) 0900"
        )
        return EVENT_START_TIME

    # 시/분 분리
    hour = time_input[:2]
    minute = time_input[2:]

    # 시간 형식으로 저장
    formatted_time = f"{hour}:{minute}"
    context.user_data['event_data']['start_time'] = formatted_time

    await update.message.reply_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"STEP 4/9 · 종료 시간\n\n"
        f"⏰ 시작: {formatted_time}\n\n"
        "종료 시간을 입력하세요 (HHMM)\n"
        "예) 2100"
    )

    return EVENT_END_TIME


async def event_end_time_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """종료 시간 입력 받음"""
    time_input = update.message.text.strip()

    # HHMM 형식 검증
    if len(time_input) != 4 or not time_input.isdigit():
        await update.message.reply_text(
            "⚠️ 형식 오류\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            "HHMM 형식으로 입력하세요\n"
            "예) 2100"
        )
        return EVENT_END_TIME

    # 시/분 분리
    hour = time_input[:2]
    minute = time_input[2:]

    # 시간 형식으로 저장
    formatted_time = f"{hour}:{minute}"
    context.user_data['event_data']['end_time'] = formatted_time

    # 전체 시간 문자열 생성
    start_time = context.user_data['event_data']['start_time']
    full_time = f"{start_time}~{formatted_time}"
    context.user_data['event_data']['time'] = full_time

    await update.message.reply_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"STEP 5/9 · 장소\n\n"
        f"⏰ {full_time}\n\n"
        "장소를 입력하세요\n"
        "예) 안양 BMW 전시장"
    )

    return EVENT_LOCATION


async def event_location_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """장소 입력 받음"""
    context.user_data['event_data']['location'] = update.message.text

    await update.message.reply_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "STEP 6/9 · 급여\n\n"
        "급여를 입력하세요\n"
        "예) 15만원"
    )

    return EVENT_PAY


async def event_pay_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """급여 입력 받음"""
    pay_text = update.message.text
    context.user_data['event_data']['pay_text'] = pay_text

    # 금액 추출 (숫자만)
    import re
    numbers = re.findall(r'\d+', pay_text.replace(',', ''))
    pay_amount = int(numbers[0]) * 10000 if numbers else 0  # 만원 단위
    context.user_data['event_data']['pay_amount'] = pay_amount

    await update.message.reply_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "STEP 7/9 · 근무 내용\n\n"
        "근무 내용을 입력하세요\n"
        "예) 발렛, 경호, 안내"
    )

    return EVENT_WORK_TYPE


async def event_work_type_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """근무 내용 입력 받음"""
    context.user_data['event_data']['work_type'] = update.message.text

    await update.message.reply_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "STEP 8/9 · 복장\n\n"
        "복장 요구사항을 입력하세요\n"
        "예) 검정 정장"
    )

    return EVENT_DRESS


async def event_dress_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """복장 입력 받음"""
    context.user_data['event_data']['dress_code'] = update.message.text

    await update.message.reply_text(
        "📋 새 행사 등록\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "STEP 9/9 · 담당자\n\n"
        "담당자 정보를 입력하세요\n"
        "예) 김실장 010-1234-5678"
    )

    return EVENT_MANAGER


async def event_manager_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """담당자 정보 입력 받음 - 최종 확인"""
    context.user_data['event_data']['manager'] = update.message.text

    # 입력된 정보 요약
    data = context.user_data['event_data']

    summary = (
        "📋 행사 등록 확인\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📌 {data.get('title', '-')}\n\n"
        f"📅 날짜: {data.get('date', '-')}\n"
        f"⏰ 시간: {data.get('time', '-')}\n"
        f"📍 장소: {data.get('location', '-')}\n"
        f"💰 급여: {data.get('pay_text', '-')}\n"
        f"👔 복장: {data.get('dress_code', '-')}\n"
        f"📞 담당: {data.get('manager', '-')}\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "위 내용으로 등록하시겠습니까?"
    )

    keyboard = [
        [InlineKeyboardButton("✓ 등록", callback_data="event_confirm")],
        [InlineKeyboardButton("✕ 취소", callback_data="event_cancel")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(summary, reply_markup=reply_markup)

    return EVENT_CONFIRM


async def event_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 등록 확정"""
    query = update.callback_query
    await query.answer()

    data = context.user_data.get('event_data')
    if not data:
        await query.edit_message_text("❌ 오류: 행사 정보를 찾을 수 없습니다.")
        return ConversationHandler.END

    # Short code 생성
    short_code = generate_short_code(data['title'], data['date'])

    # DB에 저장
    try:
        event_id = db.create_event(
            short_code=short_code,
            title=data['title'],
            event_date=data['date'],
            event_time=data['time'],
            location=data['location'],
            pay_amount=data['pay_amount'],
            pay_description=data['pay_text'],
            meal_provided=False,  # 선택사항
            work_type=data['work_type'],
            dress_code=data['dress_code'],
            age_requirement='무관',  # 선택사항
            application_method='텔레그램 봇',
            manager_name=data['manager'],
            created_by=update.effective_user.id
        )

        # Deep link 생성
        worker_bot_username = os.getenv('WORKER_BOT_USERNAME', 'workproof_worker_bot')
        deep_link = generate_deep_link(worker_bot_username, event_id)

        # 최종 모집글 생성
        posting = f"""
📋 행사 정보

(주)엘케이프라이빗

📋 {data['title']}
📅 날짜: {data['date']}
⏰ 시간: {data['time']}
📍 장소: {data['location']}
💰 급여: {data['pay_text']}
💼 근무내용: {data['work_type']}
👔 복장: {data['dress_code']}
📞 담당자: {data['manager']}

🔗 지원하기:
{deep_link}
"""

        keyboard = [
            [InlineKeyboardButton("📋 행사 목록", callback_data="event_list")],
            [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await query.edit_message_text(
            f"✅ 행사가 등록되었습니다!\n\n"
            f"행사ID: {event_id}\n"
            f"Short Code: {short_code}\n\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"{posting}\n"
            f"━━━━━━━━━━━━━━━━\n\n"
            f"💡 위 모집글을 복사하여 근무자들에게 전달하세요!",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} created: {data['title']}")

    except Exception as e:
        logger.error(f"Failed to create event: {e}")
        await query.edit_message_text(f"❌ 오류: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def event_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 등록 취소"""
    # 버튼(callback_query) 또는 명령어(message) 모두 처리
    if update.callback_query:
        query = update.callback_query
        await query.answer()
        await query.edit_message_text("❌ 행사 등록이 취소되었습니다.")
    else:
        await update.message.reply_text("❌ 행사 등록이 취소되었습니다.")

    context.user_data.clear()
    return ConversationHandler.END


# ===== 행사 상세 =====
async def event_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 상세 정보 및 모집글 표시"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('event_detail_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return

    # Deep link 생성
    worker_bot_username = os.getenv('WORKER_BOT_USERNAME', 'workproof_worker_bot')
    deep_link = generate_deep_link(worker_bot_username, event_id)

    # 모집글 생성
    work_type_line = f"💼 근무내용: {event['work_type']}\n" if event.get('work_type') else ""
    posting = f"""
📋 행사 정보

(주)엘케이프라이빗

📋 {event['title']}
📅 날짜: {event['event_date']}
⏰ 시간: {event['event_time']}
📍 장소: {event['location']}
💰 급여: {event['pay_description']}
{work_type_line}👔 복장: {event['dress_code']}
📞 담당자: {event['manager_name']}

🔗 지원하기:
{deep_link}
"""

    # 지원자 수 조회
    apps = db.list_applications_by_event(event_id)

    keyboard = [
        [InlineKeyboardButton(f"👥 지원자 관리 ({len(apps)}명)", callback_data=f"app_list_{event_id}")],
        [
            InlineKeyboardButton("✏️ 수정", callback_data=f"event_edit_{event_id}"),
            InlineKeyboardButton("🗑️ 삭제", callback_data=f"event_delete_{event_id}")
        ],
        [InlineKeyboardButton("🔙 행사 목록", callback_data="event_list")],
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        f"📋 행사 정보\n\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"{posting}\n"
        f"━━━━━━━━━━━━━━━━\n\n"
        f"💡 위 모집글을 복사하여 전달하세요!",
        reply_markup=reply_markup
    )


# ===== 행사 삭제 =====
async def event_delete(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 삭제 확인"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('event_delete_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return

    # 지원자/출석 확인
    apps = db.list_applications_by_event(event_id)
    attendances = db.list_attendance_by_event(event_id)

    keyboard = [
        [InlineKeyboardButton("⚠️ 삭제 확인", callback_data=f"event_delete_confirm_{event_id}")],
        [InlineKeyboardButton("❌ 취소", callback_data=f"event_detail_{event_id}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        f"⚠️ 행사 삭제 확인\n\n"
        f"행사: {event['title']}\n"
        f"날짜: {event['event_date']}\n"
        f"지원자: {len(apps)}명\n"
        f"출석기록: {len(attendances)}건\n\n"
        f"정말 삭제하시겠습니까?\n"
        f"삭제 시 모든 지원자 및 출석 기록이 함께 삭제됩니다.",
        reply_markup=reply_markup
    )


async def event_delete_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 삭제 실행"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('event_delete_confirm_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return

    # 삭제 처리
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # 출석 기록 삭제
            cursor.execute("DELETE FROM attendance WHERE event_id = ?", (event_id,))

            # 지원 기록 삭제
            cursor.execute("DELETE FROM applications WHERE event_id = ?", (event_id,))

            # 블록체인 로그 삭제 (선택사항)
            cursor.execute("DELETE FROM chain_logs WHERE event_id = ?", (event_id,))

            # 행사 삭제
            cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))

            conn.commit()

        keyboard = [[InlineKeyboardButton("📋 행사 목록", callback_data="event_list")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await query.edit_message_text(
            f"✅ 행사가 삭제되었습니다.\n\n"
            f"행사: {event['title']}\n"
            f"날짜: {event['event_date']}",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} deleted: {event['title']}")

    except Exception as e:
        logger.error(f"Failed to delete event: {e}")
        await query.edit_message_text(f"❌ 삭제 실패: {str(e)}")


# ===== 행사 수정 =====
async def event_edit(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 수정 메뉴"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('event_edit_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return

    # 수정할 항목 선택
    keyboard = [
        [InlineKeyboardButton("📝 행사명", callback_data=f"edit_title_{event_id}")],
        [InlineKeyboardButton("📅 날짜", callback_data=f"edit_date_{event_id}")],
        [InlineKeyboardButton("⏰ 시간", callback_data=f"edit_time_{event_id}")],
        [InlineKeyboardButton("📍 장소", callback_data=f"edit_location_{event_id}")],
        [InlineKeyboardButton("💰 급여", callback_data=f"edit_pay_{event_id}")],
        [InlineKeyboardButton("💼 근무내용", callback_data=f"edit_work_type_{event_id}")],
        [InlineKeyboardButton("👔 복장", callback_data=f"edit_dress_{event_id}")],
        [InlineKeyboardButton("📞 담당자", callback_data=f"edit_manager_{event_id}")],
        [InlineKeyboardButton("🔙 행사 상세", callback_data=f"event_detail_{event_id}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        f"✏️ 행사 수정\n\n"
        f"행사: {event['title']}\n"
        f"날짜: {event['event_date']}\n\n"
        f"수정할 항목을 선택하세요:",
        reply_markup=reply_markup
    )


# ===== 행사 항목별 수정 핸들러 =====
async def edit_title_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사명 수정 시작"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('edit_title_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return ConversationHandler.END

    context.user_data['edit_event_id'] = event_id
    context.user_data['edit_field'] = 'title'

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="edit_cancel")]]
    await query.edit_message_text(
        f"✏️ 행사명 수정\n\n"
        f"현재: {event['title']}\n\n"
        f"새로운 행사명을 입력하세요:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EDIT_TITLE


async def edit_title_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사명 수정 처리"""
    event_id = context.user_data.get('edit_event_id')
    new_title = update.message.text.strip()

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET title = ? WHERE id = ?", (new_title, event_id))
            conn.commit()

        keyboard = [[InlineKeyboardButton("✅ 확인", callback_data=f"event_detail_{event_id}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"✅ 행사명이 수정되었습니다.\n\n"
            f"새 행사명: {new_title}",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} title updated to: {new_title}")

    except Exception as e:
        logger.error(f"Failed to update event title: {e}")
        await update.message.reply_text(f"❌ 수정 실패: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def edit_date_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """날짜 수정 시작"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('edit_date_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return ConversationHandler.END

    context.user_data['edit_event_id'] = event_id

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="edit_cancel")]]
    await query.edit_message_text(
        f"✏️ 날짜 수정\n\n"
        f"현재: {event['event_date']}\n\n"
        f"새로운 날짜를 MMDD 형식으로 입력하세요:\n"
        f"예시) 0125 → 01월 25일",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EDIT_DATE


async def edit_date_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """날짜 수정 처리"""
    event_id = context.user_data.get('edit_event_id')
    date_input = update.message.text.strip()

    # MMDD 형식 검증
    if len(date_input) != 4 or not date_input.isdigit():
        await update.message.reply_text("❌ 잘못된 형식입니다. MMDD 형식으로 입력하세요 (예: 0125)")
        return EDIT_DATE

    month = date_input[:2]
    day = date_input[2:]
    formatted_date = f"{month}월 {day}일"

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET event_date = ? WHERE id = ?", (formatted_date, event_id))
            conn.commit()

        keyboard = [[InlineKeyboardButton("✅ 확인", callback_data=f"event_detail_{event_id}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"✅ 날짜가 수정되었습니다.\n\n"
            f"새 날짜: {formatted_date}",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} date updated to: {formatted_date}")

    except Exception as e:
        logger.error(f"Failed to update event date: {e}")
        await update.message.reply_text(f"❌ 수정 실패: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def edit_time_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """시간 수정 시작"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('edit_time_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return ConversationHandler.END

    context.user_data['edit_event_id'] = event_id

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="edit_cancel")]]
    await query.edit_message_text(
        f"✏️ 시간 수정\n\n"
        f"현재: {event['event_time']}\n\n"
        f"새로운 시간을 입력하세요:\n"
        f"예시) 0900~2100",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EDIT_TIME


async def edit_time_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """시간 수정 처리"""
    event_id = context.user_data.get('edit_event_id')
    new_time = update.message.text.strip()

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET event_time = ? WHERE id = ?", (new_time, event_id))
            conn.commit()

        keyboard = [[InlineKeyboardButton("✅ 확인", callback_data=f"event_detail_{event_id}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"✅ 시간이 수정되었습니다.\n\n"
            f"새 시간: {new_time}",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} time updated to: {new_time}")

    except Exception as e:
        logger.error(f"Failed to update event time: {e}")
        await update.message.reply_text(f"❌ 수정 실패: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def edit_location_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """장소 수정 시작"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('edit_location_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return ConversationHandler.END

    context.user_data['edit_event_id'] = event_id

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="edit_cancel")]]
    await query.edit_message_text(
        f"✏️ 장소 수정\n\n"
        f"현재: {event['location']}\n\n"
        f"새로운 장소를 입력하세요:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EDIT_LOCATION


async def edit_location_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """장소 수정 처리"""
    event_id = context.user_data.get('edit_event_id')
    new_location = update.message.text.strip()

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET location = ? WHERE id = ?", (new_location, event_id))
            conn.commit()

        keyboard = [[InlineKeyboardButton("✅ 확인", callback_data=f"event_detail_{event_id}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"✅ 장소가 수정되었습니다.\n\n"
            f"새 장소: {new_location}",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} location updated to: {new_location}")

    except Exception as e:
        logger.error(f"Failed to update event location: {e}")
        await update.message.reply_text(f"❌ 수정 실패: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def edit_pay_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """급여 수정 시작"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('edit_pay_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return ConversationHandler.END

    context.user_data['edit_event_id'] = event_id

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="edit_cancel")]]
    await query.edit_message_text(
        f"✏️ 급여 수정\n\n"
        f"현재: {event['pay_description']}\n"
        f"금액: {event['pay_amount']:,}원\n\n"
        f"새로운 급여를 입력하세요:\n"
        f"예시) 15만원 (3.3% 공제 후 지급)",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EDIT_PAY


async def edit_pay_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """급여 수정 처리"""
    event_id = context.user_data.get('edit_event_id')
    pay_text = update.message.text.strip()

    # 금액 추출
    import re
    numbers = re.findall(r'\d+', pay_text.replace(',', ''))
    pay_amount = int(numbers[0]) * 10000 if numbers else 0

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE events SET pay_description = ?, pay_amount = ? WHERE id = ?",
                (pay_text, pay_amount, event_id)
            )
            conn.commit()

        keyboard = [[InlineKeyboardButton("✅ 확인", callback_data=f"event_detail_{event_id}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"✅ 급여가 수정되었습니다.\n\n"
            f"새 급여: {pay_text}\n"
            f"금액: {pay_amount:,}원",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} pay updated to: {pay_text} ({pay_amount}원)")

    except Exception as e:
        logger.error(f"Failed to update event pay: {e}")
        await update.message.reply_text(f"❌ 수정 실패: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def edit_work_type_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """근무 내용 수정 시작"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('edit_work_type_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return ConversationHandler.END

    context.user_data['edit_event_id'] = event_id

    current_work_type = event.get('work_type', '미입력')
    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="edit_cancel")]]
    await query.edit_message_text(
        f"✏️ 근무 내용 수정\n\n"
        f"현재: {current_work_type}\n\n"
        f"새로운 근무 내용을 입력하세요:\n"
        f"예시) 발렛, 경호, 스탭",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EDIT_WORK_TYPE


async def edit_work_type_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """근무 내용 수정 처리"""
    event_id = context.user_data.get('edit_event_id')
    new_work_type = update.message.text.strip()

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET work_type = ? WHERE id = ?", (new_work_type, event_id))
            conn.commit()

        keyboard = [[InlineKeyboardButton("✅ 확인", callback_data=f"event_detail_{event_id}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"✅ 근무 내용이 수정되었습니다.\n\n"
            f"새 근무내용: {new_work_type}",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} work_type updated to: {new_work_type}")

    except Exception as e:
        logger.error(f"Failed to update event work_type: {e}")
        await update.message.reply_text(f"❌ 수정 실패: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def edit_dress_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """복장 수정 시작"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('edit_dress_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return ConversationHandler.END

    context.user_data['edit_event_id'] = event_id

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="edit_cancel")]]
    await query.edit_message_text(
        f"✏️ 복장 수정\n\n"
        f"현재: {event['dress_code']}\n\n"
        f"새로운 복장/요구사항을 입력하세요:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EDIT_DRESS


async def edit_dress_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """복장 수정 처리"""
    event_id = context.user_data.get('edit_event_id')
    new_dress = update.message.text.strip()

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET dress_code = ? WHERE id = ?", (new_dress, event_id))
            conn.commit()

        keyboard = [[InlineKeyboardButton("✅ 확인", callback_data=f"event_detail_{event_id}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"✅ 복장이 수정되었습니다.\n\n"
            f"새 복장: {new_dress}",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} dress_code updated to: {new_dress}")

    except Exception as e:
        logger.error(f"Failed to update event dress: {e}")
        await update.message.reply_text(f"❌ 수정 실패: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def edit_manager_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """담당자 수정 시작"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('edit_manager_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return ConversationHandler.END

    context.user_data['edit_event_id'] = event_id

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="edit_cancel")]]
    await query.edit_message_text(
        f"✏️ 담당자 수정\n\n"
        f"현재: {event['manager_name']}\n\n"
        f"새로운 담당자 정보를 입력하세요:\n"
        f"예시) 김철수 010-1234-5678",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

    return EDIT_MANAGER


async def edit_manager_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """담당자 수정 처리"""
    event_id = context.user_data.get('edit_event_id')
    new_manager = update.message.text.strip()

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET manager_name = ? WHERE id = ?", (new_manager, event_id))
            conn.commit()

        keyboard = [[InlineKeyboardButton("✅ 확인", callback_data=f"event_detail_{event_id}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"✅ 담당자가 수정되었습니다.\n\n"
            f"새 담당자: {new_manager}",
            reply_markup=reply_markup
        )

        logger.info(f"Event {event_id} manager updated to: {new_manager}")

    except Exception as e:
        logger.error(f"Failed to update event manager: {e}")
        await update.message.reply_text(f"❌ 수정 실패: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


async def edit_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """수정 취소"""
    if update.callback_query:
        query = update.callback_query
        await query.answer()
        await query.edit_message_text("❌ 수정이 취소되었습니다.")
    else:
        await update.message.reply_text("❌ 수정이 취소되었습니다.")
    context.user_data.clear()
    return ConversationHandler.END


# ===== 행사 목록 =====
async def event_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 목록 조회"""
    query = update.callback_query
    if query:
        await query.answer()

    events = db.list_events(limit=20)

    if not events:
        text = "📋 등록된 행사가 없습니다."
        keyboard = [[InlineKeyboardButton("➕ 행사 등록", callback_data="event_register")]]
    else:
        text = f"📋 행사 목록 (총 {len(events)}건)\n\n행사를 선택하세요:"
        keyboard = []

        for event in events:
            # 지원자 수 조회
            apps = db.list_applications_by_event(event['id'])
            status_emoji = {"OPEN": "🟢", "CLOSED": "🔴", "COMPLETED": "✅"}.get(event['status'], "⚪")
            # 제목 표시 (너무 길면 자르기)
            title = event['title'][:15] + ".." if len(event['title']) > 15 else event['title']
            button_text = f"{status_emoji} {title} ({event['event_date']}) - {len(apps)}명"
            # 행사 상세 페이지로 이동 (모집글 표시)
            keyboard.append([InlineKeyboardButton(button_text, callback_data=f"event_detail_{event['id']}")])

        keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)

    if query:
        await query.edit_message_text(text, reply_markup=reply_markup)
    else:
        await update.message.reply_text(text, reply_markup=reply_markup)


# ===== 지원자 관리 (간략 버전) =====
async def manage_applications(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """지원자 관리 메뉴"""
    query = update.callback_query
    await query.answer()

    # 최근 행사 목록
    events = db.list_events(status='OPEN', limit=10)

    if not events:
        await query.edit_message_text("🔍 모집 중인 행사가 없습니다.")
        return

    keyboard = []
    for event in events:
        # 지원자 수 조회
        apps = db.list_applications_by_event(event['id'])
        button_text = f"{event['short_code']} - 지원자 {len(apps)}명"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=f"app_list_{event['id']}")])

    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text("👥 행사를 선택하여 지원자를 확인하세요:", reply_markup=reply_markup)


# ===== 지원자 목록 =====
async def app_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사별 지원자 목록"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('app_list_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return

    apps = db.list_applications_by_event(event_id)

    if not apps:
        text = f"📋 {event['title']}\n\n지원자가 없습니다."
        keyboard = [[InlineKeyboardButton("🔙 돌아가기", callback_data="manage_applications")]]
    else:
        # 상태별 집계
        pending = [a for a in apps if a['status'] == 'PENDING']
        confirmed = [a for a in apps if a['status'] == 'CONFIRMED']
        rejected = [a for a in apps if a['status'] == 'REJECTED']

        text = f"📋 {event['title']} ({event['event_date']}) - 지원자 목록\n\n"
        text += f"⏳ 대기: {len(pending)}명\n"
        text += f"✅ 확정: {len(confirmed)}명\n"
        text += f"❌ 불합격: {len(rejected)}명\n"
        text += f"━━━━━━━━━━━━━━━━\n"

        keyboard = []
        for app in apps[:20]:
            status_text = {
                'PENDING': '(대기)',
                'CONFIRMED': '(확정)',
                'REJECTED': '(불합격)',
                'WAITLIST': '(대기명단)'
            }.get(app['status'], '(?)')

            button_text = f"{app['name']} {status_text}"
            keyboard.append([InlineKeyboardButton(button_text, callback_data=f"app_detail_{app['id']}")])

        keyboard.append([InlineKeyboardButton("🔙 돌아가기", callback_data="manage_applications")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


# ===== 지원자 상세 및 액션 =====
async def app_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """지원자 상세"""
    query = update.callback_query
    await query.answer()

    app_id = int(query.data.replace('app_detail_', ''))
    app = db.get_application(app_id)

    if not app:
        await query.edit_message_text("❌ 지원 정보를 찾을 수 없습니다.")
        return

    status_text = {
        'PENDING': '⏳ 대기 중',
        'CONFIRMED': '✅ 확정됨',
        'REJECTED': '❌ 불합격',
        'WAITLIST': '⏸ 대기 명단'
    }.get(app['status'], app['status'])

    text = f"""
📋 지원자 상세 정보

이름: {app['worker_name']}
생년월일: {app.get('worker_birth_date') or '미입력'}
전화번호: {app['worker_phone']}
거주지역: {app.get('worker_residence') or '미입력'}
얼굴사진: {'등록완료' if app.get('worker_face_photo_file_id') else '미등록'}
운전면허: {'있음' if app.get('worker_driver_license') else '없음'}
경호이수증: {'있음' if app.get('worker_security_cert') else '없음'}
은행: {app.get('worker_bank_name') or '미입력'}
계좌번호: {app.get('worker_bank_account') or '미입력'}
프리랜서용역계약서: {'작성완료' if app.get('worker_contract_signed') else '미작성'}
행사: {app['event_title']}

상태: {status_text}
지원일: {app['applied_at']}
"""

    if app['confirmed_at']:
        # Remove decimal seconds from timestamp
        confirmed_at = app['confirmed_at'].split('.')[0] if '.' in app['confirmed_at'] else app['confirmed_at']
        text += f"확정일: {confirmed_at}\n"

    keyboard = []

    # 얼굴사진 보기 버튼 (사진이 있을 경우)
    if app.get('worker_face_photo_file_id'):
        keyboard.append([InlineKeyboardButton("📸 얼굴사진 보기", callback_data=f"view_photo_{app_id}")])

    if app['status'] == 'PENDING':
        keyboard.append([InlineKeyboardButton("✅ 확정하기", callback_data=f"app_confirm_{app_id}")])
        keyboard.append([InlineKeyboardButton("⏸ 대기 명단", callback_data=f"app_waitlist_{app_id}")])
        keyboard.append([InlineKeyboardButton("❌ 불합격", callback_data=f"app_reject_{app_id}")])
    elif app['status'] == 'WAITLIST':
        keyboard.append([InlineKeyboardButton("✅ 확정하기", callback_data=f"app_confirm_{app_id}")])
        keyboard.append([InlineKeyboardButton("❌ 불합격", callback_data=f"app_reject_{app_id}")])
    elif app['status'] == 'CONFIRMED':
        keyboard.append([InlineKeyboardButton("🔄 확정 취소", callback_data=f"app_unconfirm_{app_id}")])

    keyboard.append([InlineKeyboardButton("🔙 목록으로", callback_data=f"app_list_{app['event_id']}")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


# ===== 지원자 확정 =====
async def app_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """지원자 확정 처리"""
    query = update.callback_query
    await query.answer()

    app_id = int(query.data.replace('app_confirm_', ''))
    app = db.get_application(app_id)

    if not app:
        await query.edit_message_text("❌ 지원 정보를 찾을 수 없습니다.")
        return

    # 확정 처리
    db.update_application_status(app_id, 'CONFIRMED', confirmed_by=update.effective_user.id)

    # 출석 레코드 생성
    check_in_code = generate_check_in_code()
    db.create_attendance(
        application_id=app_id,
        event_id=app['event_id'],
        worker_id=app['worker_id'],
        check_in_code=check_in_code
    )

    # 근무자에게 알림 발송
    try:
        event = db.get_event(app['event_id'])

        notification_text = (
            "✅ 근무 확정\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📌 {event['title']}\n\n"
            f"📅 {event['event_date']}\n"
            f"⏰ {event['event_time']}\n"
            f"📍 {event['location']}\n"
            f"💰 {event['pay_amount']:,}원\n\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔐 출석 코드: {check_in_code}\n\n"
            "당일 출근 시 위 코드를 입력해주세요."
        )

        await worker_bot.send_message(
            chat_id=app['worker_telegram_id'],
            text=notification_text
        )

        db.mark_application_notified(app_id)
        logger.info(f"Notification sent to worker {app['worker_id']} for app {app_id}")

    except Exception as e:
        logger.error(f"Failed to send notification: {e}")

    keyboard = [[InlineKeyboardButton("← 메인", callback_data="main_menu")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        "✅ 확정 완료\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"👤 {app['worker_name']}\n"
        f"📌 {app['event_title']}\n"
        f"🔐 {check_in_code}\n\n"
        "알림이 발송되었습니다.",
        reply_markup=reply_markup
    )


# ===== 얼굴사진 보기 =====
async def view_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """지원자 얼굴사진 보기"""
    query = update.callback_query
    await query.answer()

    app_id = int(query.data.replace('view_photo_', ''))
    app = db.get_application(app_id)

    if not app or not app.get('worker_face_photo_file_id'):
        await query.edit_message_text("❌ 사진을 찾을 수 없습니다.")
        return

    # 사진 전송 - 파일 경로 또는 file_id 사용
    try:
        photo_path = app['worker_face_photo_file_id']

        # 파일 경로인지 file_id인지 확인
        if photo_path and os.path.exists(photo_path):
            # 로컬 파일 전송
            with open(photo_path, 'rb') as photo_file:
                await context.bot.send_photo(
                    chat_id=query.message.chat_id,
                    photo=photo_file,
                    caption=f"📸 {app['worker_name']}님의 얼굴사진"
                )
        else:
            # file_id로 전송 (레거시 지원)
            await context.bot.send_photo(
                chat_id=query.message.chat_id,
                photo=photo_path,
                caption=f"📸 {app['worker_name']}님의 얼굴사진"
            )

        await query.answer("사진을 전송했습니다.")
    except Exception as e:
        logger.error(f"Failed to send photo: {e}")
        await query.answer("❌ 사진 전송 실패", show_alert=True)


# ===== 확정 취소 =====
async def app_unconfirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """확정 취소 처리"""
    query = update.callback_query
    await query.answer()

    app_id = int(query.data.replace('app_unconfirm_', ''))
    app = db.get_application(app_id)

    if not app:
        await query.answer("❌ 지원 내역을 찾을 수 없습니다.", show_alert=True)
        return

    # 출석 기록이 있는지 확인
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM attendance
            WHERE event_id = ? AND worker_id = ?
        """, (app['event_id'], app['worker_id']))
        attendance = cursor.fetchone()

    if attendance:
        attendance = dict(attendance)
        # 이미 출석한 경우 취소 불가
        if attendance['status'] in ['CHECKED_IN', 'COMPLETED']:
            await query.answer("❌ 이미 출석한 근무자는 확정 취소가 불가능합니다.", show_alert=True)
            return

        # 출석 기록 삭제
        cursor.execute("DELETE FROM attendance WHERE id = ?", (attendance['id'],))
        conn.commit()
        logger.info(f"Attendance deleted: attendance_id={attendance['id']}")

    # 지원 상태를 PENDING으로 변경
    db.update_application_status(app_id, 'PENDING')

    # 근무자에게 알림 발송
    try:
        event = db.get_event(app['event_id'])
        notification_text = f"""
⚠️ 확정 취소 알림

(주)엘케이프라이빗

📋 행사: {event['title']}
📅 날짜: {event['event_date']}

확정이 취소되었습니다.
관리자에게 문의하시기 바랍니다.
"""

        await worker_bot.send_message(
            chat_id=app['worker_telegram_id'],
            text=notification_text
        )
        logger.info(f"Unconfirm notification sent to worker {app['worker_id']} for app {app_id}")
    except Exception as e:
        logger.error(f"Failed to send unconfirm notification: {e}")

    keyboard = [
        [InlineKeyboardButton("🔙 지원자 상세", callback_data=f"app_detail_{app_id}")],
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        f"✅ 확정이 취소되었습니다.\n\n"
        f"근무자: {app['worker_name']}\n"
        f"행사: {app['event_title']}\n\n"
        f"지원 상태가 '대기중'으로 변경되었습니다.\n"
        f"출석 기록이 삭제되었습니다.",
        reply_markup=reply_markup
    )


# ===== 지원자 대기/불합격 =====
async def app_waitlist(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """대기 명단 처리"""
    query = update.callback_query
    await query.answer()

    app_id = int(query.data.replace('app_waitlist_', ''))
    db.update_application_status(app_id, 'WAITLIST')

    await query.edit_message_text("⏸ 대기 명단으로 이동되었습니다.")


async def app_reject(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """불합격 처리"""
    query = update.callback_query
    await query.answer()

    app_id = int(query.data.replace('app_reject_', ''))
    db.update_application_status(app_id, 'REJECTED', rejection_reason='관리자 불합격 처리')

    await query.edit_message_text("❌ 불합격 처리되었습니다.")


# ===== 근무자 관리 =====
async def manage_workers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """근무자 관리 - 전체 근무자 목록"""
    query = update.callback_query
    await query.answer()

    # 모든 근무자 조회 (제한 없음)
    workers = db.list_workers(limit=999999)

    if not workers:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("👷 등록된 근무자가 없습니다.", reply_markup=reply_markup)
        return

    text = f"👷 등록된 근무자 목록 ({len(workers)}명)\n\n"
    text += "근무자를 선택하여 상세 정보를 확인하세요:"

    keyboard = []
    for worker in workers:  # 모든 근무자 표시
        button_text = f"👤 {worker['name']} ({worker['phone']})"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=f"worker_detail_{worker['id']}")])

    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(text, reply_markup=reply_markup)


async def worker_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """근무자 상세 정보"""
    query = update.callback_query
    await query.answer()

    worker_id = int(query.data.replace('worker_detail_', ''))

    # 근무자 정보 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
        worker = cursor.fetchone()

    if not worker:
        await query.edit_message_text("❌ 근무자를 찾을 수 없습니다.")
        return

    worker = dict(worker)

    # 근무자의 지원/확정 이력 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) as total_apps,
                   SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_count
            FROM applications
            WHERE worker_id = ?
        """, (worker_id,))
        stats = cursor.fetchone()

    total_apps = stats['total_apps'] if stats else 0
    confirmed_count = stats['confirmed_count'] if stats else 0

    text = f"""
👷 근무자 상세 정보

📋 기본 정보
━━━━━━━━━━━━━━━━
이름: {worker['name']}
생년월일: {worker.get('birth_date') or '미입력'}
전화번호: {worker['phone']}
거주지역: {worker.get('residence') or '미입력'}

📋 자격 정보
━━━━━━━━━━━━━━━━
운전면허: {'있음' if worker.get('driver_license') else '없음'}
경호이수증: {'있음' if worker.get('security_cert') else '없음'}
얼굴사진: {'등록완료' if worker.get('face_photo_file_id') else '미등록'}

💰 급여 정보
━━━━━━━━━━━━━━━━
은행: {worker.get('bank_name') or '미입력'}
계좌번호: {worker.get('bank_account') or '미입력'}

📊 활동 이력
━━━━━━━━━━━━━━━━
총 지원: {total_apps}건
확정된 근무: {confirmed_count}건

📅 등록일: {worker['created_at'][:16] if worker.get('created_at') else '알 수 없음'}
"""

    keyboard = []

    # 얼굴사진 보기 버튼
    if worker.get('face_photo_file_id'):
        keyboard.append([InlineKeyboardButton("📸 얼굴사진 보기", callback_data=f"view_worker_photo_{worker_id}")])

    keyboard.append([InlineKeyboardButton("🔙 근무자 목록", callback_data="manage_workers")])
    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


# ===== 출석 관리 =====
async def manage_attendance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """출석 관리 메뉴"""
    query = update.callback_query
    await query.answer()

    # 최근 행사 목록
    events = db.list_events(limit=10)

    if not events:
        await query.edit_message_text("📊 등록된 행사가 없습니다.")
        return

    keyboard = []
    for event in events:
        button_text = f"{event['short_code']} - {event['title']}"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=f"attendance_list_{event['id']}")])

    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text("📊 행사를 선택하여 출석 현황을 확인하세요:", reply_markup=reply_markup)


async def attendance_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사별 출석 현황"""
    query = update.callback_query
    await query.answer()

    # 기존 메시지 삭제
    try:
        await query.message.delete()
    except Exception as e:
        logger.warning(f"Failed to delete message: {e}")

    event_id = int(query.data.replace('attendance_list_', ''))
    event = db.get_event(event_id)

    if not event:
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="❌ 행사를 찾을 수 없습니다."
        )
        return

    attendances = db.list_attendance_by_event(event_id)

    if not attendances:
        text = f"📊 {event['title']}\n\n확정된 근무자가 없습니다."
        keyboard = [[InlineKeyboardButton("🔙 돌아가기", callback_data="manage_attendance")]]
    else:
        # 상태별 집계
        pending = [a for a in attendances if a['status'] == 'PENDING']
        checked_in = [a for a in attendances if a['status'] == 'CHECKED_IN']
        completed = [a for a in attendances if a['status'] == 'COMPLETED']

        text = f"📊 {event['title']} - 출석 현황\n\n"
        text += f"⏳ 대기: {len(pending)}명\n"
        text += f"✅ 출근완료: {len(checked_in)}명\n"
        text += f"🎉 퇴근완료: {len(completed)}명\n"
        text += f"━━━━━━━━━━━━━━━━\n\n"
        text += f"근무자를 선택하여 상세 정보를 확인하세요:"

        keyboard = []
        for att in attendances[:20]:
            status_text = {
                'PENDING': '(대기)',
                'CHECKED_IN': '(출근완료)',
                'COMPLETED': '(퇴근완료)'
            }.get(att['status'], '(?)')

            button_text = f"{att['worker_name']} {status_text}"
            keyboard.append([InlineKeyboardButton(button_text, callback_data=f"attendance_detail_{att['id']}")])

        keyboard.append([InlineKeyboardButton("🔙 돌아가기", callback_data="manage_attendance")])
        keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await context.bot.send_message(
        chat_id=query.message.chat_id,
        text=text,
        reply_markup=reply_markup
    )


async def attendance_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """출석 상세 정보 및 수동 처리"""
    query = update.callback_query
    await query.answer()

    attendance_id = int(query.data.replace('attendance_detail_', ''))

    # 출석 정보 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*,
                   w.name as worker_name,
                   w.phone as worker_phone,
                   w.face_photo_file_id,
                   e.title as event_title,
                   e.event_date,
                   e.event_time
            FROM attendance a
            JOIN workers w ON a.worker_id = w.id
            JOIN events e ON a.event_id = e.id
            WHERE a.id = ?
        """, (attendance_id,))
        att = cursor.fetchone()

    if not att:
        await query.edit_message_text("❌ 출석 정보를 찾을 수 없습니다.")
        return

    att = dict(att)

    status_text = {
        'PENDING': '⏳ 대기',
        'CHECKED_IN': '✅ 출근완료',
        'COMPLETED': '🎉 퇴근완료'
    }.get(att['status'], att['status'])

    check_in = att['check_in_time'].split('.')[0] if att['check_in_time'] else '미체크'
    check_out = att['check_out_time'].split('.')[0] if att['check_out_time'] else '미체크'

    text = f"""
📊 출석 상세 정보

👤 이름: {att['worker_name']}
📞 전화번호: {att['worker_phone']}
📋 행사: {att['event_title']}
📅 날짜: {att['event_date']}
⏰ 시간: {att['event_time']}

━━━━━━━━━━━━━━━━
상태: {status_text}
출근: {check_in}
퇴근: {check_out}
"""

    keyboard = []

    # 얼굴사진 보기 버튼
    if att.get('face_photo_file_id'):
        keyboard.append([InlineKeyboardButton("📸 얼굴사진 보기", callback_data=f"view_worker_photo_{att['worker_id']}")])

    # 상태별 처리 버튼
    if att['status'] == 'PENDING':
        keyboard.append([InlineKeyboardButton("✅ 출석 처리", callback_data=f"manual_checkin_{attendance_id}")])
    elif att['status'] == 'CHECKED_IN':
        keyboard.append([InlineKeyboardButton("🎉 퇴근 처리", callback_data=f"manual_checkout_{attendance_id}")])

    keyboard.append([InlineKeyboardButton("🔙 출석 목록", callback_data=f"attendance_list_{att['event_id']}")])
    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def manual_checkin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """수동 출석 처리"""
    query = update.callback_query
    await query.answer()

    attendance_id = int(query.data.replace('manual_checkin_', ''))

    # 출석 처리 (한국 시간)
    now = now_kst_str()

    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 출석 정보와 근무자 정보 조회
        cursor.execute("""
            SELECT a.event_id, a.worker_id, w.telegram_id, w.name, e.title as event_title
            FROM attendance a
            JOIN workers w ON a.worker_id = w.id
            JOIN events e ON a.event_id = e.id
            WHERE a.id = ?
        """, (attendance_id,))
        att = cursor.fetchone()

        if not att:
            await query.answer("❌ 출석 정보를 찾을 수 없습니다.", show_alert=True)
            return

        att = dict(att)
        event_id = att['event_id']
        worker_telegram_id = att['telegram_id']
        worker_name = att['name']
        event_title = att['event_title']

        cursor.execute("""
            UPDATE attendance
            SET status = 'CHECKED_IN', check_in_time = ?
            WHERE id = ?
        """, (now, attendance_id))
        conn.commit()

    await query.answer("✅ 출석 처리 완료!", show_alert=True)

    # 근무자에게 알림 전송 (근무자 봇으로)
    try:
        await worker_bot.send_message(
            chat_id=worker_telegram_id,
            text=f"✅ 출근완료 알림\n\n"
                 f"📋 행사: {event_title}\n"
                 f"⏰ 출근시간: {now}\n\n"
                 f"근무를 시작해주세요!"
        )
    except Exception as e:
        logger.error(f"Failed to send check-in notification to worker {worker_name}: {e}")

    # 기존 메시지 삭제
    try:
        await query.message.delete()
    except Exception as e:
        logger.warning(f"Failed to delete message: {e}")

    # 출석 목록 다시 표시
    # 출석 기록 조회
    attendances = db.list_attendance_by_event(event_id)

    # 상태별 분류
    pending = [a for a in attendances if a['status'] == 'PENDING']
    checked_in = [a for a in attendances if a['status'] == 'CHECKED_IN']
    completed = [a for a in attendances if a['status'] == 'COMPLETED']

    # 행사 정보 조회
    event = db.get_event(event_id)

    text = f"📊 {event['title']} - 출석 현황\n\n"
    text += f"⏳ 대기: {len(pending)}명\n"
    text += f"✅ 출근완료: {len(checked_in)}명\n"
    text += f"🎉 퇴근완료: {len(completed)}명\n"
    text += f"━━━━━━━━━━━━━━━━\n\n"

    if not attendances:
        text += "출석 기록이 없습니다."
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
    else:
        text += "출석자를 선택하세요:"
        keyboard = []
        for att in attendances:
            status_text = {
                'PENDING': '(대기)',
                'CHECKED_IN': '(출근완료)',
                'COMPLETED': '(퇴근완료)'
            }.get(att['status'], '(?)')

            button_text = f"{att['worker_name']} {status_text}"
            keyboard.append([InlineKeyboardButton(button_text, callback_data=f"attendance_detail_{att['id']}")])

        keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await context.bot.send_message(
        chat_id=query.message.chat_id,
        text=text,
        reply_markup=reply_markup
    )


async def manual_checkout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """수동 퇴근 처리"""
    query = update.callback_query
    await query.answer()

    attendance_id = int(query.data.replace('manual_checkout_', ''))

    # 퇴근 처리 (한국 시간)
    now = now_kst_str()

    with db.get_connection() as conn:
        cursor = conn.cursor()
        # 출석 정보와 근무자 정보 조회
        cursor.execute("""
            SELECT a.event_id, a.worker_id, a.check_in_time, w.telegram_id, w.name, e.title as event_title, e.pay_amount
            FROM attendance a
            JOIN workers w ON a.worker_id = w.id
            JOIN events e ON a.event_id = e.id
            WHERE a.id = ?
        """, (attendance_id,))
        att = cursor.fetchone()

        if not att:
            await query.answer("❌ 출석 정보를 찾을 수 없습니다.", show_alert=True)
            return

        att = dict(att)
        event_id = att['event_id']
        worker_id = att['worker_id']
        worker_telegram_id = att['telegram_id']
        worker_name = att['name']
        event_title = att['event_title']
        pay_amount = att['pay_amount']
        check_in_time = att['check_in_time']

        # 근무시간 계산 (KST 기준)
        from datetime import datetime
        check_in_dt = datetime.fromisoformat(check_in_time.split('.')[0])  # microseconds 제거
        check_out_dt = now_kst().replace(tzinfo=None)  # KST 시간 사용, naive datetime으로
        worked_minutes = max(0, int((check_out_dt - check_in_dt).total_seconds() / 60))

        cursor.execute("""
            UPDATE attendance
            SET status = 'COMPLETED', check_out_time = ?, worked_minutes = ?
            WHERE id = ?
        """, (now, worked_minutes, attendance_id))
        conn.commit()

    # 급여 계산 (3.3% 공제)
    net_pay = int(pay_amount * 0.967)

    # 블록체인 기록
    blockchain_msg = ""
    try:
        from chain import polygon_chain
        import hashlib
        import json

        # 출석 정보 다시 조회
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM attendance WHERE id = ?", (attendance_id,))
            attendance = dict(cursor.fetchone())

        # 근무 로그 해시 생성
        log_data = {
            'event_id': attendance['event_id'],
            'worker_id': attendance['worker_id'],
            'check_in_time': str(attendance['check_in_time']),
            'check_out_time': str(attendance['check_out_time']),
            'worked_minutes': attendance['worked_minutes']
        }
        log_hash = hashlib.sha256(json.dumps(log_data, sort_keys=True).encode()).hexdigest()

        from utils import generate_worker_uid_hash
        worker_uid_hash = generate_worker_uid_hash(
            worker_id=attendance['worker_id'],
            salt=os.getenv('SALT_SECRET', 'default_salt')
        )

        # 블록체인에 기록
        result = polygon_chain.record_work_log(
            log_hash=log_hash,
            event_id=attendance['event_id'],
            worker_uid_hash=worker_uid_hash
        )

        if result['success']:
            chain_log_id = db.create_chain_log(
                attendance_id=attendance['id'],
                event_id=attendance['event_id'],
                worker_uid_hash=worker_uid_hash,
                log_hash=log_hash
            )
            db.update_chain_log_tx(
                chain_log_id=chain_log_id,
                tx_hash=result['tx_hash'],
                block_number=result['block_number']
            )
            blockchain_msg = " ⛓️"
            logger.info(f"Blockchain recorded: tx={result['tx_hash']}")
        else:
            logger.warning(f"Blockchain recording failed: {result.get('error')}")
    except Exception as e:
        logger.error(f"Blockchain recording error: {e}")

    await query.answer(f"🎉 퇴근 처리 완료!{blockchain_msg}", show_alert=True)

    # 근무자에게 알림 전송 (근무자 봇으로)
    try:
        await worker_bot.send_message(
            chat_id=worker_telegram_id,
            text=f"🎉 퇴근완료 알림\n\n"
                 f"📋 행사: {event_title}\n"
                 f"⏰ 출근시간: {check_in_time}\n"
                 f"⏰ 퇴근시간: {now}\n"
                 f"💰 지급예정액: {net_pay:,}원 (3.3% 공제 후)\n\n"
                 f"수고하셨습니다!"
        )
    except Exception as e:
        logger.error(f"Failed to send check-out notification to worker {worker_name}: {e}")

    # 기존 메시지 삭제
    try:
        await query.message.delete()
    except Exception as e:
        logger.warning(f"Failed to delete message: {e}")

    # 출석 목록 다시 표시
    # 출석 기록 조회
    attendances = db.list_attendance_by_event(event_id)

    # 상태별 분류
    pending = [a for a in attendances if a['status'] == 'PENDING']
    checked_in = [a for a in attendances if a['status'] == 'CHECKED_IN']
    completed = [a for a in attendances if a['status'] == 'COMPLETED']

    # 행사 정보 조회
    event = db.get_event(event_id)

    text = f"📊 {event['title']} - 출석 현황\n\n"
    text += f"⏳ 대기: {len(pending)}명\n"
    text += f"✅ 출근완료: {len(checked_in)}명\n"
    text += f"🎉 퇴근완료: {len(completed)}명\n"
    text += f"━━━━━━━━━━━━━━━━\n\n"

    if not attendances:
        text += "출석 기록이 없습니다."
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
    else:
        text += "출석자를 선택하세요:"
        keyboard = []
        for att in attendances:
            status_text = {
                'PENDING': '(대기)',
                'CHECKED_IN': '(출근완료)',
                'COMPLETED': '(퇴근완료)'
            }.get(att['status'], '(?)')

            button_text = f"{att['worker_name']} {status_text}"
            keyboard.append([InlineKeyboardButton(button_text, callback_data=f"attendance_detail_{att['id']}")])

        keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await context.bot.send_message(
        chat_id=query.message.chat_id,
        text=text,
        reply_markup=reply_markup
    )


async def view_worker_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """근무자 얼굴사진 보기 (worker_id 기준)"""
    query = update.callback_query
    await query.answer()

    worker_id = int(query.data.replace('view_worker_photo_', ''))

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, face_photo_file_id FROM workers WHERE id = ?", (worker_id,))
        worker = cursor.fetchone()

    if not worker or not worker['face_photo_file_id']:
        await query.answer("❌ 사진을 찾을 수 없습니다.", show_alert=True)
        return

    worker = dict(worker)

    # 사진 전송
    try:
        photo_path = worker['face_photo_file_id']

        # 파일 경로인지 file_id인지 확인
        if photo_path and os.path.exists(photo_path):
            # 로컬 파일 전송
            with open(photo_path, 'rb') as photo_file:
                await context.bot.send_photo(
                    chat_id=query.message.chat_id,
                    photo=photo_file,
                    caption=f"📸 {worker['name']}님의 얼굴사진"
                )
        else:
            # file_id로 전송 (레거시 지원)
            await context.bot.send_photo(
                chat_id=query.message.chat_id,
                photo=photo_path,
                caption=f"📸 {worker['name']}님의 얼굴사진"
            )

        await query.answer("사진을 전송했습니다.")
    except Exception as e:
        logger.error(f"Failed to send worker photo: {e}")
        await query.answer("❌ 사진 전송 실패", show_alert=True)


# ===== 엑셀 다운로드 =====
async def export_payroll(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """엑셀 다운로드 메뉴"""
    query = update.callback_query
    await query.answer()

    # 완료된 행사 목록
    events = db.list_events(status='COMPLETED', limit=10)

    if not events:
        # 모든 행사 조회
        events = db.list_events(limit=10)

    if not events:
        await query.edit_message_text("💰 다운로드할 행사가 없습니다.")
        return

    keyboard = []
    for event in events:
        button_text = f"{event['short_code']} - {event['title']}"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=f"export_{event['id']}")])

    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text("💰 엑셀 다운로드할 행사를 선택하세요:", reply_markup=reply_markup)


async def export_event_payroll(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사별 엑셀 생성 및 전송"""
    query = update.callback_query
    await query.answer("엑셀 생성 중...")

    event_id = int(query.data.replace('export_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return

    # 출석 기록 조회
    attendances = db.list_attendance_by_event(event_id)

    if not attendances:
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 출석 기록이 없습니다.", reply_markup=reply_markup)
        return

    # 근무자 정보 조회 (attendance에 이미 worker 정보가 join되어 있음)
    workers = {}
    for att in attendances:
        workers[att['worker_id']] = {
            'name': att['worker_name'],
            'phone': att['phone'],
            'birth_date': att.get('birth_date'),
            'bank_name': att.get('bank_name'),
            'bank_account': att.get('bank_account'),
            'residence': att.get('residence'),
            'face_photo_file_id': att.get('face_photo_file_id'),
            'driver_license': att.get('driver_license'),
            'security_cert': att.get('security_cert')
        }

    try:
        # 엑셀 생성
        filepath = payroll_exporter.generate_event_payroll(event, attendances, workers)

        # 파일 전송
        with open(filepath, 'rb') as f:
            await context.bot.send_document(
                chat_id=update.effective_user.id,
                document=f,
                caption=f"💰 {event['title']} 급여 명세서\n\n"
                        f"총 {len(attendances)}명"
            )

        # DB에 기록
        # (payroll_exports 테이블에 저장 - 선택 사항)

        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await query.edit_message_text(
            f"✅ 엑셀 파일이 생성되었습니다!\n\n"
            f"📋 행사: {event['title']}\n"
            f"👥 인원: {len(attendances)}명\n"
            f"📂 파일: {os.path.basename(filepath)}",
            reply_markup=reply_markup
        )

    except Exception as e:
        logger.error(f"Failed to export payroll: {e}")
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(f"❌ 엑셀 생성 실패: {str(e)}", reply_markup=reply_markup)


# ===== 블록체인 메뉴 =====
async def blockchain_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """블록체인 메인 메뉴"""
    query = update.callback_query
    await query.answer()

    # 블록체인 연결 상태 확인
    is_connected = polygon_chain.is_connected()
    balance = polygon_chain.get_balance() if is_connected else 0.0
    network = polygon_chain.network if polygon_chain.enabled else "N/A"

    status_text = "🟢 연결됨" if is_connected else "🔴 연결 안됨"

    text = f"""
⛓️ 블록체인 관리

━━━━━━━━━━━━━━━━
📡 네트워크 상태
━━━━━━━━━━━━━━━━
• 상태: {status_text}
• 네트워크: {network.upper()}
• 잔액: {balance:.4f} MATIC
• 주소: {polygon_chain.account.address if polygon_chain.enabled else 'N/A'}

아래 메뉴를 선택하세요:
"""

    keyboard = [
        [InlineKeyboardButton("📊 블록체인 기록 조회", callback_data="blockchain_records")],
        [InlineKeyboardButton("🔍 트랜잭션 확인", callback_data="blockchain_transactions")],
        [InlineKeyboardButton("✅ 검증하기", callback_data="blockchain_verify")],
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(text, reply_markup=reply_markup)


async def blockchain_records(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """블록체인 기록 조회 - 근무자별"""
    query = update.callback_query
    await query.answer()

    # DB에서 chain_logs 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                cl.id,
                cl.event_id,
                w.name as worker_name,
                e.title as event_title,
                cl.tx_hash,
                cl.block_number,
                cl.recorded_at
            FROM chain_logs cl
            LEFT JOIN attendance a ON cl.attendance_id = a.id
            LEFT JOIN workers w ON a.worker_id = w.id
            LEFT JOIN events e ON cl.event_id = e.id
            ORDER BY cl.recorded_at DESC
            LIMIT 20
        """)
        records = [dict(row) for row in cursor.fetchall()]

    if not records:
        text = "⛓️ 블록체인 기록 조회\n\n기록이 없습니다."
        keyboard = [[InlineKeyboardButton("🔙 돌아가기", callback_data="blockchain_menu")]]
    else:
        text = f"⛓️ 블록체인 기록 조회 (최근 {len(records)}건)\n\n"

        for record in records[:10]:
            tx_hash_short = record['tx_hash'][:10] + "..." if record['tx_hash'] else "N/A"
            text += f"━━━━━━━━━━━━━━━━\n"
            text += f"👤 {record['worker_name']}\n"
            text += f"📋 {record['event_title']}\n"
            text += f"🔗 TX: {tx_hash_short}\n"
            text += f"📦 Block: #{record['block_number']}\n"
            text += f"📅 {record['recorded_at'][:16]}\n"

        keyboard = [
            [InlineKeyboardButton("🔙 블록체인 메뉴", callback_data="blockchain_menu")],
            [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]
        ]

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def blockchain_transactions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """최근 트랜잭션 확인"""
    query = update.callback_query
    await query.answer()

    # DB에서 최근 트랜잭션 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                tx_hash,
                block_number,
                recorded_at
            FROM chain_logs
            WHERE tx_hash IS NOT NULL
            ORDER BY recorded_at DESC
            LIMIT 10
        """)
        transactions = [dict(row) for row in cursor.fetchall()]

    if not transactions:
        text = "🔍 최근 트랜잭션\n\n트랜잭션이 없습니다."
        keyboard = [[InlineKeyboardButton("🔙 돌아가기", callback_data="blockchain_menu")]]
    else:
        text = f"🔍 최근 트랜잭션 ({len(transactions)}건)\n\n"

        for tx in transactions:
            tx_hash = tx['tx_hash']
            explorer_url = polygon_chain.get_block_explorer_url(tx_hash)

            text += f"━━━━━━━━━━━━━━━━\n"
            text += f"🔗 TX: {tx_hash[:16]}...\n"
            text += f"📦 Block: #{tx['block_number']}\n"
            text += f"📅 {tx['recorded_at'][:16]}\n"
            text += f"🌐 {explorer_url}\n"

        keyboard = [
            [InlineKeyboardButton("🔙 블록체인 메뉴", callback_data="blockchain_menu")],
            [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]
        ]

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def blockchain_verify(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """블록체인 검증 - 행사별"""
    query = update.callback_query
    await query.answer()

    # 최근 완료된 행사 목록
    events = db.list_events(status='COMPLETED', limit=10)

    if not events:
        # 모든 행사 조회
        events = db.list_events(limit=10)

    if not events:
        text = "✅ 블록체인 검증\n\n검증할 행사가 없습니다."
        keyboard = [[InlineKeyboardButton("🔙 돌아가기", callback_data="blockchain_menu")]]
    else:
        text = "✅ 블록체인 검증\n\n검증할 행사를 선택하세요:"
        keyboard = []

        for event in events:
            # 해당 행사의 블록체인 기록 수 조회
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM chain_logs
                    WHERE event_id = ?
                """, (event['id'],))
                chain_count = cursor.fetchone()['count']

            button_text = f"{event['short_code']} - 체인기록 {chain_count}건"
            keyboard.append([InlineKeyboardButton(button_text, callback_data=f"verify_event_{event['id']}")])

        keyboard.append([InlineKeyboardButton("🔙 블록체인 메뉴", callback_data="blockchain_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def verify_event(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사별 블록체인 검증 상세"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('verify_event_', ''))
    event = db.get_event(event_id)

    if not event:
        await query.edit_message_text("❌ 행사를 찾을 수 없습니다.")
        return

    # 행사의 출석 기록과 블록체인 기록 비교
    attendances = db.list_attendance_by_event(event_id)

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                w.name as worker_name,
                cl.tx_hash,
                cl.block_number,
                cl.log_hash,
                cl.recorded_at
            FROM chain_logs cl
            LEFT JOIN attendance a ON cl.attendance_id = a.id
            LEFT JOIN workers w ON a.worker_id = w.id
            WHERE cl.event_id = ?
            ORDER BY cl.recorded_at DESC
        """, (event_id,))
        chain_records = [dict(row) for row in cursor.fetchall()]

    text = f"✅ 블록체인 검증 - {event['title']}\n\n"
    text += f"━━━━━━━━━━━━━━━━\n"
    text += f"📊 통계\n"
    text += f"━━━━━━━━━━━━━━━━\n"
    text += f"• 총 출석: {len(attendances)}건\n"
    text += f"• 체인 기록: {len(chain_records)}건\n"
    text += f"• 검증 상태: {'✅ 일치' if len(attendances) == len(chain_records) else '⚠️ 불일치'}\n\n"

    if chain_records:
        text += f"━━━━━━━━━━━━━━━━\n"
        text += f"🔗 블록체인 기록\n"
        text += f"━━━━━━━━━━━━━━━━\n"

        for record in chain_records[:5]:
            tx_hash_short = record['tx_hash'][:12] + "..." if record['tx_hash'] else "N/A"
            text += f"\n👤 {record['worker_name']}\n"
            text += f"🔗 {tx_hash_short}\n"
            text += f"📦 Block #{record['block_number']}\n"

        if len(chain_records) > 5:
            text += f"\n... 외 {len(chain_records) - 5}건"

    keyboard = [
        [InlineKeyboardButton("🔙 검증 목록", callback_data="blockchain_verify")],
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(text, reply_markup=reply_markup)


# ===== 도움말 =====
async def help_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """도움말 메뉴"""
    query = update.callback_query
    await query.answer()

    help_text = """
📖 WorkProof Chain 사용 설명서

━━━━━━━━━━━━━━━━━━━━
📝 1. 행사 등록
━━━━━━━━━━━━━━━━━━━━
• 행사 등록 버튼을 눌러 8단계 등록 진행
• 행사명 → 날짜(MMDD) → 시작시간(HHMM) → 종료시간(HHMM) → 장소 → 급여 → 복장 → 담당자 순서로 입력
• 등록 완료 후 모집글이 자동 생성됩니다
• 모집글을 복사하여 근무자들에게 전달하세요
• 모집글에 포함된 링크로 근무자가 지원합니다

━━━━━━━━━━━━━━━━━━━━
📋 2. 행사 목록
━━━━━━━━━━━━━━━━━━━━
• 등록된 모든 행사를 확인할 수 있습니다
• 행사별 지원자 수를 확인할 수 있습니다
• 행사를 선택하면 모집글을 다시 볼 수 있습니다
• 🟢 모집중 🔴 마감 ✅ 완료 상태 표시

━━━━━━━━━━━━━━━━━━━━
👥 3. 지원자 관리
━━━━━━━━━━━━━━━━━━━━
• 행사별 지원자 목록을 확인합니다
• 지원자를 선택하여 상세 정보 확인
• 지원자 상태 변경:
  - ✅ 확정하기: 근무 확정 + 출석코드 발급
  - ⏸ 대기 명단: 대기 상태로 변경
  - ❌ 불합격: 불합격 처리
• 확정 시 근무자에게 자동으로 알림 발송

━━━━━━━━━━━━━━━━━━━━
📊 4. 출석 관리
━━━━━━━━━━━━━━━━━━━━
• 행사별 출석 현황을 확인합니다
• 근무자의 출석/퇴근 시간 확인
• 상태:
  - ⏳ 대기: 출석 전
  - ✅ 출근완료: 출근 완료
  - 🎉 퇴근완료: 퇴근 완료
• 근무자는 봇에서 직접 출근/퇴근 체크

━━━━━━━━━━━━━━━━━━━━
💰 5. 엑셀 다운로드
━━━━━━━━━━━━━━━━━━━━
• 행사별 급여 명세서를 엑셀로 다운로드
• 엑셀 포함 내용:
  - 날짜(YYMMDD), 행사명, 이름
  - 주민번호, 은행, 은행코드(자동)
  - 계좌번호, 3.3%공제금액(자동계산)
  - 세전금액, 연락처
• 출석이 완료된 행사만 다운로드 가능

━━━━━━━━━━━━━━━━━━━━
⛓️ 6. 블록체인 기능
━━━━━━━━━━━━━━━━━━━━
• 모든 근무 기록은 블록체인에 자동 기록
• 근무자 개인정보는 해시화하여 보호
• 위변조 불가능한 근무 이력 증명
• Polygon 네트워크 사용

━━━━━━━━━━━━━━━━━━━━
💡 사용 팁
━━━━━━━━━━━━━━━━━━━━
• 행사 등록 시 날짜는 MMDD (예: 0125)
• 시간은 HHMM 형식 (예: 0900, 2100)
• 모집글 링크로 근무자가 직접 지원
• 지원자는 반드시 확정해야 출석코드 발급
• 엑셀은 출석 완료 후 다운로드

━━━━━━━━━━━━━━━━━━━━

문의사항이 있으시면 개발자에게 연락하세요.
"""

    keyboard = [
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(help_text, reply_markup=reply_markup)


# ===== 메인 메뉴 =====
async def main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """메인 메뉴로 돌아가기"""
    query = update.callback_query
    await query.answer()

    # 기존 메시지 삭제
    try:
        await query.message.delete()
    except Exception as e:
        logger.warning(f"Failed to delete message: {e}")

    # 통계 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()

        # 지원자 통계
        cursor.execute("""
            SELECT
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_count
            FROM applications
        """)
        app_stats = cursor.fetchone()
        pending_apps = app_stats['pending_count'] if app_stats else 0
        confirmed_apps = app_stats['confirmed_count'] if app_stats else 0

        # 출석 통계
        cursor.execute("""
            SELECT
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status IN ('CHECKED_IN', 'COMPLETED') THEN 1 ELSE 0 END) as done_count
            FROM attendance
        """)
        att_stats = cursor.fetchone()
        pending_att = att_stats['pending_count'] if att_stats else 0
        done_att = att_stats['done_count'] if att_stats else 0

    keyboard = [
        [InlineKeyboardButton("📋 행사 관리", callback_data="event_list")],
        [InlineKeyboardButton("➕ 새 행사 등록", callback_data="event_register")],
        [InlineKeyboardButton(f"👥 지원자 ({pending_apps}대기 / {confirmed_apps}확정)", callback_data="manage_applications")],
        [InlineKeyboardButton(f"📊 출석 ({pending_att}대기 / {done_att}완료)", callback_data="manage_attendance")],
        [InlineKeyboardButton("👷 근무자 관리", callback_data="manage_workers")],
        [InlineKeyboardButton("📥 정산 다운로드", callback_data="export_payroll")],
        [InlineKeyboardButton("⛓️ 블록체인 검증", callback_data="blockchain_menu")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    # 새 메시지 전송
    await context.bot.send_message(
        chat_id=query.message.chat_id,
        text="🛡 WorkProof Chain 관리자\n"
             "━━━━━━━━━━━━━━━━━━━━\n\n"
             f"📊 현황\n"
             f"• 지원자: 대기 {pending_apps} / 확정 {confirmed_apps}\n"
             f"• 출석: 대기 {pending_att} / 완료 {done_att}\n\n"
             "━━━━━━━━━━━━━━━━━━━━",
        reply_markup=reply_markup
    )


# ===== 메인 함수 =====
def main():
    """봇 실행"""
    token = os.getenv('ADMIN_BOT_TOKEN')
    if not token:
        logger.error("ADMIN_BOT_TOKEN not found in environment variables")
        return

    # Application 생성
    application = Application.builder().token(token).build()

    # Conversation handler: 행사 등록
    event_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(event_register_start, pattern="^event_register$")],
        states={
            EVENT_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_title_received)],
            EVENT_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_date_received)],
            EVENT_START_TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_start_time_received)],
            EVENT_END_TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_end_time_received)],
            EVENT_LOCATION: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_location_received)],
            EVENT_PAY: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_pay_received)],
            EVENT_WORK_TYPE: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_work_type_received)],
            EVENT_DRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_dress_received)],
            EVENT_MANAGER: [MessageHandler(filters.TEXT & ~filters.COMMAND, event_manager_received)],
            EVENT_CONFIRM: [
                CallbackQueryHandler(event_confirm, pattern="^event_confirm$"),
                CallbackQueryHandler(event_cancel, pattern="^event_cancel$"),
            ],
        },
        fallbacks=[
            CommandHandler("cancel", event_cancel),
            CallbackQueryHandler(event_cancel, pattern="^event_cancel$"),
        ],
    )

    # Conversation handler: 행사명 수정
    edit_title_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(edit_title_start, pattern="^edit_title_\d+$")],
        states={
            EDIT_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_title_received)],
        },
        fallbacks=[CommandHandler("cancel", edit_cancel), CallbackQueryHandler(edit_cancel, pattern="^edit_cancel$")],
    )

    # Conversation handler: 날짜 수정
    edit_date_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(edit_date_start, pattern="^edit_date_\d+$")],
        states={
            EDIT_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_date_received)],
        },
        fallbacks=[CommandHandler("cancel", edit_cancel), CallbackQueryHandler(edit_cancel, pattern="^edit_cancel$")],
    )

    # Conversation handler: 시간 수정
    edit_time_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(edit_time_start, pattern="^edit_time_\d+$")],
        states={
            EDIT_TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_time_received)],
        },
        fallbacks=[CommandHandler("cancel", edit_cancel), CallbackQueryHandler(edit_cancel, pattern="^edit_cancel$")],
    )

    # Conversation handler: 장소 수정
    edit_location_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(edit_location_start, pattern="^edit_location_\d+$")],
        states={
            EDIT_LOCATION: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_location_received)],
        },
        fallbacks=[CommandHandler("cancel", edit_cancel), CallbackQueryHandler(edit_cancel, pattern="^edit_cancel$")],
    )

    # Conversation handler: 급여 수정
    edit_pay_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(edit_pay_start, pattern="^edit_pay_\d+$")],
        states={
            EDIT_PAY: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_pay_received)],
        },
        fallbacks=[CommandHandler("cancel", edit_cancel), CallbackQueryHandler(edit_cancel, pattern="^edit_cancel$")],
    )

    # Conversation handler: 근무내용 수정
    edit_work_type_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(edit_work_type_start, pattern="^edit_work_type_\d+$")],
        states={
            EDIT_WORK_TYPE: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_work_type_received)],
        },
        fallbacks=[CommandHandler("cancel", edit_cancel), CallbackQueryHandler(edit_cancel, pattern="^edit_cancel$")],
    )

    # Conversation handler: 복장 수정
    edit_dress_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(edit_dress_start, pattern="^edit_dress_\d+$")],
        states={
            EDIT_DRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_dress_received)],
        },
        fallbacks=[CommandHandler("cancel", edit_cancel), CallbackQueryHandler(edit_cancel, pattern="^edit_cancel$")],
    )

    # Conversation handler: 담당자 수정
    edit_manager_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(edit_manager_start, pattern="^edit_manager_\d+$")],
        states={
            EDIT_MANAGER: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_manager_received)],
        },
        fallbacks=[CommandHandler("cancel", edit_cancel), CallbackQueryHandler(edit_cancel, pattern="^edit_cancel$")],
    )

    # 핸들러 등록
    application.add_handler(CommandHandler("start", start))
    application.add_handler(event_conv)
    application.add_handler(edit_title_conv)
    application.add_handler(edit_date_conv)
    application.add_handler(edit_time_conv)
    application.add_handler(edit_location_conv)
    application.add_handler(edit_pay_conv)
    application.add_handler(edit_work_type_conv)
    application.add_handler(edit_dress_conv)
    application.add_handler(edit_manager_conv)

    # Callback handlers
    application.add_handler(CallbackQueryHandler(approve_admin_callback, pattern="^approve_admin_\d+$"))
    application.add_handler(CallbackQueryHandler(reject_admin_callback, pattern="^reject_admin_\d+$"))
    application.add_handler(CallbackQueryHandler(main_menu, pattern="^main_menu$"))
    application.add_handler(CallbackQueryHandler(help_menu, pattern="^help_menu$"))
    application.add_handler(CallbackQueryHandler(blockchain_menu, pattern="^blockchain_menu$"))
    application.add_handler(CallbackQueryHandler(blockchain_records, pattern="^blockchain_records$"))
    application.add_handler(CallbackQueryHandler(blockchain_transactions, pattern="^blockchain_transactions$"))
    application.add_handler(CallbackQueryHandler(blockchain_verify, pattern="^blockchain_verify$"))
    application.add_handler(CallbackQueryHandler(verify_event, pattern="^verify_event_\d+$"))
    application.add_handler(CallbackQueryHandler(event_list, pattern="^event_list$"))
    application.add_handler(CallbackQueryHandler(event_detail, pattern="^event_detail_\d+$"))
    application.add_handler(CallbackQueryHandler(event_delete, pattern="^event_delete_\d+$"))
    application.add_handler(CallbackQueryHandler(event_delete_confirm, pattern="^event_delete_confirm_\d+$"))
    application.add_handler(CallbackQueryHandler(event_edit, pattern="^event_edit_\d+$"))
    application.add_handler(CallbackQueryHandler(manage_applications, pattern="^manage_applications$"))
    application.add_handler(CallbackQueryHandler(app_list, pattern="^app_list_\d+$"))
    application.add_handler(CallbackQueryHandler(app_detail, pattern="^app_detail_\d+$"))
    application.add_handler(CallbackQueryHandler(view_photo, pattern="^view_photo_\d+$"))
    application.add_handler(CallbackQueryHandler(app_confirm, pattern="^app_confirm_\d+$"))
    application.add_handler(CallbackQueryHandler(app_waitlist, pattern="^app_waitlist_\d+$"))
    application.add_handler(CallbackQueryHandler(app_reject, pattern="^app_reject_\d+$"))
    application.add_handler(CallbackQueryHandler(app_unconfirm, pattern="^app_unconfirm_\d+$"))
    application.add_handler(CallbackQueryHandler(manage_workers, pattern="^manage_workers$"))
    application.add_handler(CallbackQueryHandler(worker_detail, pattern="^worker_detail_\d+$"))
    application.add_handler(CallbackQueryHandler(manage_attendance, pattern="^manage_attendance$"))
    application.add_handler(CallbackQueryHandler(attendance_list, pattern="^attendance_list_\d+$"))
    application.add_handler(CallbackQueryHandler(attendance_detail, pattern="^attendance_detail_\d+$"))
    application.add_handler(CallbackQueryHandler(manual_checkin, pattern="^manual_checkin_\d+$"))
    application.add_handler(CallbackQueryHandler(manual_checkout, pattern="^manual_checkout_\d+$"))
    application.add_handler(CallbackQueryHandler(view_worker_photo, pattern="^view_worker_photo_\d+$"))
    application.add_handler(CallbackQueryHandler(export_payroll, pattern="^export_payroll$"))
    application.add_handler(CallbackQueryHandler(export_event_payroll, pattern="^export_\d+$"))

    # 봇 실행
    logger.info("Admin bot started")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
