"""
전자근로계약서 발송
"""
import os
import logging
from typing import Dict

logger = logging.getLogger(__name__)


def send_contract_link(worker: Dict, bot_send_message_func):
    """
    전자근로계약서 링크 발송

    Args:
        worker: 근무자 정보
        bot_send_message_func: 텔레그램 메시지 발송 함수
    """
    template_url = os.getenv('CONTRACT_TEMPLATE_URL', '')

    if not template_url:
        logger.warning("CONTRACT_TEMPLATE_URL not configured")
        return

    # 링크 생성 (worker_id 포함)
    contract_url = template_url.format(worker_id=worker['id'])

    message = f"""
📄 전자근로계약서

{worker['name']}님, 안녕하세요!

근무자 등록이 완료되었습니다.
아래 링크에서 전자근로계약서를 확인하고 서명해주세요.

🔗 계약서 링크:
{contract_url}

※ 계약서 서명 후 근무 지원이 가능합니다.

문의사항이 있으시면 언제든지 문의해주세요.

⛓️ WorkProof Chain by LK
"""

    try:
        bot_send_message_func(
            chat_id=worker['telegram_id'],
            text=message
        )
        logger.info(f"Contract link sent to worker {worker['id']}")
    except Exception as e:
        logger.error(f"Failed to send contract link: {e}")
