/**
 * 안전한 포맷팅 유틸리티 함수들
 * NaN, null, undefined 값을 안전하게 처리합니다.
 */

/**
 * 금액 포맷 (원화)
 * @param {number|null|undefined} amount - 금액
 * @param {string} fallback - null/NaN일 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function formatPay(amount, fallback = '-') {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return fallback;
  }
  return `${Number(amount).toLocaleString()}원`;
}

/**
 * 금액 포맷 (만원 단위)
 * @param {number|null|undefined} amount - 금액
 * @param {string} fallback - null/NaN일 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function formatPayShort(amount, fallback = '-') {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return fallback;
  }
  const value = Number(amount) / 10000;
  return `${value.toFixed(0)}만원`;
}

/**
 * 실수령액 계산 (3.3% 원천징수)
 * @param {number|null|undefined} grossPay - 세전 금액
 * @returns {number}
 */
export function calculateNetPay(grossPay) {
  if (!grossPay || isNaN(grossPay)) return 0;
  const taxRate = 0.033; // 소득세 3% + 지방소득세 0.3%
  return Math.round(grossPay * (1 - taxRate));
}

/**
 * 날짜 포맷 (M월 D일)
 * @param {string|null|undefined} dateStr - YYYY-MM-DD 형식의 날짜
 * @param {string} fallback - null일 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function formatDate(dateStr, fallback = '-') {
  if (!dateStr) return fallback;
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return `${parseInt(parts[parts.length - 2])}월 ${parseInt(parts[parts.length - 1])}일`;
  }
  return dateStr;
}

/**
 * 날짜 포맷 (M/D)
 * @param {string|null|undefined} dateStr - YYYY-MM-DD 형식의 날짜
 * @param {string} fallback - null일 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function formatDateShort(dateStr, fallback = '-') {
  if (!dateStr) return fallback;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  }
  return dateStr;
}

/**
 * 근무 시간 포맷 (X시간 Y분)
 * @param {number|null|undefined} minutes - 근무 분
 * @param {string} fallback - null일 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function formatWorkedTime(minutes, fallback = '-') {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return fallback;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}시간 ${mins}분`;
  } else if (hours > 0) {
    return `${hours}시간`;
  } else {
    return `${mins}분`;
  }
}

/**
 * 숫자 포맷 (천 단위 콤마)
 * @param {number|null|undefined} value - 숫자
 * @param {string} fallback - null/NaN일 때 표시할 값 (기본: '0')
 * @returns {string}
 */
export function formatNumber(value, fallback = '0') {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return Number(value).toLocaleString();
}

/**
 * 안전한 숫자 변환
 * @param {any} value - 변환할 값
 * @param {number} defaultValue - NaN일 때 기본값 (기본: 0)
 * @returns {number}
 */
export function safeNumber(value, defaultValue = 0) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * 시간 포맷 (HH:MM) - T 제거, 분까지만 표시
 * @param {string|null|undefined} timeStr - 시간 문자열 (datetime 또는 time)
 * @param {string} fallback - null일 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function formatTime(timeStr, fallback = '-') {
  if (!timeStr) return fallback;
  // T 구분자를 공백으로 변경 (ISO format 처리)
  const normalized = timeStr.replace('T', ' ');
  // datetime 형식이면 시간 부분만 추출 (2026-01-24 17:24:31.829411 → 17:24:31)
  const timePart = normalized.includes(' ') ? normalized.split(' ')[1] : normalized;
  // 소숫점 이하 제거 (17:24:31.829411 → 17:24:31)
  const withoutMs = timePart.split('.')[0];
  // HH:MM:SS → HH:MM (분까지만)
  const parts = withoutMs.split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : withoutMs;
}

/**
 * 날짜+시간 포맷 (YYYY-MM-DD HH:MM) - T 제거, 분까지만 표시
 * @param {string|null|undefined} datetimeStr - datetime 문자열
 * @param {string} fallback - null일 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function formatDateTime(datetimeStr, fallback = '-') {
  if (!datetimeStr) return fallback;
  // T 구분자를 공백으로 변경 (ISO format 처리)
  const normalized = datetimeStr.replace('T', ' ');
  // 소숫점 이하 제거
  const withoutMs = normalized.split('.')[0];
  // YYYY-MM-DD HH:MM:SS → YYYY-MM-DD HH:MM (분까지만)
  const parts = withoutMs.split(':');
  if (parts.length >= 3) {
    // 초 부분 제거
    return parts.slice(0, 2).join(':');
  }
  return withoutMs;
}

/**
 * 근무 시간 계산 (시간 단위)
 * @param {string|null|undefined} checkIn - 출근 시간 (datetime 또는 time)
 * @param {string|null|undefined} checkOut - 퇴근 시간 (datetime 또는 time)
 * @param {string} fallback - 계산 불가능할 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function calculateWorkHours(checkIn, checkOut, fallback = '-') {
  if (!checkIn) return fallback;
  if (!checkOut) return '근무중';

  try {
    // datetime 형식 처리
    const parseTime = (str) => {
      if (str.includes(' ')) {
        return new Date(str.split('.')[0]); // 소숫점 제거 후 파싱
      }
      return new Date(`2000-01-01 ${str.split('.')[0]}`);
    };

    const inTime = parseTime(checkIn);
    const outTime = parseTime(checkOut);

    if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) {
      return fallback;
    }

    const hours = (outTime - inTime) / (1000 * 60 * 60);
    if (isNaN(hours) || hours < 0) return fallback;

    return `${hours.toFixed(1)}h`;
  } catch {
    return fallback;
  }
}

/**
 * 퍼센트 포맷
 * @param {number|null|undefined} value - 값 (0~1 사이)
 * @param {number} decimals - 소수점 자릿수 (기본: 1)
 * @param {string} fallback - null/NaN일 때 표시할 값 (기본: '-')
 * @returns {string}
 */
export function formatPercent(value, decimals = 1, fallback = '-') {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return `${(Number(value) * 100).toFixed(decimals)}%`;
}
