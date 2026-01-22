"""
관리자 입력 파싱 및 표준 모집글 생성
"""
import re
from typing import Dict
from models import ParsedEvent


class EventParser:
    """행사 입력 파싱 클래스"""

    def __init__(self):
        self.required_fields = [
            'title', 'date', 'time', 'location',
            'pay', 'dress_code', 'application_method', 'manager'
        ]

    def parse(self, text: str) -> ParsedEvent:
        """
        관리자 입력 텍스트를 파싱하여 표준화된 데이터로 변환

        Args:
            text: 관리자가 입력한 원본 텍스트

        Returns:
            ParsedEvent: 파싱된 행사 정보
        """
        lines = text.strip().split('\n')
        data = {
            'title': '',
            'date': '',
            'time': '',
            'location': '',
            'pay': '',
            'pay_description': '',
            'meal': '',
            'dress_code': '',
            'age': '',
            'application_method': '',
            'manager': ''
        }

        # 첫 줄은 보통 행사명
        if lines:
            first_line = lines[0].strip().lstrip('●').lstrip('-').strip()
            if not any(keyword in first_line for keyword in ['날짜', '시간', '장소', '페이', '복장']):
                data['title'] = first_line

        # 각 줄을 순회하며 키워드 매칭
        for i, line in enumerate(lines):
            line = line.strip()

            # 날짜 추출
            if '날짜' in line or re.search(r'\d{1,2}월\s*\d{1,2}일', line):
                data['date'] = self._extract_date(line, lines[i:i+3])

            # 시간 추출
            elif '시간' in line:
                data['time'] = self._extract_time(line, lines[i:i+5])

            # 장소 추출
            elif '장소' in line:
                data['location'] = self._extract_field(line, '장소')

            # 페이 추출
            elif '페이' in line or '급여' in line or '일급' in line:
                pay_info = self._extract_pay(line, lines[i:i+3])
                data['pay'] = pay_info['pay']
                data['pay_description'] = pay_info['description']

            # 식사 추출
            elif '식사' in line:
                data['meal'] = '제공' if '제공' in line else '미제공'

            # 복장 추출
            elif '복장' in line:
                data['dress_code'] = self._extract_field(line, '복장')
                # 다음 줄도 복장 내용일 수 있음
                if i + 1 < len(lines) and not any(k in lines[i+1] for k in ['연령', '지원', '담당']):
                    data['dress_code'] += ' ' + lines[i+1].strip()

            # 연령 추출
            elif '연령' in line:
                data['age'] = self._extract_field(line, '연령')

            # 지원 방법 추출
            elif '지원' in line or 'only' in line.lower():
                data['application_method'] = self._extract_application_method(line)

            # 담당자 추출
            elif '담당' in line or re.search(r'010[-\s]?\d{4}[-\s]?\d{4}', line):
                data['manager'] = self._extract_manager(line)

        # 페이 금액 숫자만 추출
        pay_amount = self._extract_pay_amount(data['pay'])

        # 누락 필드 확인
        missing = []
        for field in self.required_fields:
            if not data.get(field):
                missing.append(field)

        return ParsedEvent(
            title=data['title'] or '미기재',
            date=data['date'] or '미기재',
            time=data['time'] or '미기재',
            location=data['location'] or '미기재',
            pay=data['pay'] or '미기재',
            pay_amount=pay_amount,
            pay_description=data['pay_description'],
            meal=data['meal'] or '미기재',
            dress_code=data['dress_code'] or '미기재',
            age=data['age'] or '무관',
            application_method=data['application_method'] or '미기재',
            manager=data['manager'] or '미기재',
            missing_fields=missing
        )

    def _extract_field(self, line: str, keyword: str) -> str:
        """필드 추출 (콜론 뒤 내용)"""
        line = line.replace('●', '').replace('*', '').strip()
        if ':' in line:
            return line.split(':', 1)[1].strip()
        elif keyword in line:
            return line.replace(keyword, '', 1).strip()
        return line.strip()

    def _extract_date(self, line: str, context_lines: list) -> str:
        """날짜 추출 (예: 1월 25일 일요일)"""
        date_text = self._extract_field(line, '날짜')

        # 여러 줄에 걸쳐 있을 수 있음
        for next_line in context_lines[1:3]:
            if re.search(r'\d{1,2}월\s*\d{1,2}일', next_line):
                date_text += ' ' + next_line.strip()
                break

        return date_text.strip()

    def _extract_time(self, line: str, context_lines: list) -> str:
        """시간 추출 (여러 줄 가능)"""
        time_parts = [self._extract_field(line, '시간')]

        # 다음 줄들도 시간 정보일 수 있음 (예: 안양 : 09시00분~21시00분)
        for next_line in context_lines[1:5]:
            next_line = next_line.strip()
            if not next_line or any(k in next_line for k in ['장소', '페이', '복장', '연령']):
                break
            if re.search(r'\d{1,2}시|:\s*\d{1,2}', next_line):
                time_parts.append(next_line)

        return '\n'.join(time_parts).strip()

    def _extract_pay(self, line: str, context_lines: list) -> Dict[str, str]:
        """페이 추출 (금액 + 설명)"""
        pay_text = self._extract_field(line, '페이')
        description_parts = []

        # 다음 줄도 페이 관련 정보일 수 있음
        for next_line in context_lines[1:3]:
            next_line = next_line.strip().lstrip('(').rstrip(')')
            if not next_line or any(k in next_line for k in ['식사', '복장', '연령', '지원', '담당']):
                break
            if '공제' in next_line or '지급' in next_line or '수당' in next_line:
                description_parts.append(next_line)

        return {
            'pay': pay_text,
            'description': ', '.join(description_parts) if description_parts else ''
        }

    def _extract_pay_amount(self, pay_str: str) -> int:
        """페이 문자열에서 숫자만 추출"""
        # "15만원" -> 150000
        match = re.search(r'(\d+)\s*만\s*원', pay_str)
        if match:
            return int(match.group(1)) * 10000

        # "150000원" or "150,000원" -> 150000
        match = re.search(r'(\d{1,3}(?:,\d{3})*)', pay_str)
        if match:
            return int(match.group(1).replace(',', ''))

        return 0

    def _extract_application_method(self, line: str) -> str:
        """지원 방법 추출"""
        line = line.replace('●', '').replace('*', '').strip()
        if 'only' in line.lower():
            return line
        return self._extract_field(line, '지원')

    def _extract_manager(self, line: str) -> str:
        """담당자 정보 추출"""
        line = line.replace('●', '').replace('*', '').strip()
        return self._extract_field(line, '담당')

    def generate_posting(self, parsed: ParsedEvent, deep_link: str) -> str:
        """
        표준 모집글 생성

        Args:
            parsed: 파싱된 행사 정보
            deep_link: 근무자봇 지원 링크

        Returns:
            str: 표준 형식의 모집글
        """
        meal_text = f"🍱 식사: {parsed.meal}" if parsed.meal != '미기재' else ""
        pay_desc = f"\n🧾 정산: {parsed.pay_description}" if parsed.pay_description else ""

        posting = f"""[모집] {parsed.title}
━━━━━━━━━━━━━━━━
📅 날짜: {parsed.date}
⏰ 시간: {parsed.time}
📍 장소: {parsed.location}
💰 페이: {parsed.pay}{pay_desc}
{meal_text}
👔 복장: {parsed.dress_code}
🎯 연령: {parsed.age}
📩 지원: {parsed.application_method}
👤 담당: {parsed.manager}
━━━━━━━━━━━━━━━━
✅ 지원하기(근무자봇): {deep_link}
"""

        # 빈 줄 제거
        posting = '\n'.join([line for line in posting.split('\n') if line.strip() or line == '━━━━━━━━━━━━━━━━'])

        return posting

    def generate_warning(self, missing_fields: list) -> str:
        """누락 필드 경고 메시지 생성"""
        if not missing_fields:
            return "✅ 모든 필수 항목이 입력되었습니다."

        field_names = {
            'title': '행사명',
            'date': '날짜',
            'time': '시간',
            'location': '장소',
            'pay': '페이',
            'dress_code': '복장',
            'application_method': '지원방법',
            'manager': '담당자'
        }

        missing_names = [field_names.get(f, f) for f in missing_fields]

        return f"⚠️ 누락된 항목: {', '.join(missing_names)}\n자동으로 '미기재'로 표시됩니다."
