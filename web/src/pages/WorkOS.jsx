import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { applicationsAPI, attendanceAPI } from '../api/client';
import { formatPay, formatDateShort, calculateNetPay, formatTime, calculateWorkHours, safeNumber } from '../utils/format';
import GPSCheckIn from '../components/GPSCheckIn';
import WorkCalendar from '../components/WorkCalendar';
import MonthlyGoal from '../components/MonthlyGoal';

export default function WorkOS() {
  const { user, worker } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  // 메인 탭: list or calendar
  const [mainTab, setMainTab] = useState(searchParams.get('view') || 'list');

  // List 탭의 서브탭: attendance, applications, history
  const [activeTab, setActiveTab] = useState('attendance');

  // 출퇴근 관련
  const [attendanceList, setAttendanceList] = useState([]);
  const [checkInCode, setCheckInCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [checkInMethod, setCheckInMethod] = useState('gps');

  // 지원 관련
  const [applications, setApplications] = useState([]);
  const [appFilter, setAppFilter] = useState('all');
  const [canceling, setCanceling] = useState(null);

  // 근무내역 관련
  const [workHistory, setWorkHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [downloading, setDownloading] = useState(null);

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

  // URL 쿼리 파라미터와 동기화
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'calendar') {
      setMainTab('calendar');
    } else {
      setMainTab('list');
    }
  }, [searchParams]);

  const handleMainTabChange = (tab) => {
    setMainTab(tab);
    setSearchParams(tab === 'calendar' ? { view: 'calendar' } : {});
  };

  const loadData = async () => {
    try {
      const [attRes, appRes] = await Promise.all([
        attendanceAPI.getMyList().catch(() => ({ data: { attendance: [] } })),
        applicationsAPI.getMyList().catch(() => ({ data: { applications: [] } })),
      ]);
      setAttendanceList(attRes.data.attendance || []);
      setApplications(appRes.data.applications || []);
      const completedRecords = (attRes.data.attendance || []).filter(
        (a) => a.check_out_time
      );
      setWorkHistory(completedRecords);
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
      alert('업무 시작 코드를 입력하세요');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await attendanceAPI.checkIn(checkInCode.trim());
      setLastAction({
        type: 'checkin',
        eventTitle: data.event_title || '행사',
        time: data.check_in_time,
        wptEarned: data.wpt_earned || 10 // 기본 출근 보상
      });
      setShowSuccess('checkin');
      setCheckInCode('');
      loadData();
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (error) {
      alert(error.response?.data?.detail || '업무 시작 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (attendanceId, eventTitle) => {
    setSubmitting(true);
    try {
      const { data } = await attendanceAPI.checkOut(attendanceId);
      const netPay = data.pay_amount ? Math.round(data.pay_amount * 0.967) : 0;
      const workedHours = data.worked_minutes ? Math.floor(data.worked_minutes / 60) : 0;
      const wptEarned = data.wpt_earned || (workedHours * 50); // 시간당 50 WPT

      setLastAction({
        type: 'checkout',
        eventTitle: eventTitle || data.event_title || '행사',
        workedMinutes: data.worked_minutes,
        payAmount: data.pay_amount,
        netPay: netPay,
        wptEarned: wptEarned,
        experience: data.experience_gained || 0
      });
      setShowSuccess('checkout');
      loadData();
      setTimeout(() => setShowSuccess(null), 5000);
    } catch (error) {
      alert(error.response?.data?.detail || '업무 종료 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // === 근무내역 관련 함수들 ===
  const calculatePayment = (grossPay) => {
    const amount = safeNumber(grossPay, 0);
    const incomeTax = Math.floor(amount * 0.03);
    const localTax = Math.floor(amount * 0.003);
    const totalDeduction = incomeTax + localTax;
    const netPay = amount - totalDeduction;
    return { incomeTax, localTax, totalDeduction, netPay, grossPay: amount };
  };

  const formatFullDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}월 ${parts[2]}일`;
    }
    return dateStr;
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '-';
    return dateTimeStr.split('.')[0];
  };

  const handleDownloadPDF = async (record) => {
    setDownloading(record.id);
    try {
      const response = await attendanceAPI.downloadPaymentStatement(record.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `지급명세서_${record.event_title}_${record.event_date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert(error.response?.data?.detail || '다운로드에 실패했습니다');
    } finally {
      setDownloading(null);
    }
  };

  const groupByMonth = (records) => {
    const groups = {};
    records.forEach((record) => {
      if (!record.event_date) return;
      const month = record.event_date.substring(0, 7);
      if (!groups[month]) {
        groups[month] = { records: [], grossTotal: 0, netTotal: 0 };
      }
      groups[month].records.push(record);
      const grossPay = record.pay_amount || 0;
      const { netPay } = calculatePayment(grossPay);
      groups[month].grossTotal += grossPay;
      groups[month].netTotal += netPay;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    return `${year}년 ${parseInt(month)}월`;
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
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>업무 정보를 확인하려면 로그인해주세요</p>
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
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-title)' }}>업무 시작 완료!</h2>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-medium">{lastAction.eventTitle}</span>에<br />
              {lastAction.time}에 업무를 시작했습니다
            </p>
            {/* WPT 보상 */}
            <div className="rounded-xl p-3 mb-4" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <p className="text-white/80 text-xs mb-1">✨ 출근 보상</p>
              <p className="text-white text-2xl font-bold">+{lastAction.wptEarned} WPT</p>
            </div>
            <button
              onClick={() => setShowSuccess(null)}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              확인
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
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>{lastAction.eventTitle} 업무 종료</p>
            <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: 'var(--color-bg)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-sub)' }}>오늘 근무</p>
              <p className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-title)' }}>
                {formatWorkedTime(lastAction.workedMinutes)}
              </p>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-sub)' }}>예상 실수령액</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatPay(lastAction.netPay)}
              </p>
            </div>
            {/* WPT 보상 */}
            <div className="rounded-xl p-3 mb-4" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <p className="text-white/80 text-xs mb-1">🎁 근무 보상</p>
              <div className="flex items-center justify-center gap-3">
                <div className="text-center">
                  <p className="text-white text-2xl font-bold">+{lastAction.wptEarned}</p>
                  <p className="text-white/70 text-xs">WPT</p>
                </div>
                {lastAction.experience > 0 && (
                  <>
                    <div className="text-white/50">|</div>
                    <div className="text-center">
                      <p className="text-white text-2xl font-bold">+{lastAction.experience}</p>
                      <p className="text-white/70 text-xs">EXP</p>
                    </div>
                  </>
                )}
              </div>
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
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>Work OS</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-sub)' }}>나의 근무를 한눈에</p>
      </div>

      {/* 메인 탭: List / Calendar */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
        <button
          onClick={() => handleMainTabChange('list')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2`}
          style={{
            backgroundColor: mainTab === 'list' ? 'white' : 'transparent',
            color: mainTab === 'list' ? 'var(--color-text-title)' : 'var(--color-text-sub)',
            boxShadow: mainTab === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          📋 리스트
        </button>
        <button
          onClick={() => handleMainTabChange('calendar')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2`}
          style={{
            backgroundColor: mainTab === 'calendar' ? 'white' : 'transparent',
            color: mainTab === 'calendar' ? 'var(--color-text-title)' : 'var(--color-text-sub)',
            boxShadow: mainTab === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          📅 캘린더
        </button>
      </div>

      {/* Calendar 탭 */}
      {mainTab === 'calendar' && (
        <div className="space-y-4">
          <MonthlyGoal />
          <WorkCalendar />
        </div>
      )}

      {/* List 탭 */}
      {mainTab === 'list' && (
        <>
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
                {submitting ? '처리중...' : '업무 종료'}
              </button>
            </div>
          )}

          {/* 서브 탭 */}
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
              업무
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
              {!activeWork && (
                <>
                  <div className="flex gap-2 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <button
                      onClick={() => setCheckInMethod('gps')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all`}
                      style={{
                        backgroundColor: checkInMethod === 'gps' ? 'white' : 'transparent',
                        color: checkInMethod === 'gps' ? 'var(--color-text-title)' : 'var(--color-text-sub)',
                        boxShadow: checkInMethod === 'gps' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      📍 GPS 출근
                    </button>
                    <button
                      onClick={() => setCheckInMethod('code')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all`}
                      style={{
                        backgroundColor: checkInMethod === 'code' ? 'white' : 'transparent',
                        color: checkInMethod === 'code' ? 'var(--color-text-title)' : 'var(--color-text-sub)',
                        boxShadow: checkInMethod === 'code' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      🔑 코드 입력
                    </button>
                  </div>

                  {checkInMethod === 'gps' && applications.length > 0 && (
                    <div className="space-y-3">
                      {applications
                        .filter(app => app.status === 'CONFIRMED')
                        .map(app => (
                          <div key={app.id}>
                            <div className="card mb-2" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-title)' }}>
                                    {app.event_title}
                                  </h3>
                                  <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                                    {formatDateShort(app.event_date)}
                                  </p>
                                </div>
                                <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                                  확정됨
                                </span>
                              </div>
                            </div>
                            <GPSCheckIn
                              eventId={app.event_id}
                              eventTitle={app.event_title}
                              onSuccess={loadData}
                            />
                          </div>
                        ))}
                      {applications.filter(app => app.status === 'CONFIRMED').length === 0 && (
                        <div className="card text-center py-6">
                          <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>
                            확정된 행사가 없습니다
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {checkInMethod === 'code' && (
                    <form onSubmit={handleCheckIn} className="card">
                      <div className="text-center mb-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                          <svg className="w-6 h-6" fill="none" stroke="var(--color-primary)" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>업무 시작 코드 입력</p>
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
                        {submitting ? '출근 처리중...' : '업무 시작'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {/* 지원현황 탭 */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
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
                            <span className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>급여 미정</span>
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
                <div className="space-y-4">
                  {groupByMonth(workHistory).map(([month, data]) => (
                    <div key={month}>
                      <div className="mb-2">
                        <div className="card" style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-white/80 text-sm mb-1">{formatMonth(month)}</p>
                              <p className="text-white text-base font-semibold">{data.records.length}건 완료</p>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
                              📊
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white/10 rounded-lg p-2.5">
                              <p className="text-white/60 text-xs mb-0.5">세전 총액</p>
                              <p className="text-white text-sm font-semibold">{data.grossTotal.toLocaleString()}원</p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-2.5">
                              <p className="text-white/60 text-xs mb-0.5">세후 총액</p>
                              <p className="text-white text-sm font-semibold">{data.netTotal.toLocaleString()}원</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {data.records.map((record) => (
                          <div key={record.id} className="card">
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => setSelectedRecord(record)}
                              >
                                <h3 className="font-semibold text-base hover:text-blue-600 transition-colors">{record.event_title || '행사'}</h3>
                                <p className="text-xs text-gray-500">{formatFullDate(record.event_date)}</p>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#E2E8F0', color: '#475569' }}>업무 종료</span>
                            </div>

                            {record.pay_amount && (
                              <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 mb-2">
                                <span className="text-gray-500">실지급액</span>
                                <span className="font-bold" style={{ color: 'var(--color-primary)' }}>
                                  {calculatePayment(record.pay_amount).netPay.toLocaleString()}원
                                </span>
                              </div>
                            )}

                            <button
                              onClick={() => handleDownloadPDF(record)}
                              disabled={downloading === record.id}
                              className="w-full py-2 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all mt-2 shadow-sm hover:shadow-md"
                            >
                              {downloading === record.id ? '다운로드 중...' : '💰 지급명세서 다운로드'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>📊</div>
                  <p className="text-sm mb-2" style={{ color: 'var(--color-text-disabled)' }}>근무 내역이 없습니다</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>업무를 완료하면 여기서 확인할 수 있어요</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 근무 상세정보 모달 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRecord(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4 text-white sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <span className="font-semibold">근무 상세정보</span>
                </div>
                <button onClick={() => setSelectedRecord(null)} className="text-white text-2xl leading-none">&times;</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedRecord.event_title}</h3>
                <p className="text-sm text-gray-500">{formatFullDate(selectedRecord.event_date)}</p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">⏰ 근무 시간</p>
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 text-sm">업무시작</span>
                    <span className="font-medium">{formatDateTime(selectedRecord.check_in_time)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 text-sm">업무종료</span>
                    <span className="font-medium">{formatDateTime(selectedRecord.check_out_time)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 text-sm">상태</span>
                    <span className="font-medium text-green-600">업무 종료</span>
                  </div>
                </div>
              </div>

              {selectedRecord.pay_amount && (() => {
                const payment = calculatePayment(selectedRecord.pay_amount);
                return (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">💰 급여 정보</p>
                    <div className="space-y-2">
                      <div className="flex justify-between py-1">
                        <span className="text-gray-500 text-sm">세전 금액</span>
                        <span className="font-medium">{selectedRecord.pay_amount.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between py-2 bg-slate-100 rounded-lg px-3 mt-2">
                        <span className="font-semibold">실지급액</span>
                        <span className="font-bold text-lg text-slate-700">
                          {payment.netPay.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {selectedRecord.tx_hash && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">⛓️ 블록체인 증명</p>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-sm text-green-700 font-medium">블록체인에 영구 기록됨</span>
                    </div>
                    <button
                      onClick={() => window.open(`https://amoy.polygonscan.com/tx/${selectedRecord.tx_hash}`, '_blank')}
                      className="w-full py-2 text-xs bg-white text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-50 transition-colors"
                    >
                      Polygonscan에서 확인 →
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
