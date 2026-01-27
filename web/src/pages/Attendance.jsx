import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI } from '../api/client';
import { formatTime, calculateWorkHours } from '../utils/format';

export default function Attendance() {
  const { worker } = useAuth();
  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkInCode, setCheckInCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null); // 'checkin' | 'checkout' | null
  const [lastAction, setLastAction] = useState(null); // 마지막 액션 정보

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (worker) {
      loadAttendance();
    } else {
      setLoading(false);
    }
  }, [worker]);

  const loadAttendance = async () => {
    try {
      const { data } = await attendanceAPI.getMyList();
      setAttendanceList(data.attendance || []);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!checkInCode.trim()) {
      alert('출근 코드를 입력하세요');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await attendanceAPI.checkIn(checkInCode.trim());
      setLastAction({
        type: 'checkin',
        eventTitle: data.event_title || '행사',
        time: data.check_in_time
      });
      setShowSuccess('checkin');
      setCheckInCode('');
      loadAttendance();

      // 3초 후 성공 화면 닫기
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (error) {
      alert(error.response?.data?.detail || '출근 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (attendanceId, eventTitle) => {
    // 커스텀 확인 대화상자 대신 바로 처리
    setSubmitting(true);
    try {
      const { data } = await attendanceAPI.checkOut(attendanceId);
      const netPay = data.pay_amount ? Math.round(data.pay_amount * 0.967) : 0;
      setLastAction({
        type: 'checkout',
        eventTitle: eventTitle || data.event_title || '행사',
        workedMinutes: data.worked_minutes,
        payAmount: data.pay_amount,
        netPay: netPay
      });
      setShowSuccess('checkout');
      loadAttendance();

      // 5초 후 성공 화면 닫기
      setTimeout(() => setShowSuccess(null), 5000);
    } catch (error) {
      alert(error.response?.data?.detail || '퇴근 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusChip = (record) => {
    if (record.check_out_time) {
      return <span className="chip-completed">퇴근</span>;
    }
    if (record.check_in_time) {
      return <span className="chip-confirmed">근무중</span>;
    }
    return <span className="chip-pending">대기</span>;
  };

  const getWorkHours = (record) => {
    return calculateWorkHours(record.check_in_time, record.check_out_time, '-');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    }
    return dateStr;
  };

  // 오늘 근무중인 것
  const activeWork = attendanceList.find(a => a.check_in_time && !a.check_out_time);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="empty-state-modern card">
          <div className="empty-state-icon-modern">
            <span>👤</span>
          </div>
          <p className="empty-state-title-modern">회원등록이 필요해요</p>
          <p className="empty-state-desc-modern">
            출퇴근 기능을 사용하려면<br />
            먼저 프로필에서 등록을 완료하세요
          </p>
          <a href="/register" className="btn-cta-outline mt-2">
            회원등록 하러가기
          </a>
        </div>
      </div>
    );
  }

  const formatWorkedTime = (minutes) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  };

  const formatPay = (amount) => {
    if (!amount) return '0원';
    return `${Number(amount).toLocaleString()}원`;
  };

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* 성공 오버레이 - 출근 */}
      {showSuccess === 'checkin' && lastAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center animate-slide-up">
            <div className="success-check">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">출근 완료!</h2>
            <p className="text-gray-500 mb-4">
              <span className="font-medium text-gray-900">{lastAction.eventTitle}</span>에<br />
              {lastAction.time}에 출근했습니다
            </p>
            <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
              <p>열심히 일하시고,</p>
              <p className="font-semibold">퇴근할 때 다시 찾아주세요!</p>
            </div>
            <button
              onClick={() => setShowSuccess(null)}
              className="mt-4 text-sm text-gray-400"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 성공 오버레이 - 퇴근 */}
      {showSuccess === 'checkout' && lastAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center animate-slide-up">
            <div className="success-check">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">수고하셨습니다!</h2>
            <p className="text-gray-500 text-sm mb-4">{lastAction.eventTitle} 퇴근 완료</p>

            {/* 정산 정보 */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">오늘 근무</p>
              <p className="text-lg font-bold text-gray-900 mb-3">
                {formatWorkedTime(lastAction.workedMinutes)}
              </p>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-sm text-gray-500 mb-1">예상 실수령액</p>
                <p className="text-2xl font-bold money-accent">
                  {formatPay(lastAction.netPay)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  세전 {formatPay(lastAction.payAmount)} (3.3% 원천징수)
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="same-day-badge">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                당일정산
              </span>
              <span className="trust-badge-blockchain">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                블록체인 기록됨
              </span>
            </div>

            <button
              onClick={() => setShowSuccess(null)}
              className="mt-4 btn-cta-success"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-gray-900">출퇴근</h1>
        <p className="text-sm text-gray-500 mt-1">승인된 행사의 출근 코드를 입력하세요</p>
      </div>

      {/* 현재 근무중 표시 */}
      {activeWork && (
        <div className="card relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }}>
          {/* 애니메이션 백그라운드 */}
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
            <div className="w-full h-full rounded-full bg-white animate-pulse"></div>
          </div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  <p className="text-green-100 text-xs font-medium">현재 근무중</p>
                </div>
                <h3 className="font-bold text-white text-lg">{activeWork.event_title || '행사'}</h3>
              </div>
              <span className="text-white text-xl font-bold">{getWorkHours(activeWork)}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-white/80 mb-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>출근 {formatTime(activeWork.check_in_time)}</span>
            </div>

            <button
              onClick={() => handleCheckOut(activeWork.id, activeWork.event_title)}
              disabled={submitting}
              className="w-full py-3 bg-white text-green-600 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-600 border-t-transparent"></div>
                  처리중...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  퇴근하기
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 출근 코드 입력 */}
      {!activeWork && (
        <form onSubmit={handleCheckIn} className="card border-2 border-dashed border-blue-200" style={{ backgroundColor: '#F8FAFC' }}>
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">출근 코드 입력</p>
            <p className="text-xs text-gray-400 mt-1">담당자에게 받은 코드를 입력하세요</p>
          </div>

          <input
            type="text"
            value={checkInCode}
            onChange={(e) => setCheckInCode(e.target.value.toUpperCase())}
            placeholder="예: ABC123"
            className="input text-center text-xl tracking-[0.3em] uppercase mb-4 font-bold"
            maxLength={10}
          />
          <button
            type="submit"
            disabled={!checkInCode.trim() || submitting}
            className="btn-cta"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                출근 처리중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                출근하기
              </>
            )}
          </button>
        </form>
      )}

      {/* 출퇴근 기록 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="section-title mb-0">출퇴근 기록</p>
          {attendanceList.length > 0 && (
            <span className="text-xs text-gray-400">{attendanceList.length}건</span>
          )}
        </div>

        {attendanceList.length > 0 ? (
          <div className="space-y-2">
            {attendanceList.map((record) => (
              <div key={record.id} className="card">
                {/* 상단: 행사명 + 상태 */}
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-base">{record.event_title || '행사'}</h3>
                    <p className="text-xs text-gray-500">{formatDate(record.event_date)}</p>
                  </div>
                  {getStatusChip(record)}
                </div>

                {/* 시간 정보 */}
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">출근 </span>
                    <span className="font-medium">{formatTime(record.check_in_time)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">퇴근 </span>
                    <span className="font-medium">{formatTime(record.check_out_time)}</span>
                  </div>
                  {record.worked_minutes && (
                    <div>
                      <span className="text-gray-400">근무 </span>
                      <span className="font-medium">{formatWorkedTime(record.worked_minutes)}</span>
                    </div>
                  )}
                </div>

                {/* 퇴근 버튼 */}
                {record.check_in_time && !record.check_out_time && (
                  <button
                    onClick={() => handleCheckOut(record.id, record.event_title)}
                    disabled={submitting}
                    className="mt-3 w-full py-2.5 bg-green-50 text-green-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    퇴근하기
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state-modern card">
            <div className="empty-state-icon-modern">
              <span>⏰</span>
            </div>
            <p className="empty-state-title-modern">아직 출퇴근 기록이 없어요</p>
            <p className="empty-state-desc-modern">
              지원이 확정되면 담당자에게<br />
              출근 코드를 받을 수 있어요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
