"""Email Service for verification codes"""
import smtplib
import random
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

from ..config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """이메일 발송 서비스"""

    def __init__(self):
        self.settings = get_settings()

    @property
    def enabled(self) -> bool:
        """이메일 서비스 활성화 여부"""
        return bool(self.settings.SMTP_USER and self.settings.SMTP_PASSWORD)

    def _generate_code(self, length: int = 6) -> str:
        """인증번호 생성 (6자리 숫자)"""
        return ''.join(random.choices('0123456789', k=length))

    def send_email(self, to_email: str, subject: str, body: str) -> bool:
        """이메일 발송"""
        if not self.enabled:
            logger.warning("Email service not configured. Skipping email send.")
            return False

        try:
            msg = MIMEMultipart()
            msg['From'] = f"{self.settings.SMTP_FROM_NAME} <{self.settings.SMTP_USER}>"
            msg['To'] = to_email
            msg['Subject'] = subject

            msg.attach(MIMEText(body, 'html', 'utf-8'))

            with smtplib.SMTP(self.settings.SMTP_HOST, self.settings.SMTP_PORT) as server:
                server.starttls()
                server.login(self.settings.SMTP_USER, self.settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info(f"Email sent to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    def send_verification_code(self, email: str) -> tuple[str, datetime]:
        """인증번호 생성 및 이메일 발송

        Returns:
            tuple: (인증번호, 만료시간)
        """
        code = self._generate_code()
        expires_at = datetime.now() + timedelta(minutes=self.settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)

        subject = "[WorkProof] 이메일 인증번호"
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #333;">이메일 인증</h2>
            <p>아래 인증번호를 입력해주세요.</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #007bff;">
                    {code}
                </span>
            </div>
            <p style="color: #666; font-size: 14px;">
                이 인증번호는 {self.settings.EMAIL_VERIFICATION_EXPIRE_MINUTES}분간 유효합니다.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
                본인이 요청하지 않았다면 이 이메일을 무시해주세요.
            </p>
        </body>
        </html>
        """

        if self.enabled:
            self.send_email(email, subject, body)
        else:
            # 개발 모드: 로그에 인증번호 출력
            logger.info(f"[DEV MODE] Verification code for {email}: {code}")

        return code, expires_at


# 싱글톤 인스턴스
email_service = EmailService()
