"""
엑셀 급여 명세서 생성
"""
import os
from datetime import datetime
from typing import List, Dict
import logging
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from utils import calculate_net_pay, format_phone, get_bank_code, extract_yymmdd, now_kst

logger = logging.getLogger(__name__)


class PayrollExporter:
    """급여 명세서 엑셀 생성 클래스"""

    def __init__(self, export_dir: str):
        self.export_dir = export_dir
        os.makedirs(export_dir, exist_ok=True)

    def generate_event_payroll(self, event: Dict, attendances: List[Dict],
                                workers: Dict[int, Dict]) -> str:
        """
        행사별 급여 명세서 생성

        Args:
            event: 행사 정보
            attendances: 출석 기록 리스트
            workers: 근무자 정보 dict (worker_id -> worker)

        Returns:
            str: 생성된 파일 경로
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "급여명세서"

        # 제목
        ws.merge_cells('A1:J1')
        title_cell = ws['A1']
        title_cell.value = f"[{event['title']}] 급여 명세서"
        title_cell.font = Font(size=16, bold=True)
        title_cell.alignment = Alignment(horizontal='center', vertical='center')

        # 행사 정보
        ws.merge_cells('A2:J2')
        info_cell = ws['A2']
        info_cell.value = f"행사일: {event['event_date']} | 장소: {event['location']}"
        info_cell.alignment = Alignment(horizontal='center')

        # 헤더
        headers = [
            "날짜", "행사명", "이름", "생년월일", "은행", "은행코드",
            "계좌번호", "3.3%공제후금액", "세전금액", "연락처"
        ]

        header_row = 4
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=header_row, column=col)
            cell.value = header
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = self._get_border()

        # 데이터 입력
        row = header_row + 1
        total_deduction = 0
        total_gross_pay = 0

        # 날짜를 YYMMDD 형식으로 변환
        yymmdd_date = extract_yymmdd(event['event_date'])

        for att in attendances:
            worker = workers.get(att['worker_id'], {})

            # 급여 계산
            gross_pay = event['pay_amount']
            net_pay = int(gross_pay * 0.967)  # 3.3% 공제 후 금액

            total_gross_pay += gross_pay
            total_deduction += net_pay

            # 은행코드 자동 매칭
            bank_name = worker.get('bank_name', '')
            bank_code = get_bank_code(bank_name) if bank_name else ''

            # 데이터
            data_row = [
                yymmdd_date,  # 날짜 (YYMMDD)
                event['title'],  # 행사명
                worker.get('name', ''),  # 이름
                worker.get('birth_date', ''),  # 생년월일
                bank_name,  # 은행
                bank_code,  # 은행코드 (자동 매칭)
                worker.get('bank_account', ''),  # 계좌번호
                net_pay,  # 3.3% 공제 후 금액 (자동 계산)
                gross_pay,  # 세전금액
                format_phone(worker.get('phone', ''))  # 연락처
            ]

            for col, value in enumerate(data_row, start=1):
                cell = ws.cell(row=row, column=col)
                cell.value = value
                cell.alignment = Alignment(horizontal='center', vertical='center')
                cell.border = self._get_border()

                # 금액 컬럼은 숫자 포맷
                if col in [8, 9]:
                    cell.number_format = '#,##0'

            row += 1

        # 합계 행
        total_row = row
        ws.merge_cells(f'A{total_row}:G{total_row}')
        total_cell = ws.cell(row=total_row, column=1)
        total_cell.value = f"합계 ({len(attendances)}명)"
        total_cell.font = Font(bold=True)
        total_cell.alignment = Alignment(horizontal='center', vertical='center')
        total_cell.fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")
        total_cell.border = self._get_border()

        for col in range(1, 8):
            ws.cell(row=total_row, column=col).border = self._get_border()
            ws.cell(row=total_row, column=col).fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")

        # 합계 금액 - 3.3% 공제 후 금액
        ws.cell(row=total_row, column=8).value = total_deduction
        ws.cell(row=total_row, column=8).number_format = '#,##0'
        ws.cell(row=total_row, column=8).font = Font(bold=True)
        ws.cell(row=total_row, column=8).border = self._get_border()
        ws.cell(row=total_row, column=8).fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")

        # 합계 금액 - 세전금액
        ws.cell(row=total_row, column=9).value = total_gross_pay
        ws.cell(row=total_row, column=9).number_format = '#,##0'
        ws.cell(row=total_row, column=9).font = Font(bold=True)
        ws.cell(row=total_row, column=9).border = self._get_border()
        ws.cell(row=total_row, column=9).fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")

        # 마지막 컬럼 (연락처) - 빈칸
        ws.cell(row=total_row, column=10).border = self._get_border()
        ws.cell(row=total_row, column=10).fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")

        # 컬럼 너비 조정
        column_widths = {
            'A': 12,  # 날짜
            'B': 20,  # 행사명
            'C': 12,  # 이름
            'D': 12,  # 생년월일
            'E': 12,  # 은행
            'F': 12,  # 은행코드
            'G': 18,  # 계좌번호
            'H': 18,  # 3.3%공제후금액
            'I': 15,  # 세전금액
            'J': 15   # 연락처
        }
        for col, width in column_widths.items():
            ws.column_dimensions[col].width = width

        # 행 높이
        ws.row_dimensions[1].height = 30
        ws.row_dimensions[2].height = 20
        ws.row_dimensions[header_row].height = 25

        # 파일명 생성 (한국 시간)
        filename = f"급여명세_{event['short_code']}_{now_kst().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath = os.path.join(self.export_dir, filename)

        # 저장
        wb.save(filepath)
        logger.info(f"Payroll exported: {filepath}")

        return filepath

    def _get_border(self) -> Border:
        """테두리 스타일"""
        thin = Side(border_style="thin", color="000000")
        return Border(left=thin, right=thin, top=thin, bottom=thin)
