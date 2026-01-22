"""
근무자 봇 메인
"""
import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ContextTypes, ConversationHandler, filters
)
from dotenv import load_dotenv

from db import Database
from utils import parse_deep_link_payload, validate_phone, format_phone, now_kst_str, KST
from contract_sender import send_contract_link
from models import ApplicationStatus, AttendanceStatus
from datetime import datetime

# 환경변수 로드
load_dotenv('config/.env')

# 로깅 설정 (한국 시간 UTC+9)
import time
logging.Formatter.converter = lambda *args: time.localtime(time.time() + 9*3600)
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
    handlers=[
        logging.FileHandler(os.getenv('LOG_DIR', 'logs') + '/worker_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# DB 초기화
db = Database(os.getenv('DB_PATH', 'data/workproof.db'))

# Conversation states
(REG_NAME, REG_BIRTH, REG_PHONE, REG_RESIDENCE, REG_FACE_PHOTO, REG_DRIVER_LICENSE, REG_SECURITY_CERT, REG_BANK, REG_ACCOUNT, REG_CONTRACT,
 EDIT_FIELD, EDIT_VALUE,
 ATTENDANCE_CODE, CHECKOUT_CODE) = range(14)


# ===== 유틸리티 =====
def get_worker(telegram_id: int):
    """근무자 조회"""
    return db.get_worker_by_telegram_id(telegram_id)


def get_main_keyboard():
    """메인 메뉴 키보드"""
    keyboard = [
        [InlineKeyboardButton("💼 근무지원하기", callback_data="job_search")],
        [InlineKeyboardButton("📊 내 출석 목록", callback_data="my_attendance_list")],
        [InlineKeyboardButton("⛓️ 블록체인 검증", callback_data="verify_work")],
        [InlineKeyboardButton("👤 내 정보 (수정하기)", callback_data="my_info")],
    ]
    return InlineKeyboardMarkup(keyboard)


# ===== 시작 명령어 =====
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    시작 명령어
    Deep Link 처리: /start apply_{event_id}
    """
    telegram_id = update.effective_user.id
    worker = get_worker(telegram_id)

    # Deep Link 파싱
    payload = context.args[0] if context.args else None
    deep_link_data = parse_deep_link_payload(payload) if payload else {}

    # 근무자 미등록 시 -> 등록 프로세스
    if not worker:
        # Deep link 정보 임시 저장
        if deep_link_data:
            context.user_data['pending_deep_link'] = deep_link_data

        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            "👋 안녕하세요!\n\n"
            "(주)엘케이프라이빗 근무시스템입니다.\n"
            "처음 오신 분들은 근무자 정보를 등록해주세요.\n\n"
            "📝 이름을 입력하세요:\n"
            "(예: 홍길동)",
            reply_markup=reply_markup
        )
        return REG_NAME

    # 등록된 근무자 -> 메인 메뉴
    reply_markup = get_main_keyboard()

    welcome_text = f"👋 {worker['name']}님, 환영합니다!\n\n(주)엘케이프라이빗\n\n"

    # Deep Link 처리
    if deep_link_data and deep_link_data.get('action') == 'apply':
        event_id = deep_link_data.get('event_id')
        event = db.get_event(event_id)

        if not event:
            welcome_text += "❌ 행사를 찾을 수 없습니다."
        elif event['status'] != 'OPEN':
            welcome_text += "❌ 모집이 마감된 행사입니다."
        else:
            # 지원 페이지로 이동
            await show_event_detail(update, context, event_id, worker['id'])
            return

    await update.message.reply_text(welcome_text, reply_markup=reply_markup)


# ===== 근무자 등록 프로세스 =====
async def reg_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """이름 입력"""
    name = update.message.text.strip()
    context.user_data['reg_name'] = name

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"✅ 이름: {name}\n\n"
        "📝 생년월일을 입력하세요 (YYMMDD):\n"
        "(예: 900815 → 1990년 8월 15일)",
        reply_markup=reply_markup
    )
    return REG_BIRTH


async def reg_birth(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """생년월일 입력 (YYMMDD)"""
    birth_text = update.message.text.strip()

    # YYMMDD 형식 검증 (6자리 숫자)
    if len(birth_text) != 6 or not birth_text.isdigit():
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "❌ 올바른 형식이 아닙니다.\n\n"
            "YYMMDD 형식으로 입력하세요 (예: 900815)",
            reply_markup=reply_markup
        )
        return REG_BIRTH

    context.user_data['reg_birth'] = birth_text

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"✅ 생년월일: {birth_text}\n\n"
        "📝 전화번호를 입력하세요:\n"
        "(예: 010-1234-5678 또는 01012345678)",
        reply_markup=reply_markup
    )
    return REG_PHONE


async def reg_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """전화번호 입력"""
    phone = update.message.text.strip()

    if not validate_phone(phone):
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "❌ 올바른 전화번호를 입력하세요.\n"
            "(예: 010-1234-5678)",
            reply_markup=reply_markup
        )
        return REG_PHONE

    context.user_data['reg_phone'] = format_phone(phone)

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"✅ 전화번호: {format_phone(phone)}\n\n"
        "📝 거주지역을 입력하세요:\n"
        "(예: 서울특별시 강남구)",
        reply_markup=reply_markup
    )
    return REG_RESIDENCE


async def reg_residence(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """거주지역 입력"""
    residence = update.message.text.strip()
    context.user_data['reg_residence'] = residence

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"✅ 거주지역: {residence}\n\n"
        "📸 얼굴확인 가능한 사진을 보내주세요:\n"
        "(면접 대체용 - 정면 사진 권장)",
        reply_markup=reply_markup
    )
    return REG_FACE_PHOTO


async def reg_face_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """얼굴 사진 입력"""
    if not update.message.photo:
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "❌ 사진을 보내주세요.",
            reply_markup=reply_markup
        )
        return REG_FACE_PHOTO

    # 가장 큰 사진 파일 다운로드 및 저장
    photo = update.message.photo[-1]

    try:
        photo_dir = 'data/photos'
        os.makedirs(photo_dir, exist_ok=True)

        file = await photo.get_file()
        filename = f"temp_{update.effective_user.id}_{photo.file_id}.jpg"
        filepath = os.path.join(photo_dir, filename)

        await file.download_to_drive(filepath)

        # 파일 경로를 임시로 저장
        context.user_data['reg_face_photo'] = filepath
        context.user_data['reg_face_photo_temp'] = True

        logger.info(f"Temp photo saved: {filepath}")
    except Exception as e:
        logger.error(f"Failed to save photo: {e}")
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "❌ 사진 저장 실패. 다시 시도해주세요.",
            reply_markup=reply_markup
        )
        return REG_FACE_PHOTO

    keyboard = [
        [InlineKeyboardButton("✅ 있음", callback_data="driver_yes")],
        [InlineKeyboardButton("❌ 없음", callback_data="driver_no")],
        [InlineKeyboardButton("🏠 처음으로", callback_data="start_over")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "✅ 사진이 등록되었습니다.\n\n"
        "🚗 운전면허가 있으신가요?",
        reply_markup=reply_markup
    )
    return REG_DRIVER_LICENSE


async def reg_driver_license(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """운전면허 여부"""
    query = update.callback_query
    await query.answer()

    has_license = query.data == "driver_yes"
    context.user_data['reg_driver_license'] = has_license

    keyboard = [
        [InlineKeyboardButton("✅ 있음", callback_data="security_yes")],
        [InlineKeyboardButton("❌ 없음", callback_data="security_no")],
        [InlineKeyboardButton("🏠 처음으로", callback_data="start_over")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        f"✅ 운전면허: {'있음' if has_license else '없음'}\n\n"
        "🛡️ 경호이수증이 있으신가요?",
        reply_markup=reply_markup
    )
    return REG_SECURITY_CERT


async def reg_security_cert(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """경호이수증 여부"""
    query = update.callback_query
    await query.answer()

    has_cert = query.data == "security_yes"
    context.user_data['reg_security_cert'] = has_cert

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        f"✅ 경호이수증: {'있음' if has_cert else '없음'}\n\n"
        f"🏦 급여 수령을 위한 정보를 입력해주세요.\n\n"
        f"은행명을 입력하세요:\n"
        f"(예: 국민은행, 신한은행, 카카오뱅크)",
        reply_markup=reply_markup
    )
    return REG_BANK


async def reg_bank(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """은행명 입력"""
    bank_name = update.message.text.strip()
    context.user_data['reg_bank'] = bank_name

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="start_over")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"✅ 은행명: {bank_name}\n\n"
        f"📝 계좌번호를 입력하세요:\n"
        f"(예: 123-456-789012 또는 123456789012)",
        reply_markup=reply_markup
    )
    return REG_ACCOUNT


async def reg_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """계좌번호 입력"""
    account = update.message.text.strip()
    context.user_data['reg_account'] = account

    # 프리랜서용역계약서 링크
    contract_link = "https://glosign.com/linkviewer/l19505c1c6253ae8fc0507e5a53072ed1d96fdb16a1eeeddc472fc4ee1a1cefb3ec31a275fdb22d570bf5644d281c10d8"

    keyboard = [
        [InlineKeyboardButton("✅ 작성 완료", callback_data="contract_signed")],
        [InlineKeyboardButton("🏠 처음으로", callback_data="start_over")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"✅ 계좌번호: {account}\n\n"
        f"📄 마지막 단계입니다!\n"
        f"프리랜서용역계약서를 작성해주세요.\n\n"
        f"🔗 계약서 링크:\n{contract_link}\n\n"
        f"계약서 작성을 완료하셨으면 '✅ 작성 완료' 버튼을 눌러주세요.",
        reply_markup=reply_markup
    )
    return REG_CONTRACT


async def reg_contract(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """프리랜서용역계약서 작성 완료 - 최종 등록"""
    query = update.callback_query
    await query.answer()

    # DB에 저장
    try:
        temp_photo_path = context.user_data.get('reg_face_photo')
        worker_id = db.create_worker(
            telegram_id=update.effective_user.id,
            name=context.user_data['reg_name'],
            phone=context.user_data['reg_phone'],
            birth_date=context.user_data.get('reg_birth'),
            residence=context.user_data.get('reg_residence'),
            face_photo_file_id=None,  # 일단 None으로 생성
            driver_license=context.user_data.get('reg_driver_license', False),
            security_cert=context.user_data.get('reg_security_cert', False),
            bank_name=context.user_data.get('reg_bank'),
            bank_account=context.user_data.get('reg_account'),
            contract_signed=True
        )

        # 임시 파일을 worker_id로 변경
        if temp_photo_path and context.user_data.get('reg_face_photo_temp'):
            try:
                photo_dir = 'data/photos'
                new_filename = f"worker_{worker_id}.jpg"
                new_filepath = os.path.join(photo_dir, new_filename)

                # 파일 이름 변경
                os.rename(temp_photo_path, new_filepath)

                # DB 업데이트
                db.update_worker(worker_id, face_photo_file_id=new_filepath)

                logger.info(f"Photo renamed: {temp_photo_path} -> {new_filepath}")
            except Exception as e:
                logger.error(f"Failed to rename photo: {e}")

        worker = db.get_worker_by_telegram_id(update.effective_user.id)

        await query.edit_message_text(
            "✅ 등록이 완료되었습니다!\n\n"
            f"📋 등록 정보:\n"
            f"이름: {worker['name']}\n"
            f"생년월일: {worker['birth_date']}\n"
            f"전화번호: {worker['phone']}\n"
            f"거주지역: {worker.get('residence', '-')}\n"
            f"운전면허: {'있음' if worker['driver_license'] else '없음'}\n"
            f"경호이수증: {'있음' if worker['security_cert'] else '없음'}\n"
            f"은행: {worker.get('bank_name', '-')}\n"
            f"계좌번호: {worker.get('bank_account', '-')}\n"
            f"프리랜서용역계약서: {'작성완료' if worker.get('contract_signed') else '미작성'}\n\n"
            f"환영합니다! 🎉"
        )

        # 메인 메뉴
        reply_markup = get_main_keyboard()
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="아래 메뉴에서 원하는 작업을 선택하세요:",
            reply_markup=reply_markup
        )

    except Exception as e:
        logger.error(f"Failed to register worker: {e}")
        await query.edit_message_text(f"❌ 오류: {str(e)}")

    context.user_data.clear()
    return ConversationHandler.END


# ===== 내 정보 =====
async def my_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """내 정보 조회"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)

    if not worker:
        keyboard = [[InlineKeyboardButton("📝 회원가입", callback_data="start_registration")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 등록되지 않은 사용자입니다.\n\n/start 명령어로 회원가입을 진행해주세요.", reply_markup=reply_markup)
        return

    info_text = f"""
👤 내 정보

이름: {worker['name']}
생년월일: {worker['birth_date'] or '미입력'}
전화번호: {worker['phone']}
거주지역: {worker.get('residence') or '미입력'}
얼굴사진: {'등록완료' if worker.get('face_photo_file_id') else '미등록'}
운전면허: {'있음' if worker.get('driver_license') else '없음'}
경호이수증: {'있음' if worker.get('security_cert') else '없음'}
은행: {worker.get('bank_name') or '미입력'}
계좌번호: {worker.get('bank_account') or '미입력'}
프리랜서용역계약서: {'작성완료' if worker.get('contract_signed') else '미작성'}

등록일: {worker['created_at']}
"""

    keyboard = [
        [InlineKeyboardButton("✏️ 정보 수정", callback_data="edit_info")],
        [InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(info_text, reply_markup=reply_markup)


# ===== 정보 수정 =====
async def edit_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """정보 수정 메뉴"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)
    if not worker:
        keyboard = [[InlineKeyboardButton("📝 회원가입", callback_data="start_registration")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 등록되지 않은 사용자입니다.\n\n/start 명령어로 회원가입을 진행해주세요.", reply_markup=reply_markup)
        return

    keyboard = [
        [InlineKeyboardButton("📝 이름", callback_data="edit_name")],
        [InlineKeyboardButton("🎂 생년월일", callback_data="edit_birth")],
        [InlineKeyboardButton("📞 전화번호", callback_data="edit_phone")],
        [InlineKeyboardButton("🏘️ 거주지역", callback_data="edit_residence")],
        [InlineKeyboardButton("📸 얼굴사진", callback_data="edit_face_photo")],
        [InlineKeyboardButton("🚗 운전면허", callback_data="edit_driver")],
        [InlineKeyboardButton("🛡️ 경호이수증", callback_data="edit_security")],
        [InlineKeyboardButton("🏦 은행", callback_data="edit_bank")],
        [InlineKeyboardButton("💳 계좌번호", callback_data="edit_account")],
        [InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        "✏️ 수정할 항목을 선택하세요:",
        reply_markup=reply_markup
    )


async def edit_field_selected(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """수정 필드 선택됨"""
    query = update.callback_query
    await query.answer()

    field = query.data.replace('edit_', '')
    context.user_data['edit_field'] = field

    field_names = {
        'name': '이름',
        'birth': '생년월일',
        'phone': '전화번호',
        'residence': '거주지역',
        'face_photo': '얼굴사진',
        'driver': '운전면허',
        'security': '경호이수증',
        'bank': '은행',
        'account': '계좌번호'
    }

    # 운전면허/경호이수증은 버튼 선택
    if field in ['driver', 'security']:
        keyboard = [
            [InlineKeyboardButton("✅ 있음", callback_data=f"{field}_yes")],
            [InlineKeyboardButton("❌ 없음", callback_data=f"{field}_no")],
            [InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            f"{field_names[field]}이(가) 있으신가요?",
            reply_markup=reply_markup
        )
        return EDIT_VALUE

    # 얼굴사진은 사진 업로드
    if field == 'face_photo':
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "📸 새로운 얼굴사진을 보내주세요:\n"
            "(면접 대체용 - 정면 사진 권장)\n\n"
            "※ 취소하려면 /cancel 입력",
            reply_markup=reply_markup
        )
        return EDIT_VALUE

    field_examples = {
        'name': '예: 홍길동',
        'birth': 'YYMMDD 형식 (예: 900815)',
        'phone': '예: 010-1234-5678',
        'residence': '예: 서울특별시 강남구',
        'bank': '예: 국민은행, 신한은행, 카카오뱅크',
        'account': '예: 123-456-789012 또는 123456789012'
    }

    await query.edit_message_text(
        f"새로운 {field_names[field]}을(를) 입력하세요:\n"
        f"{field_examples.get(field, '')}\n\n"
        f"※ 취소하려면 /cancel 입력"
    )

    return EDIT_VALUE


async def edit_value_entered(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """수정 값 입력됨 (텍스트 또는 버튼 콜백)"""
    field = context.user_data.get('edit_field')
    worker = get_worker(update.effective_user.id)

    # 버튼 콜백 처리 (운전면허/경호이수증)
    if update.callback_query:
        query = update.callback_query
        await query.answer()

        # driver_yes, driver_no, security_yes, security_no
        value = query.data.endswith('_yes')

        if field == 'driver':
            db.update_worker(worker['id'], driver_license=value)
            field_display = '운전면허'
        elif field == 'security':
            db.update_worker(worker['id'], security_cert=value)
            field_display = '경호이수증'

        reply_markup = get_main_keyboard()
        await query.edit_message_text(
            f"✅ {field_display}이(가) 수정되었습니다!\n\n"
            f"새로운 값: {'있음' if value else '없음'}",
            reply_markup=reply_markup
        )

        context.user_data.clear()
        return ConversationHandler.END

    # 사진 입력 처리 (얼굴사진)
    if field == 'face_photo':
        if not update.message.photo:
            await update.message.reply_text("❌ 사진을 보내주세요.")
            return EDIT_VALUE

        photo = update.message.photo[-1]

        # 파일 다운로드 및 저장
        try:
            photo_dir = 'data/photos'
            os.makedirs(photo_dir, exist_ok=True)

            # 기존 파일 삭제
            old_photo = worker.get('face_photo_file_id')
            if old_photo and os.path.exists(old_photo):
                try:
                    os.remove(old_photo)
                    logger.info(f"Old photo removed: {old_photo}")
                except Exception as e:
                    logger.warning(f"Failed to remove old photo: {e}")

            file = await photo.get_file()
            filename = f"worker_{worker['id']}.jpg"
            filepath = os.path.join(photo_dir, filename)

            await file.download_to_drive(filepath)

            # 파일 경로를 DB에 저장 (file_id 대신)
            db.update_worker(worker['id'], face_photo_file_id=filepath)

            logger.info(f"Photo saved: {filepath}")
        except Exception as e:
            logger.error(f"Failed to save photo: {e}")
            await update.message.reply_text("❌ 사진 저장 실패. 다시 시도해주세요.")
            return EDIT_VALUE

        reply_markup = get_main_keyboard()
        await update.message.reply_text(
            "✅ 얼굴사진이 수정되었습니다!",
            reply_markup=reply_markup
        )

        context.user_data.clear()
        return ConversationHandler.END

    # 텍스트 입력 처리
    value = update.message.text.strip()

    # 필드별 검증
    if field == 'phone' and not validate_phone(value):
        await update.message.reply_text("❌ 올바른 전화번호를 입력하세요.")
        return EDIT_VALUE

    if field == 'birth':
        # YYMMDD 형식 검증 (6자리 숫자)
        if len(value) != 6 or not value.isdigit():
            await update.message.reply_text(
                "❌ 올바른 형식이 아닙니다.\n\n"
                "YYMMDD 형식으로 입력하세요 (예: 900815)"
            )
            return EDIT_VALUE

    # DB 업데이트
    update_data = {}
    if field == 'birth':
        update_data = {'birth_date': value}
    elif field == 'bank':
        update_data = {'bank_name': value}
    elif field == 'account':
        update_data = {'bank_account': value}
    else:
        update_data = {field: value}

    db.update_worker(worker['id'], **update_data)

    field_names = {
        'name': '이름',
        'birth': '생년월일',
        'phone': '전화번호',
        'residence': '거주지역',
        'bank': '은행',
        'account': '계좌번호'
    }

    reply_markup = get_main_keyboard()

    await update.message.reply_text(
        f"✅ {field_names[field]}이(가) 수정되었습니다!\n\n"
        f"새로운 값: {value}",
        reply_markup=reply_markup
    )

    context.user_data.clear()
    return ConversationHandler.END


# ===== 내 지원 내역 =====
async def my_applications(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """내 지원 내역"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)
    if not worker:
        keyboard = [[InlineKeyboardButton("📝 회원가입", callback_data="start_registration")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 등록되지 않은 사용자입니다.\n\n/start 명령어로 회원가입을 진행해주세요.", reply_markup=reply_markup)
        return

    applications = db.list_applications_by_worker(worker['id'])

    if not applications:
        text = "📋 지원 내역이 없습니다."
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
    else:
        text = f"📋 내 지원 내역 (총 {len(applications)}건)\n\n"
        keyboard = []

        for app in applications[:20]:
            status_emoji = {
                'PENDING': '⏳',
                'CONFIRMED': '✅',
                'REJECTED': '❌',
                'WAITLIST': '⏸'
            }.get(app['status'], '❓')

            button_text = f"{status_emoji} {app['title']} ({app['event_date']})"
            keyboard.append([InlineKeyboardButton(button_text, callback_data=f"app_detail_{app['id']}")])

        keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def application_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """지원 내역 상세 정보"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)
    if not worker:
        await query.answer("❌ 등록되지 않은 사용자입니다.", show_alert=True)
        return

    app_id = int(query.data.replace('app_detail_', ''))

    # 지원 내역 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*,
                   e.title as event_title,
                   e.event_date,
                   e.event_time,
                   e.location,
                   e.pay_description
            FROM applications a
            JOIN events e ON a.event_id = e.id
            WHERE a.id = ? AND a.worker_id = ?
        """, (app_id, worker['id']))
        app = cursor.fetchone()

    if not app:
        await query.answer("❌ 지원 내역을 찾을 수 없습니다.", show_alert=True)
        return

    app = dict(app)

    status_text = {
        'PENDING': '⏳ 대기중',
        'CONFIRMED': '✅ 확정됨',
        'REJECTED': '❌ 불합격',
        'WAITLIST': '⏸ 대기 명단'
    }.get(app['status'], app['status'])

    text = f"""
📋 지원 상세 정보

행사명: {app['event_title']}
📅 날짜: {app['event_date']}
⏰ 시간: {app['event_time']}
📍 장소: {app['location']}
💰 급여: {app['pay_description']}

상태: {status_text}
지원일: {app['applied_at'].split('.')[0] if '.' in app['applied_at'] else app['applied_at']}
"""

    keyboard = []

    # 대기중인 지원만 취소 가능
    if app['status'] == 'PENDING':
        keyboard.append([InlineKeyboardButton("❌ 지원 취소하기", callback_data=f"cancel_app_{app_id}")])

    keyboard.append([InlineKeyboardButton("🔙 지원 내역", callback_data="my_applications")])
    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def cancel_application(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """지원 취소"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)
    if not worker:
        await query.answer("❌ 등록되지 않은 사용자입니다.", show_alert=True)
        return

    app_id = int(query.data.replace('cancel_app_', ''))

    # 지원 내역 확인
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, e.title as event_title
            FROM applications a
            JOIN events e ON a.event_id = e.id
            WHERE a.id = ? AND a.worker_id = ?
        """, (app_id, worker['id']))
        app = cursor.fetchone()

    if not app:
        await query.answer("❌ 지원 내역을 찾을 수 없습니다.", show_alert=True)
        return

    app = dict(app)

    # 이미 확정되었거나 불합격된 지원은 취소 불가
    if app['status'] != 'PENDING':
        status_name = {
            'CONFIRMED': '확정',
            'REJECTED': '불합격',
            'WAITLIST': '대기 명단'
        }.get(app['status'], app['status'])
        await query.answer(f"❌ {status_name} 상태의 지원은 취소할 수 없습니다.", show_alert=True)
        return

    # 지원 삭제
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM applications WHERE id = ?", (app_id,))
        conn.commit()

    logger.info(f"Application cancelled: app_id={app_id}, worker_id={worker['id']}")

    keyboard = [
        [InlineKeyboardButton("📋 지원 내역", callback_data="my_applications")],
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        f"✅ 지원이 취소되었습니다.\n\n"
        f"행사: {app['event_title']}",
        reply_markup=reply_markup
    )


# ===== 내 근무 로그 =====
async def my_work_logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """내 근무 로그 (블록체인 포함)"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)
    if not worker:
        keyboard = [[InlineKeyboardButton("📝 회원가입", callback_data="start_registration")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 등록되지 않은 사용자입니다.\n\n/start 명령어로 회원가입을 진행해주세요.", reply_markup=reply_markup)
        return

    chain_logs = db.get_chain_logs_by_worker(worker['id'])

    if not chain_logs:
        text = "📊 근무 로그가 없습니다.\n\n근무 완료 후 블록체인에 기록됩니다."
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
    else:
        from chain import polygon_chain

        text = f"📊 내 근무 로그 (총 {len(chain_logs)}건)\n\n"

        for log in chain_logs[:10]:
            text += f"━━━━━━━━━━━━━━━━\n"
            text += f"📋 {log['event_title']}\n"
            text += f"📅 {log['event_date']}\n"
            text += f"⏱ {log['worked_minutes']}분\n"

            if log['tx_hash']:
                text += f"⛓️ 블록체인 기록됨\n"
                text += f"TX: {log['tx_hash'][:16]}...\n"
                explorer_url = polygon_chain.get_block_explorer_url(log['tx_hash'])
                text += f"🔗 {explorer_url}\n"
            else:
                text += f"⏳ 블록체인 기록 대기 중\n"

        text += f"━━━━━━━━━━━━━━━━\n"

        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup, disable_web_page_preview=True)


# ===== 행사 상세 및 지원 =====
async def show_event_detail(update: Update, context: ContextTypes.DEFAULT_TYPE, event_id: int, worker_id: int):
    """행사 상세 보기 (CallbackQuery용)"""
    event = db.get_event(event_id)

    if not event:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        if update.callback_query:
            await update.callback_query.edit_message_text("❌ 행사를 찾을 수 없습니다.", reply_markup=reply_markup)
        return

    # 이미 지원했는지 확인
    apps = db.list_applications_by_event(event_id)
    already_applied = any(app['worker_id'] == worker_id for app in apps)

    text = f"""
📋 행사 상세

제목: {event['title']}
날짜: {event['event_date']}
시간: {event['event_time'] or '미정'}
장소: {event['location']}
급여: {event['pay_amount']:,}원
복장: {event['dress_code'] or '미정'}
연령: {event['age_requirement'] or '무관'}

지원 방법: {event['application_method'] or '미정'}
담당자: {event['manager_name'] or '미정'}
"""

    keyboard = []

    if already_applied:
        text += "\n✅ 이미 지원한 행사입니다."
        keyboard.append([InlineKeyboardButton("📋 내 지원 내역", callback_data="my_applications")])
    elif event['status'] != 'OPEN':
        text += "\n❌ 모집이 마감되었습니다."
    else:
        keyboard.append([InlineKeyboardButton("✅ 지원하기", callback_data=f"apply_{event_id}")])

    keyboard.append([InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)

    if update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=reply_markup)
    else:
        await update.message.reply_text(text, reply_markup=reply_markup)


async def show_event_detail_by_message(update: Update, context: ContextTypes.DEFAULT_TYPE, event_id: int, worker_id: int):
    """행사 상세 보기 (Message용)"""
    event = db.get_event(event_id)

    if not event:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text("❌ 행사를 찾을 수 없습니다.", reply_markup=reply_markup)
        return

    # 이미 지원했는지 확인
    apps = db.list_applications_by_event(event_id)
    already_applied = any(app['worker_id'] == worker_id for app in apps)

    text = f"""
📋 행사 상세

제목: {event['title']}
날짜: {event['event_date']}
시간: {event['event_time'] or '미정'}
장소: {event['location']}
급여: {event['pay_amount']:,}원
복장: {event['dress_code'] or '미정'}
연령: {event['age_requirement'] or '무관'}

지원 방법: {event['application_method'] or '미정'}
담당자: {event['manager_name'] or '미정'}
"""

    keyboard = []

    if already_applied:
        text += "\n✅ 이미 지원한 행사입니다."
        keyboard.append([InlineKeyboardButton("📋 내 지원 내역", callback_data="my_applications")])
    elif event['status'] != 'OPEN':
        text += "\n❌ 모집이 마감되었습니다."
    else:
        keyboard.append([InlineKeyboardButton("✅ 지원하기", callback_data=f"apply_{event_id}")])

    keyboard.append([InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(text, reply_markup=reply_markup)


async def apply_for_event(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """행사 지원"""
    query = update.callback_query
    await query.answer()

    event_id = int(query.data.replace('apply_', ''))
    worker = get_worker(update.effective_user.id)

    # 지원 생성 (중복 방지)
    app_id = db.create_application(event_id, worker['id'])

    if not app_id:
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "❌ 이미 지원한 행사입니다.\n\n"
            "중복 지원은 불가능합니다.",
            reply_markup=reply_markup
        )
        return

    event = db.get_event(event_id)

    keyboard = [
        [InlineKeyboardButton("📋 내 지원 내역", callback_data="my_applications")],
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        f"✅ 지원이 완료되었습니다!\n\n"
        f"📋 행사: {event['title']}\n"
        f"📅 날짜: {event['event_date']}\n"
        f"📍 장소: {event['location']}\n\n"
        f"관리자 확정을 기다려주세요.\n"
        f"확정되면 알림을 보내드립니다.",
        reply_markup=reply_markup
    )


# ===== 출석/퇴근 =====
async def attendance_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """출석 명령어 /출석"""
    await update.message.reply_text(
        "📊 출석 체크\n\n"
        "6자리 출석 코드를 입력하세요:\n"
        "(예: 123456)"
    )
    return ATTENDANCE_CODE


async def attendance_code_entered(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """출석 코드 입력됨"""
    code = update.message.text.strip()
    worker = get_worker(update.effective_user.id)

    # 코드로 출석 레코드 조회
    attendance = db.get_attendance_by_code(code)

    if not attendance:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "❌ 올바르지 않은 출석 코드입니다.\n\n"
            "관리자에게 확인하세요.",
            reply_markup=reply_markup
        )
        return ConversationHandler.END

    if attendance['worker_id'] != worker['id']:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "❌ 본인의 출석 코드가 아닙니다.",
            reply_markup=reply_markup
        )
        return ConversationHandler.END

    if attendance['status'] == 'CHECKED_IN':
        await update.message.reply_text(
            "ℹ️ 이미 출석 체크가 완료되었습니다."
        )
        return ConversationHandler.END

    # 출석 처리
    db.check_in(attendance['id'])

    event = db.get_event(attendance['event_id'])

    reply_markup = get_main_keyboard()

    await update.message.reply_text(
        f"✅ 출석 완료!\n\n"
        f"📋 행사: {event['title']}\n"
        f"📅 날짜: {event['event_date']}\n"
        f"⏰ 출석 시간: 지금\n\n"
        f"근무 마치고 /퇴근 명령으로 퇴근 처리하세요.",
        reply_markup=reply_markup
    )

    return ConversationHandler.END


async def checkout_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """퇴근 명령어 /퇴근"""
    await update.message.reply_text(
        "📊 퇴근 처리\n\n"
        "6자리 출석 코드를 입력하세요:\n"
        "(예: 123456)"
    )
    return CHECKOUT_CODE


async def checkout_code_entered(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """퇴근 코드 입력됨"""
    code = update.message.text.strip()
    worker = get_worker(update.effective_user.id)

    # 코드로 출석 레코드 조회
    attendance = db.get_attendance_by_code(code)

    if not attendance:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text("❌ 올바르지 않은 코드입니다.", reply_markup=reply_markup)
        return ConversationHandler.END

    if attendance['worker_id'] != worker['id']:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text("❌ 본인의 코드가 아닙니다.", reply_markup=reply_markup)
        return ConversationHandler.END

    if attendance['status'] != 'CHECKED_IN':
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text("❌ 출석 체크를 먼저 해주세요.", reply_markup=reply_markup)
        return ConversationHandler.END

    # 퇴근 처리
    db.check_out(attendance['id'], worker['id'])

    # 재조회
    attendance = db.get_attendance_by_code(code)
    event = db.get_event(attendance['event_id'])

    # 블록체인 기록
    try:
        from chain import polygon_chain
        from utils import generate_log_hash, generate_worker_uid_hash

        log_hash = generate_log_hash({
            'event_id': attendance['event_id'],
            'worker_id': attendance['worker_id'],
            'check_in_time': str(attendance['check_in_time']),
            'check_out_time': str(attendance['check_out_time']),
            'worked_minutes': attendance['worked_minutes']
        })

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
            # DB에 TX 정보 저장
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

            blockchain_msg = f"\n⛓️ 블록체인 기록 완료!\nTX: {result['tx_hash'][:16]}..."
        else:
            blockchain_msg = f"\n⚠️ 블록체인 기록 실패: {result.get('error', 'Unknown')}"

    except Exception as e:
        logger.error(f"Blockchain recording failed: {e}")
        blockchain_msg = f"\n⚠️ 블록체인 기록 중 오류 발생"

    reply_markup = get_main_keyboard()

    await update.message.reply_text(
        f"✅ 퇴근 완료!\n\n"
        f"📋 행사: {event['title']}\n"
        f"⏱ 총 근무 시간: {attendance['worked_minutes']}분\n"
        f"{blockchain_msg}\n\n"
        f"수고하셨습니다!",
        reply_markup=reply_markup
    )

    return ConversationHandler.END


# ===== 내 출석 목록 =====
async def my_attendance_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """내 출석 목록 보기"""
    query = update.callback_query
    await query.answer()

    # 기존 메시지 삭제
    try:
        await query.message.delete()
    except Exception as e:
        logger.warning(f"Failed to delete message: {e}")

    worker = get_worker(update.effective_user.id)
    if not worker:
        keyboard = [[InlineKeyboardButton("📝 회원가입", callback_data="start_registration")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="❌ 등록되지 않은 사용자입니다.",
            reply_markup=reply_markup
        )
        return

    # 내 출석 기록 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, e.title as event_title, e.event_date, e.event_time, e.location
            FROM attendance a
            JOIN events e ON a.event_id = e.id
            WHERE a.worker_id = ?
            ORDER BY e.event_date DESC, a.created_at DESC
            LIMIT 20
        """, (worker['id'],))
        attendances = [dict(row) for row in cursor.fetchall()]

    if not attendances:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="📊 출석 기록이 없습니다.\n\n"
                 "근무 확정 후 출석 기록이 생성됩니다.",
            reply_markup=reply_markup
        )
        return

    # 상태별 분류
    pending = [a for a in attendances if a['status'] == 'PENDING']
    checked_in = [a for a in attendances if a['status'] == 'CHECKED_IN']
    completed = [a for a in attendances if a['status'] == 'COMPLETED']

    text = f"📊 내 출석 목록 (총 {len(attendances)}건)\n\n"
    text += f"⏳ 대기: {len(pending)}건\n"
    text += f"✅ 출근완료: {len(checked_in)}건\n"
    text += f"🎉 퇴근완료: {len(completed)}건\n"
    text += f"━━━━━━━━━━━━━━━━\n\n"
    text += "출석 기록을 선택하세요:"

    keyboard = []
    for att in attendances[:15]:
        # 날짜를 YYMMDD 형식으로 변환
        from utils import extract_yymmdd
        yymmdd_date = extract_yymmdd(att['event_date'])

        # 퇴근완료 상태에는 (퇴근완료) 텍스트 추가
        status_suffix = " (퇴근완료)" if att['status'] == 'COMPLETED' else ""

        # 왼쪽 정렬을 위해 날짜를 앞에 배치
        button_text = f"{yymmdd_date} {att['event_title']}{status_suffix}"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=f"attendance_detail_{att['id']}")])

    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    await context.bot.send_message(
        chat_id=query.message.chat_id,
        text=text,
        reply_markup=reply_markup
    )


async def attendance_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """출석 상세 정보"""
    query = update.callback_query
    await query.answer()

    attendance_id = int(query.data.replace('attendance_detail_', ''))

    # 출석 정보 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, e.title as event_title, e.event_date, e.event_time, e.location, e.pay_amount,
                   w.name as worker_name
            FROM attendance a
            JOIN events e ON a.event_id = e.id
            JOIN workers w ON a.worker_id = w.id
            WHERE a.id = ?
        """, (attendance_id,))
        att = cursor.fetchone()

    if not att:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 출석 정보를 찾을 수 없습니다.", reply_markup=reply_markup)
        return

    att = dict(att)

    # 출석 권한 확인
    worker = get_worker(update.effective_user.id)
    if not worker or att['worker_id'] != worker['id']:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 본인의 출석 정보만 확인할 수 있습니다.", reply_markup=reply_markup)
        return

    # 급여 계산 (프리랜서 3.3% 공제)
    gross_pay = att['pay_amount']
    income_tax = int(gross_pay * 0.03)  # 소득세 3%
    local_tax = int(gross_pay * 0.003)  # 지방소득세 0.3%
    total_deduction = income_tax + local_tax
    net_pay = gross_pay - total_deduction

    status_text = {
        'PENDING': '⏳ 대기',
        'CHECKED_IN': '✅ 출근완료',
        'COMPLETED': '🎉 퇴근완료'
    }.get(att['status'], att['status'])

    check_in = att['check_in_time'].split('.')[0] if att.get('check_in_time') else '미체크'
    check_out = att['check_out_time'].split('.')[0] if att.get('check_out_time') else '미체크'

    # 날짜를 YYMMDD 형식으로 변환
    from utils import extract_yymmdd
    yymmdd_date = extract_yymmdd(att['event_date'])

    # 생년월일 YYMMDD 형식으로 표시
    birth_date = worker.get('birth_date', '')
    if birth_date and len(birth_date) >= 6:
        # YYMMDD 형식으로 변환 (예: 2000-01-15 -> 000115)
        birth_yymmdd = birth_date.replace('-', '')[-6:] if '-' in birth_date else birth_date[:6]
    else:
        birth_yymmdd = birth_date

    text = f"""
💰 프리랜서 지급명세서

이름: {worker['name']}
생년월일: {birth_yymmdd}
연락처: {worker['phone']}

회사명: (주)엘케이프라이빗
사업자등록번호: 635-86-01148
대표자명: 김재영

━━━━━━━━━━━━━━━━
📋 지급 정보
━━━━━━━━━━━━━━━━
지급일: 차주 수요일
용역 제공 기간: {att['event_date']} {att['event_title']}

━━━━━━━━━━━━━━━━
💵 지급 금액
━━━━━━━━━━━━━━━━
지급총액: {gross_pay:,}원
소득세(3%): {income_tax:,}원
지방소득세(0.3%): {local_tax:,}원
공제합계: {total_deduction:,}원
━━━━━━━━━━━━━━━━
실지급액: {net_pay:,}원

━━━━━━━━━━━━━━━━
상태: {status_text}
출근: {check_in}
퇴근: {check_out}
"""

    keyboard = []

    # 상태별 처리 버튼
    if att['status'] == 'PENDING':
        keyboard.append([InlineKeyboardButton("✅ 출석 처리", callback_data=f"do_checkin_{attendance_id}")])
    elif att['status'] == 'CHECKED_IN':
        keyboard.append([InlineKeyboardButton("🎉 퇴근 처리", callback_data=f"do_checkout_{attendance_id}")])

    keyboard.append([InlineKeyboardButton("🔙 출석 목록", callback_data="my_attendance_list")])
    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def do_checkin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """출석 처리 (버튼 클릭)"""
    query = update.callback_query
    await query.answer()

    attendance_id = int(query.data.replace('do_checkin_', ''))

    # 출석 정보 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, e.title as event_title
            FROM attendance a
            JOIN events e ON a.event_id = e.id
            WHERE a.id = ?
        """, (attendance_id,))
        attendance = cursor.fetchone()

    if not attendance:
        await query.answer("❌ 출석 정보를 찾을 수 없습니다.", show_alert=True)
        return

    attendance = dict(attendance)

    # 권한 확인
    worker = get_worker(update.effective_user.id)
    if not worker or attendance['worker_id'] != worker['id']:
        await query.answer("❌ 본인의 출석 정보만 처리할 수 있습니다.", show_alert=True)
        return

    if attendance['status'] != 'PENDING':
        await query.answer("ℹ️ 이미 출석 처리되었습니다.", show_alert=True)
        return

    # 출석 처리
    db.check_in(attendance_id)

    # 출근 시간 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT check_in_time FROM attendance WHERE id = ?", (attendance_id,))
        result = cursor.fetchone()
        check_in_time = result['check_in_time'] if result else None

    await query.answer("✅ 출근완료!", show_alert=True)

    # 기존 메시지 삭제
    try:
        await query.message.delete()
    except Exception as e:
        logger.warning(f"Failed to delete message: {e}")

    # 출근완료 알림 전송
    try:
        await context.bot.send_message(
            chat_id=update.effective_user.id,
            text=f"✅ 출근완료 알림\n\n"
                 f"📋 행사: {attendance['event_title']}\n"
                 f"⏰ 출근시간: {check_in_time}\n\n"
                 f"근무를 시작해주세요!"
        )
    except Exception as e:
        logger.error(f"Failed to send check-in notification: {e}")

    # 출석 목록 표시
    # 새로운 context로 my_attendance_list 호출하기 위해 임시 메시지 객체 생성
    from telegram import CallbackQuery

    # 출석 목록 조회 및 표시
    worker = get_worker(update.effective_user.id)
    if not worker:
        return

    # 내 출석 기록 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, e.title as event_title, e.event_date, e.event_time, e.location
            FROM attendance a
            JOIN events e ON a.event_id = e.id
            WHERE a.worker_id = ?
            ORDER BY e.event_date DESC, a.created_at DESC
            LIMIT 20
        """, (worker['id'],))
        attendances = [dict(row) for row in cursor.fetchall()]

    if not attendances:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await context.bot.send_message(
            chat_id=update.effective_user.id,
            text="📊 출석 기록이 없습니다.\n\n"
                 "근무 확정 후 출석 기록이 생성됩니다.",
            reply_markup=reply_markup
        )
        return

    # 상태별 분류
    pending = [a for a in attendances if a['status'] == 'PENDING']
    checked_in = [a for a in attendances if a['status'] == 'CHECKED_IN']
    completed = [a for a in attendances if a['status'] == 'COMPLETED']

    text = f"📊 내 출석 목록 (총 {len(attendances)}건)\n\n"
    text += f"⏳ 대기: {len(pending)}건\n"
    text += f"✅ 출근완료: {len(checked_in)}건\n"
    text += f"🎉 퇴근완료: {len(completed)}건\n"
    text += f"━━━━━━━━━━━━━━━━\n\n"
    text += "출석 기록을 선택하세요:"

    keyboard = []
    for att in attendances[:15]:
        # 날짜를 YYMMDD 형식으로 변환
        from utils import extract_yymmdd
        yymmdd_date = extract_yymmdd(att['event_date'])

        # 퇴근완료 상태에는 (퇴근완료) 텍스트 추가
        status_suffix = " (퇴근완료)" if att['status'] == 'COMPLETED' else ""

        # 왼쪽 정렬을 위해 날짜를 앞에 배치
        button_text = f"{yymmdd_date} {att['event_title']}{status_suffix}"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=f"attendance_detail_{att['id']}")])

    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    await context.bot.send_message(
        chat_id=update.effective_user.id,
        text=text,
        reply_markup=reply_markup
    )


async def do_checkout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """퇴근 처리 (버튼 클릭)"""
    query = update.callback_query
    await query.answer()

    attendance_id = int(query.data.replace('do_checkout_', ''))

    # 출석 정보 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, e.title as event_title, e.pay_amount
            FROM attendance a
            JOIN events e ON a.event_id = e.id
            WHERE a.id = ?
        """, (attendance_id,))
        attendance = cursor.fetchone()

    if not attendance:
        await query.answer("❌ 출석 정보를 찾을 수 없습니다.", show_alert=True)
        return

    attendance = dict(attendance)
    event_title = attendance['event_title']
    pay_amount = attendance['pay_amount']

    # 권한 확인
    worker = get_worker(update.effective_user.id)
    if not worker or attendance['worker_id'] != worker['id']:
        await query.answer("❌ 본인의 출석 정보만 처리할 수 있습니다.", show_alert=True)
        return

    if attendance['status'] != 'CHECKED_IN':
        await query.answer("❌ 출석 후에만 퇴근 처리가 가능합니다.", show_alert=True)
        return

    # 퇴근 처리
    db.check_out(attendance_id)

    # 블록체인 기록 시도
    try:
        from chain import polygon_chain
        import hashlib
        import json

        event = db.get_event(attendance['event_id'])

        # 출석 정보 다시 조회 (worked_minutes 포함)
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
            # DB에 TX 정보 저장
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
            blockchain_msg = "⛓️ 블록체인 기록 완료!"
        else:
            blockchain_msg = "⚠️ 블록체인 기록 실패"
    except Exception as e:
        logger.error(f"Blockchain recording failed: {e}")
        blockchain_msg = "⚠️ 블록체인 기록 중 오류"

    # 급여 계산 (3.3% 공제)
    net_pay = int(pay_amount * 0.967)

    await query.answer(f"✅ 퇴근완료! {blockchain_msg}", show_alert=True)

    # 기존 메시지 삭제
    try:
        await query.message.delete()
    except Exception as e:
        logger.warning(f"Failed to delete message: {e}")

    # 퇴근완료 알림 전송
    try:
        await context.bot.send_message(
            chat_id=update.effective_user.id,
            text=f"🎉 퇴근완료 알림\n\n"
                 f"📋 행사: {event_title}\n"
                 f"⏰ 출근시간: {attendance['check_in_time']}\n"
                 f"⏰ 퇴근시간: {attendance['check_out_time']}\n"
                 f"💰 지급예정액: {net_pay:,}원 (3.3% 공제 후)\n\n"
                 f"수고하셨습니다!"
        )
    except Exception as e:
        logger.error(f"Failed to send check-out notification: {e}")

    # 출석 목록 표시
    worker = get_worker(update.effective_user.id)
    if not worker:
        return

    # 내 출석 기록 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, e.title as event_title, e.event_date, e.event_time, e.location
            FROM attendance a
            JOIN events e ON a.event_id = e.id
            WHERE a.worker_id = ?
            ORDER BY e.event_date DESC, a.created_at DESC
            LIMIT 20
        """, (worker['id'],))
        attendances = [dict(row) for row in cursor.fetchall()]

    if not attendances:
        keyboard = [[InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await context.bot.send_message(
            chat_id=update.effective_user.id,
            text="📊 출석 기록이 없습니다.\n\n"
                 "근무 확정 후 출석 기록이 생성됩니다.",
            reply_markup=reply_markup
        )
        return

    # 상태별 분류
    pending = [a for a in attendances if a['status'] == 'PENDING']
    checked_in = [a for a in attendances if a['status'] == 'CHECKED_IN']
    completed = [a for a in attendances if a['status'] == 'COMPLETED']

    text = f"📊 내 출석 목록 (총 {len(attendances)}건)\n\n"
    text += f"⏳ 대기: {len(pending)}건\n"
    text += f"✅ 출근완료: {len(checked_in)}건\n"
    text += f"🎉 퇴근완료: {len(completed)}건\n"
    text += f"━━━━━━━━━━━━━━━━\n\n"
    text += "출석 기록을 선택하세요:"

    keyboard = []
    for att in attendances[:15]:
        # 날짜를 YYMMDD 형식으로 변환
        from utils import extract_yymmdd
        yymmdd_date = extract_yymmdd(att['event_date'])

        # 퇴근완료 상태에는 (퇴근완료) 텍스트 추가
        status_suffix = " (퇴근완료)" if att['status'] == 'COMPLETED' else ""

        # 왼쪽 정렬을 위해 날짜를 앞에 배치
        button_text = f"{yymmdd_date} {att['event_title']}{status_suffix}"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=f"attendance_detail_{att['id']}")])

    keyboard.append([InlineKeyboardButton("🏠 메인 메뉴", callback_data="main_menu")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    await context.bot.send_message(
        chat_id=update.effective_user.id,
        text=text,
        reply_markup=reply_markup
    )


# ===== 새로운 메뉴 핸들러들 =====
async def job_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """근무지원하기 - 진행 중인 행사 목록"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)
    if not worker:
        keyboard = [[InlineKeyboardButton("📝 회원가입", callback_data="start_registration")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 등록되지 않은 사용자입니다.", reply_markup=reply_markup)
        return

    # OPEN 상태 행사 목록
    events = db.list_events(status='OPEN', limit=20)

    if not events:
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "💼 지원 가능한 행사가 없습니다.",
            reply_markup=reply_markup
        )
        return

    text = f"💼 지원 가능한 행사 ({len(events)}건)\n\n"
    keyboard = []

    for event in events:
        button_text = f"{event['short_code']} - {event['title']}"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=f"apply_{event['id']}")])

    keyboard.append([InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(text, reply_markup=reply_markup)


async def verify_work(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """블록체인으로 내 근무 검증하기"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)
    if not worker:
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("❌ 등록되지 않은 사용자입니다.", reply_markup=reply_markup)
        return

    chain_logs = db.get_chain_logs_by_worker(worker['id'])

    if not chain_logs:
        keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "⛓️ 블록체인에 기록된 근무가 없습니다.",
            reply_markup=reply_markup
        )
        return

    from chain import polygon_chain

    text = f"⛓️ 블록체인 검증 (총 {len(chain_logs)}건)\n\n"

    for log in chain_logs[:5]:
        text += f"━━━━━━━━━━━━━━━━\n"
        text += f"📋 {log['event_title']}\n"
        text += f"📅 {log['event_date']}\n"
        text += f"⏱ {log['worked_minutes']}분\n"

        if log['tx_hash']:
            text += f"✅ 블록체인 기록 완료\n"
            text += f"TX: {log['tx_hash'][:16]}...\n"
            explorer_url = polygon_chain.get_block_explorer_url(log['tx_hash'])
            text += f"🔗 {explorer_url}\n"
        else:
            text += f"⏳ 블록체인 기록 대기 중\n"

    text += f"━━━━━━━━━━━━━━━━\n"

    keyboard = [[InlineKeyboardButton("🏠 처음으로", callback_data="main_menu")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(text, reply_markup=reply_markup)


# ===== 메인 메뉴 =====
async def main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """메인 메뉴로 돌아가기"""
    query = update.callback_query
    await query.answer()

    worker = get_worker(update.effective_user.id)
    if not worker:
        # 기존 메시지 삭제
        try:
            await query.message.delete()
        except Exception as e:
            logger.warning(f"Failed to delete message: {e}")

        keyboard = [[InlineKeyboardButton("📝 회원가입", callback_data="start_registration")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="❌ 등록되지 않은 사용자입니다.\n\n/start 명령어로 회원가입을 진행해주세요.",
            reply_markup=reply_markup
        )
        return

    # 기존 메시지 삭제
    try:
        await query.message.delete()
    except Exception as e:
        logger.warning(f"Failed to delete message: {e}")

    reply_markup = get_main_keyboard()

    # 새 메시지 전송
    await context.bot.send_message(
        chat_id=query.message.chat_id,
        text=f"👋 {worker['name']}님\n\n"
             f"(주)엘케이프라이빗\n\n"
             f"아래 메뉴에서 원하는 작업을 선택하세요:",
        reply_markup=reply_markup
    )


# ===== 취소 =====
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """대화 취소"""
    await update.message.reply_text(
        "❌ 취소되었습니다.",
        reply_markup=get_main_keyboard()
    )
    context.user_data.clear()
    return ConversationHandler.END


# ===== 메인 함수 =====
def main():
    """봇 실행"""
    token = os.getenv('WORKER_BOT_TOKEN')
    if not token:
        logger.error("WORKER_BOT_TOKEN not found in environment variables")
        return

    # Application 생성
    application = Application.builder().token(token).build()

    # Conversation handler: 등록
    reg_conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            REG_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, reg_name)],
            REG_BIRTH: [MessageHandler(filters.TEXT & ~filters.COMMAND, reg_birth)],
            REG_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, reg_phone)],
            REG_RESIDENCE: [MessageHandler(filters.TEXT & ~filters.COMMAND, reg_residence)],
            REG_FACE_PHOTO: [MessageHandler(filters.PHOTO, reg_face_photo)],
            REG_DRIVER_LICENSE: [
                CallbackQueryHandler(reg_driver_license, pattern="^driver_(yes|no)$")
            ],
            REG_SECURITY_CERT: [
                CallbackQueryHandler(reg_security_cert, pattern="^security_(yes|no)$")
            ],
            REG_BANK: [MessageHandler(filters.TEXT & ~filters.COMMAND, reg_bank)],
            REG_ACCOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, reg_account)],
            REG_CONTRACT: [
                CallbackQueryHandler(reg_contract, pattern="^contract_signed$")
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True
    )

    # Conversation handler: 정보 수정
    edit_conv = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(edit_field_selected, pattern="^edit_(name|birth|phone|residence|face_photo|driver|security|bank|account)$")
        ],
        states={
            EDIT_VALUE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, edit_value_entered),
                MessageHandler(filters.PHOTO, edit_value_entered),
                CallbackQueryHandler(edit_value_entered, pattern="^(driver|security)_(yes|no)$")
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    # Conversation handler: 출석
    attendance_conv = ConversationHandler(
        entry_points=[CommandHandler("checkin", attendance_command)],
        states={
            ATTENDANCE_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, attendance_code_entered)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    # Conversation handler: 퇴근
    checkout_conv = ConversationHandler(
        entry_points=[CommandHandler("checkout", checkout_command)],
        states={
            CHECKOUT_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, checkout_code_entered)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    # 핸들러 등록
    application.add_handler(reg_conv)
    application.add_handler(edit_conv)
    application.add_handler(attendance_conv)
    application.add_handler(checkout_conv)

    # Callback handlers
    application.add_handler(CallbackQueryHandler(main_menu, pattern="^main_menu$"))
    application.add_handler(CallbackQueryHandler(my_info, pattern="^my_info$"))
    application.add_handler(CallbackQueryHandler(edit_info, pattern="^edit_info$"))
    application.add_handler(CallbackQueryHandler(my_applications, pattern="^my_applications$"))
    application.add_handler(CallbackQueryHandler(application_detail, pattern="^app_detail_\d+$"))
    application.add_handler(CallbackQueryHandler(cancel_application, pattern="^cancel_app_\d+$"))
    application.add_handler(CallbackQueryHandler(my_work_logs, pattern="^my_work_logs$"))
    application.add_handler(CallbackQueryHandler(apply_for_event, pattern="^apply_\d+$"))
    application.add_handler(CallbackQueryHandler(job_search, pattern="^job_search$"))
    application.add_handler(CallbackQueryHandler(verify_work, pattern="^verify_work$"))
    application.add_handler(CallbackQueryHandler(my_attendance_list, pattern="^my_attendance_list$"))
    application.add_handler(CallbackQueryHandler(attendance_detail, pattern="^attendance_detail_\d+$"))
    application.add_handler(CallbackQueryHandler(do_checkin, pattern="^do_checkin_\d+$"))
    application.add_handler(CallbackQueryHandler(do_checkout, pattern="^do_checkout_\d+$"))

    # 봇 실행
    logger.info("Worker bot started")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
