import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { applicationsAPI, attendanceAPI, chainAPI } from '../api/client';
import { formatPay, formatDateShort, calculateNetPay, formatTime, calculateWorkHours } from '../utils/format';

export default function Work() {
  const { user, worker } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance'); // attendance, applications, history

  // 출퇴근 관련
  const [attendanceList, setAttendanceList] = useState([]);
  const [checkInCode, setCheckInCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);
  const [lastAction, setLastAction] = useState(null);

  // 지원 관련
  const [applications, setApplications] = useState([]);
  const [appFilter, setAppFilter] = useState('all');
  const [canceling, setCanceling] = useState(null);

  // 근무내역 관련
  const [workHistory, setWorkHistory] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (worker) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [worker]);

  const loadData = async () => {
    try {
      const [attRes, appRes, historyRes] = await Promise.all([
        attendanceAPI.getMyList().catch(() => ({ data: { attendance: [] } })),
        applicationsAPI.getMyList().catch(() => ({ data: { applications: [] } })),
        chainAPI.getMyLogs().catch(() => ({ data: { logs: [] } })),
      ]);
      setAttendanceList(attRes.data.attendance || []);
      setApplications(appRes.data.applications || []);
      setWorkHistory(historyRes.data.logs || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // === 출퇴근 관련 함수들 ===
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
      loadData();
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (error) {
      alert(error.response?.data?.detail || '출근 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (attendanceId, eventTitle) => {
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
      loadData();
      setTimeout(() => setShowSuccess(null), 5000);
    } catch (error) {
      alert(error.response?.data?.detail || '퇴근 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // === 지원 관련 함수들 ===
  const handleCancel = async (e, appId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('지원을 취소하시겠습니까?')) return;

    setCanceling(appId);
    try {
      await applicationsAPI.cancel(appId);
      alert('지원이 취소되었습니다');
      loadData();
    } catch (error) {
      alert(error.response?.data?.detail || '취소에 실패했습니다');
    } finally {
      setCanceling(null);
    }
  };

  // === 유틸 함수들 ===
  const getStatusChip = (status) => {
    const chips = {
      PENDING: <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>심사중</span>,
      CONFIRMED: <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>확정</span>,
      REJECTED: <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>불합격</span>,
      WAITLIST: <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>대기</span>,
    };
    return chips[status] || null;
  };

  const getAttendanceChip = (record) => {
    if (record.check_out_time) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>완료</span>;
    }
    if (record.check_in_time) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>근무중</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>대기</span>;
  };

  const formatWorkedTime = (minutes) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    return dateStr;
  };

  const activeWork = attendanceList.find(a => a.check_in_time && !a.check_out_time);
  const filteredApplications = applications.filter((app) => {
    if (appFilter === 'all') return true;
    return app.status === appFilter;
  });

  if (!user) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🔒
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>로그인이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>근무 현황을 확인하려면 로그인해주세요</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            👤
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>회원등록이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>프로필 등록 후 근무를 시작할 수 있어요</p>
          <button
            onClick={() => navigate('/register')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            회원등록
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 성공 오버레이 - 출근 */}
      {showSuccess === 'checkin' && lastAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              <svg className="w-8 h-8" fill="none" stroke="var(--color-primary)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-title)' }}>출근 완료!</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-medium">{lastAction.eventTitle}</span>에<br />
              {lastAction.time}에 출근했습니다
            </p>
            <button
              onClick={() => setShowSuccess(null)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 성공 오버레이 - 퇴근 */}
      {showSuccess === 'checkout' && lastAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
              <svg className="w-8 h-8" fill="none" stroke="#059669" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-title)' }}>수고하셨습니다!</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{lastAction.eventTitle} 퇴근 완료</p>
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'var(--color-bg)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-sub)' }}>오늘 근무</p>
              <p className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-title)' }}>
                {formatWorkedTime(lastAction.workedMinutes)}
              </p>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-sub)' }}>예상 실수령액</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatPay(lastAction.netPay)}
              </p>
            </div>
            <button
              onClick={() => setShowSuccess(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="pt-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>내 근무</h1>
      </div>

      {/* 현재 근무중 표시 */}
      {activeWork && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <p className="text-green-100 text-xs font-medium">현재 근무중</p>
              </div>
              <h3 className="font-bold text-white text-lg">{activeWork.event_title || '행사'}</h3>
            </div>
            <span className="text-white text-xl font-bold">{calculateWorkHours(activeWork.check_in_time, activeWork.check_out_time, '-')}</span>
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
            {submitting ? '처리중...' : '퇴근하기'}
          </button>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all`}
          style={{
            backgroundColor: activeTab === 'attendance' ? 'white' : 'transparent',
            color: activeTab === 'attendance' ? 'var(--color-text-title)' : 'var(--color-text-sub)',
            boxShadow: activeTab === 'attendance' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          출퇴근
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all`}
          style={{
            backgroundColor: activeTab === 'applications' ? 'white' : 'transparent',
            color: activeTab === 'applications' ? 'var(--color-text-title)' : 'var(--color-text-sub)',
            boxShadow: activeTab === 'applications' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          지원현황
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all`}
          style={{
            backgroundColor: activeTab === 'history' ? 'white' : 'transparent',
            color: activeTab === 'history' ? 'var(--color-text-title)' : 'var(--color-text-sub)',
            boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          근무내역
        </button>
      </div>

      {/* 출퇴근 탭 */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* 출근 코드 입력 */}
          {!activeWork && (
            <form onSubmit={handleCheckIn} className="card">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                  <svg className="w-6 h-6" fill="none" stroke="var(--color-primary)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>출근 코드 입력</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>담당자에게 받은 코드를 입력하세요</p>
              </div>
              <input
                type="text"
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value.toUpperCase())}
                placeholder="예: ABC123"
                className="w-full px-4 py-3 rounded-xl text-center text-xl tracking-[0.3em] uppercase font-bold mb-4"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
                maxLength={10}
              />
              <button
                type="submit"
                disabled={!checkInCode.trim() || submitting}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {submitting ? '출근 처리중...' : '출근하기'}
              </button>
            </form>
          )}

          {/* 출퇴근 기록 */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>출퇴근 기록</p>
            {attendanceList.length > 0 ? (
              <div className="space-y-2">
                {attendanceList.map((record) => (
                  <div key={record.id} className="card">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-title)' }}>{record.event_title || '행사'}</h3>
                        <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>{formatDate(record.event_date)}</p>
                      </div>
                      {getAttendanceChip(record)}
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <span>출근 {formatTime(record.check_in_time)}</span>
                      <span>퇴근 {formatTime(record.check_out_time)}</span>
                      {record.worked_minutes && <span>근무 {formatWorkedTime(record.worked_minutes)}</span>}
                    </div>
                    {record.check_in_time && !record.check_out_time && (
                      <button
                        onClick={() => handleCheckOut(record.id, record.event_title)}
                        disabled={submitting}
                        className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                        style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
                      >
                        퇴근하기
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-8">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>⏰</div>
                <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>출퇴근 기록이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 지원현황 탭 */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: '전체' },
              { key: 'PENDING', label: '심사중' },
              { key: 'CONFIRMED', label: '확정' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setAppFilter(key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  backgroundColor: appFilter === key ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: appFilter === key ? 'white' : 'var(--color-text-secondary)'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 지원 목록 */}
          {filteredApplications.length > 0 ? (
            <div className="space-y-2">
              {filteredApplications.map((app) => (
                <div key={app.id} className="card">
                  <Link to={`/events/${app.event_id}`}>
                    <div className="flex justify-between items-start mb-2">
                      {app.pay_amount ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                            {formatPay(calculateNetPay(app.pay_amount))}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-text-sub)' }}>실수령</span>
                        </div>
                      ) : (
                        <span className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>-</span>
                      )}
                      {getStatusChip(app.status)}
                    </div>
                    <h3 className="font-semibold text-sm mb-1 line-clamp-1" style={{ color: 'var(--color-text-title)' }}>
                      {app.event_title || '행사'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-sub)' }}>
                      <span>{formatDateShort(app.event_date)}</span>
                      <span style={{ color: 'var(--color-border)' }}>|</span>
                      <span>지원 {formatDateShort(app.applied_at?.split(' ')[0])}</span>
                    </div>
                    {app.status === 'REJECTED' && app.rejection_reason && (
                      <div className="mt-2 p-2 rounded-lg text-xs" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                        {app.rejection_reason}
                      </div>
                    )}
                  </Link>
                  {app.status === 'PENDING' && (
                    <button
                      onClick={(e) => handleCancel(e, app.id)}
                      disabled={canceling === app.id}
                      className="mt-3 w-full py-2 text-xs font-medium rounded-lg transition-all active:scale-[0.98]"
                      style={{ color: 'var(--color-error)', backgroundColor: 'var(--color-bg)' }}
                    >
                      {canceling === app.id ? '취소 중...' : '지원 취소'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-8">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>📝</div>
              <p className="text-sm mb-2" style={{ color: 'var(--color-text-disabled)' }}>지원 내역이 없습니다</p>
              <Link
                to="/"
                className="inline-flex px-4 py-2 rounded-lg text-xs font-medium"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
              >
                행사 둘러보기
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 근무내역 탭 */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {workHistory.length > 0 ? (
            <div className="space-y-2">
              {workHistory.map((log) => (
                <div key={log.id} className="card">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-title)' }}>{log.event_title || '행사'}</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>{log.event_date}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)' }}>
                      블록체인 기록됨
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <span>근무 {formatWorkedTime(log.worked_minutes)}</span>
                    {log.pay_amount && <span>급여 {formatPay(log.pay_amount)}</span>}
                  </div>
                  {log.tx_hash && (
                    <p className="text-[10px] mt-2 font-mono truncate" style={{ color: 'var(--color-text-disabled)' }}>
                      TX: {log.tx_hash}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-8">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>📊</div>
              <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>블록체인에 기록된 근무내역이 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
